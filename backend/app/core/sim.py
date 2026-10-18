"""Simulation ingest from Roblox and the mic listener. contracts/roblox-bridge.md and contracts/api.md."""
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from . import db, gateway, hub, muster, rules
from .config import settings
from .sites import SITES

MILE_M = 1609.344


def require_sim(x_token: str = Header("")):
    if not secrets.compare_digest(x_token, settings.sim_token):
        raise HTTPException(403, "bad X-Token")


router = APIRouter(prefix="/sim", dependencies=[Depends(require_sim)])


class StrikeIn(BaseModel):
    site_id: int
    bearing: float | None = None
    miles: float | None = None
    lat: float | None = None
    lon: float | None = None


@router.post("/strike")
async def sim_strike(body: StrikeIn):
    site = SITES.get(body.site_id)
    if not site:
        raise HTTPException(404, "unknown site")
    if body.lat is None or body.lon is None:
        if body.bearing is None or body.miles is None:
            raise HTTPException(422, "need bearing and miles, or lat and lon")
        lat, lon = rules.destination(site["lat"], site["lon"], body.bearing, body.miles * MILE_M)
    else:
        lat, lon = body.lat, body.lon
    alerts = await rules.on_strike(rules.now(), lat, lon, "sim")
    return {"lat": lat, "lon": lon, "distance_m": round(rules.haversine_m(lat, lon, site["lat"], site["lon"])),
            "alerts": alerts}


class BangIn(BaseModel):
    site_id: int
    ts_us: int


SOUND_MPS = 343


@router.post("/bang")
async def sim_bang(body: BangIn):
    """From the mic listener page. Relay to the Pi, and pair with the last FLASH here too; whichever decides first wins."""
    relayed = await gateway.send(body.site_id, {"cmd": "BANG", "ts_us": body.ts_us})
    flash = gateway.last_flash.get(body.site_id)
    gap_s = (body.ts_us - flash) / 1e6 if flash else None
    if gap_s is None or not 0 < gap_s < 60:
        return {"relayed": relayed, "paired": False}
    gateway.last_flash.pop(body.site_id)
    d = gap_s * SOUND_MPS
    if d < rules.STOPWORK_RADIUS_M:
        await gateway._local_stopwork(body.site_id, {"distance_m": round(d), "flash_ts_us": flash, "bang_ts_us": body.ts_us})
    return {"relayed": relayed, "paired": True, "distance_m": round(d)}


class WeatherIn(BaseModel):
    site_id: int
    temp_c: float | None = None
    humidity: float | None = None
    precip_mm: float | None = None
    gust: float | None = None  # km/h


def _site(site_id):
    if site_id not in SITES:
        raise HTTPException(404, "unknown site")


@router.post("/weather")
async def sim_weather(body: WeatherIn):
    _site(body.site_id)
    hi = rules.heat_index_f(body.temp_c, body.humidity)
    c = {"temp_c": body.temp_c, "humidity": body.humidity, "heat_index_f": hi, "precip_mm": body.precip_mm,
         "wind_gust_kmh": body.gust}
    await db.execute(
        "INSERT INTO conditions (ts,site_id,source,temp_c,humidity,heat_index_f,precip_mm,wind_gust_kmh)"
        " VALUES (now(),$1,'sim',$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", body.site_id, *c.values())
    await hub.publish(body.site_id, {"type": "conditions", "source": "sim", **c})
    await rules.evaluate_heat(body.site_id, hi)
    await rules.evaluate_flood(body.site_id)
    return {"heat_index_f": hi}


class WaterIn(BaseModel):
    site_id: int
    depth_mm: float


@router.post("/water")
async def sim_water(body: WaterIn):
    _site(body.site_id)
    await db.execute("INSERT INTO conditions (ts,site_id,source,water_depth_mm) VALUES (now(),$1,'sim',$2)"
                     " ON CONFLICT DO NOTHING", body.site_id, body.depth_mm)
    await db.execute("INSERT INTO events VALUES (now(),$1,'sim','water',$2)", body.site_id, {"depth_mm": body.depth_mm})
    await hub.publish(body.site_id, {"type": "conditions", "source": "sim", "water_depth_mm": body.depth_mm})
    await rules.evaluate_flood(body.site_id)
    return {"ok": True}


class PresenceIn(BaseModel):
    site_id: int
    count: int
    users: list[str] = []


@router.post("/presence")
async def sim_presence(body: PresenceIn):
    _site(body.site_id)
    await db.execute("INSERT INTO events VALUES (now(),$1,'sim','presence',$2)", body.site_id,
                     {"count": body.count, "users": body.users})
    muster.set_presence(body.site_id, "sim", body.count)
    await muster.roblox_presence(body.site_id, body.users)
    return await muster.roster(body.site_id)


class ResetIn(BaseModel):
    site_id: int


@router.post("/reset")
async def sim_reset(body: ResetIn):
    """A new Roblox scenario starts from calm: clear the site's open alerts, release the beacon, and drop the
    last day of sim weather and water so the heat and flood rules do not reopen them from the old scenario."""
    _site(body.site_id)
    await db.execute("DELETE FROM conditions WHERE site_id=$1 AND source='sim' AND ts > now() - interval '24 hours'",
                     body.site_id)
    types = [r["type"] for r in await db.fetch("SELECT DISTINCT type FROM alerts WHERE site_id=$1 AND cleared IS NULL",
                                               body.site_id)]
    cleared = await rules.clear_alerts(body.site_id, "Roblox scenario reset", types=tuple(types)) if types else []
    if "stopwork" in types and SITES[body.site_id]["beacon"]:
        await gateway.send(body.site_id, {"cmd": "CLEAR", "by": "SIM RESET"})  # the beacon LCD shows 10 chars
    await db.execute("INSERT INTO events VALUES (now(),$1,'sim','reset',$2)", body.site_id,
                     {"cleared": [a["type"] for a in cleared]})
    return {"cleared": [a["type"] for a in cleared], "alerts": []}
