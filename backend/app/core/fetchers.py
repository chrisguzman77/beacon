"""Keyless feeds. Each fetcher takes a site, writes conditions rows, and never raises (a dead feed must not stop the loop)."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

from . import db, hub, rules
from .sites import SITES

log = logging.getLogger("core.fetchers")
FORECAST = "https://api.open-meteo.com/v1/forecast"
FLOOD = "https://flood-api.open-meteo.com/v1/flood"
NWS = "https://api.weather.gov/alerts/active"
INAT = "https://api.inaturalist.org/v1/observations"
STAGGER_S = 2

# feed -> last success time, served by GET /health
health: dict[str, str] = {}


def _utc(t):
    return datetime.fromisoformat(t).replace(tzinfo=timezone.utc)


async def fetch_openmeteo(http, site):
    """The last 24 hours plus the current hour into conditions (source feed), so the flood rule's 24 h rain sum works at once."""
    r = await http.get(FORECAST, params=dict(
        latitude=site["lat"], longitude=site["lon"], timezone="GMT", past_days=1, forecast_days=1,
        hourly="temperature_2m,relative_humidity_2m,precipitation,wind_gusts_10m,soil_moisture_0_to_1cm"))
    r.raise_for_status()
    h = r.json()["hourly"]
    now = rules.now()
    rows = []
    for i, t in enumerate(h["time"]):
        ts = _utc(t)
        if now - timedelta(hours=24) < ts <= now:
            temp, rh = h["temperature_2m"][i], h["relative_humidity_2m"][i]
            rows.append((ts, site["site_id"], temp, rh, rules.heat_index_f(temp, rh), h["precipitation"][i],
                         h["soil_moisture_0_to_1cm"][i], h["wind_gusts_10m"][i]))
    await db.get_pool().executemany(
        "INSERT INTO conditions (ts,site_id,source,temp_c,humidity,heat_index_f,precip_mm,soil,wind_gust_kmh)"
        " VALUES ($1,$2,'feed',$3,$4,$5,$6,$7,$8) ON CONFLICT (site_id,ts,source) DO UPDATE SET temp_c=EXCLUDED.temp_c,"
        " humidity=EXCLUDED.humidity, heat_index_f=EXCLUDED.heat_index_f, precip_mm=EXCLUDED.precip_mm,"
        " soil=EXCLUDED.soil, wind_gust_kmh=EXCLUDED.wind_gust_kmh", rows)
    if not rows:
        return None
    cur = rows[-1]
    c = {"temp_c": cur[2], "humidity": cur[3], "heat_index_f": cur[4], "precip_mm": cur[5], "soil": cur[6],
         "wind_gust_kmh": cur[7]}
    await hub.publish(site["site_id"], {"type": "conditions", "source": "feed", **c})
    # The beacon site uses its own measured heat index (rules table, platform guide 3.5)
    if not site["beacon"]:
        await rules.evaluate_heat(site["site_id"], cur[4])
    await rules.evaluate_flood(site["site_id"])
    return c


async def fetch_flood(http, site):
    """Today's river discharge onto the current hour's feed row, and the 90 day mean for the flood rule."""
    r = await http.get(FLOOD, params=dict(latitude=site["lat"], longitude=site["lon"], daily="river_discharge",
                                          past_days=90, forecast_days=1))
    r.raise_for_status()
    d = r.json()["daily"]
    vals = [v for v in d["river_discharge"] if v is not None]
    if not vals:
        return None
    today = d["river_discharge"][-1] if d["river_discharge"][-1] is not None else vals[-1]
    rules.discharge_mean[site["site_id"]] = sum(vals) / len(vals)
    hour = rules.now().replace(minute=0, second=0, microsecond=0)
    await db.execute("INSERT INTO conditions (ts,site_id,source,discharge) VALUES ($1,$2,'feed',$3)"
                     " ON CONFLICT (site_id,ts,source) DO UPDATE SET discharge=EXCLUDED.discharge",
                     hour, site["site_id"], today)
    await rules.evaluate_flood(site["site_id"])
    return today


async def _new_event(site_id, type_, key, value):
    """True if no event of this type with payload[key] == value exists for the site yet."""
    return not await db.fetchval(
        "SELECT 1 FROM events WHERE site_id=$1 AND type=$2 AND payload->>$3 = $4 LIMIT 1", site_id, type_, key, str(value))


async def fetch_nws(http, site):
    """Each active NWS alert once, as an nws_alert event."""
    r = await http.get(NWS, params={"point": f"{site['lat']:.4f},{site['lon']:.4f}"})
    r.raise_for_status()
    n = 0
    for f in r.json().get("features", []):
        p = f["properties"]
        if await _new_event(site["site_id"], "nws_alert", "id", p["id"]):
            payload = {"id": p["id"], "event": p.get("event"), "severity": p.get("severity"), "headline": p.get("headline")}
            await db.execute("INSERT INTO events VALUES (now(),$1,'feed','nws_alert',$2)", site["site_id"], payload)
            await hub.publish(site["site_id"], {"type": "nws_alert", **payload})
            n += 1
    return n


async def fetch_inat(http, site):
    """Alligator sightings within 5 km in the last 30 days, each once, as a wildlife event."""
    d1 = (rules.now() - timedelta(days=30)).date().isoformat()
    r = await http.get(INAT, params=dict(taxon_name="Alligator mississippiensis", lat=site["lat"], lng=site["lon"],
                                         radius=5, d1=d1, per_page=50))
    r.raise_for_status()
    n = 0
    for o in r.json().get("results", []):
        if not o.get("location") or not await _new_event(site["site_id"], "wildlife", "id", o["id"]):
            continue
        lat, lon = map(float, o["location"].split(","))
        payload = {"id": o["id"], "species": o["taxon"]["name"], "observed_on": o.get("observed_on"), "lat": lat, "lon": lon}
        await db.execute("INSERT INTO events VALUES (now(),$1,'feed','wildlife',$2)", site["site_id"], payload)
        n += 1
    return n


async def run(feed, fn, sites):
    ok = 0
    # NWS requires a User-Agent that identifies the app
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "OmniRisk (github.com/chrisguzman77/beacon)"}) as http:
        for s in sites:
            try:
                v = await fn(http, s)
                ok += 1
                log.info("%s site %s ok %s", feed, s["site_id"], v if isinstance(v, (int, float)) else "")
            except Exception as e:
                log.warning("%s site %s failed: %s", feed, s["site_id"], e)
            await asyncio.sleep(STAGGER_S)
    if ok:
        health[feed] = rules.now().isoformat()


async def fetch_forecast_all():
    await run("open_meteo", fetch_openmeteo, list(SITES.values()))


async def fetch_flood_all():
    await run("flood", fetch_flood, [s for s in SITES.values() if s["river"]])


async def fetch_nws_all():
    await run("nws", fetch_nws, list(SITES.values()))


async def fetch_inat_all():
    await run("inaturalist", fetch_inat, list(SITES.values()))
