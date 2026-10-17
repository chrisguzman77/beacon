"""Simulation ingest from Roblox and the mic listener. contracts/roblox-bridge.md and contracts/api.md."""
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from . import gateway, rules
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
