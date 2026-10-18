"""Rules engine. contracts/events.md is the source of truth for thresholds."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from math import asin, atan2, cos, degrees, radians, sin, sqrt

from . import db, gateway, hub
from .sites import SITES

log = logging.getLogger("core.rules")

R_EARTH = 6371000.0
STOPWORK_RADIUS_M = 16093
STOPWORK_SECONDS = 1800
HEAT_WARNING_F, HEAT_DANGER_F = 103, 115
WIND_WARNING_MPH, WIND_DANGER_MPH = 28, 40
REFRESH_SECONDS = 3600  # heat and flood alerts auto clear an hour after the last reading that triggered them
# 90 day mean river discharge per site, filled by the flood fetcher
discharge_mean: dict[int, float] = {}


def now():
    return datetime.now(timezone.utc)


def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = p2 - p1, radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * R_EARTH * asin(sqrt(a))


def destination(lat, lon, bearing_deg, distance_m):
    """Point distance_m from (lat, lon) along bearing_deg (0 north, 270 west)."""
    p1, l1, th, d = radians(lat), radians(lon), radians(bearing_deg), distance_m / R_EARTH
    p2 = asin(sin(p1) * cos(d) + cos(p1) * sin(d) * cos(th))
    l2 = l1 + atan2(sin(th) * sin(d) * cos(p1), cos(d) - sin(p1) * sin(p2))
    return degrees(p2), degrees(l2)


def heat_index_f(t_c, rh):
    """NWS Rothfusz regression, same as ml (docs/ai-ml-guide.md section 4)."""
    if t_c is None or rh is None:
        return None
    T = t_c * 9 / 5 + 32
    if T < 80:
        return T
    return (-42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 6.83783e-3 * T * T
            - 5.481717e-2 * rh * rh + 1.22874e-3 * T * T * rh + 8.5282e-4 * T * rh * rh - 1.99e-6 * T * T * rh * rh)


def alert_json(r):
    a = dict(r)
    for k in ("started", "expires", "cleared"):
        if a.get(k):
            a[k] = a[k].isoformat()
    a["payload"] = a.get("payload") or {}
    a["awaiting_clear"] = bool(a["payload"].get("awaiting_clear"))
    return a


async def open_or_extend_alert(site_id, type_, seconds, payload, at=None):
    """Open an alert of this type, or push the open one's expiry to at + seconds (the lightning reset)."""
    at = at or now()
    expires = at + timedelta(seconds=seconds) if seconds else None
    row = await db.fetchrow(
        "SELECT * FROM alerts WHERE site_id=$1 AND type=$2 AND cleared IS NULL ORDER BY alert_id DESC LIMIT 1",
        site_id, type_)
    if row:
        p = row["payload"] or {}
        p.update(payload)
        p["awaiting_clear"] = False
        p["resets"] = p.get("resets", 0) + 1
        if type_ == "stopwork":
            p.setdefault("history", []).append({"ts": at.isoformat(), **payload})
        row = await db.fetchrow(
            "UPDATE alerts SET expires=GREATEST(expires,$2), payload=$3 WHERE alert_id=$1 RETURNING *",
            row["alert_id"], expires, p)
    else:
        p = {**payload, "awaiting_clear": False, "resets": 0, "history": [{"ts": at.isoformat(), **payload}]}
        row = await db.fetchrow(
            "INSERT INTO alerts (site_id,type,started,expires,payload) VALUES ($1,$2,$3,$4,$5) RETURNING *",
            site_id, type_, at, expires, p)
    a = alert_json(row)
    await hub.publish(site_id, {"type": "alert", "alert": a})
    return a


async def clear_alerts(site_id, by, types=("stopwork",)):
    rows = await db.fetch(
        "UPDATE alerts SET cleared=now(), cleared_by=$2 WHERE site_id=$1 AND cleared IS NULL AND type = ANY($3::text[]) RETURNING *",
        site_id, by, list(types))
    for r in rows:
        await hub.publish(site_id, {"type": "alert", "alert": alert_json(r)})
    return [alert_json(r) for r in rows]


async def evaluate_heat(site_id, hi):
    if hi is None or hi < HEAT_WARNING_F:
        return
    if hi >= HEAT_DANGER_F:
        a = await open_or_extend_alert(site_id, "heat_danger", REFRESH_SECONDS, {"heat_index_f": round(hi, 1)})
        if a["payload"]["resets"] == 0 and SITES[site_id]["beacon"]:
            await gateway.send(site_id, {"cmd": "REST", "seconds": 900, "heat_index_f": round(hi, 1)})
    else:
        await open_or_extend_alert(site_id, "heat_warning", REFRESH_SECONDS, {"heat_index_f": round(hi, 1)})


async def evaluate_wind(site_id, gust_mph):
    """Site twin gusts, the same lines as its own panel: 28 mph grounds aerial lifts and bucket trucks, 40 stops the job."""
    if gust_mph is None or gust_mph < WIND_WARNING_MPH:
        return
    type_ = "wind_danger" if gust_mph >= WIND_DANGER_MPH else "wind_warning"
    await open_or_extend_alert(site_id, type_, REFRESH_SECONDS, {"gust_mph": round(gust_mph, 1)})


async def evaluate_flood(site_id):
    # The latest reading of each water source, so receding water clears the alert instead of the 10 minute max
    # holding it open; a source with no reading in 10 minutes does not count.
    water = await db.fetchval(
        "SELECT max(w) FROM (SELECT DISTINCT ON (source) water_depth_mm AS w FROM conditions WHERE site_id=$1"
        " AND source IN ('beacon','sim') AND water_depth_mm IS NOT NULL AND ts > now() - interval '10 minutes'"
        " ORDER BY source, ts DESC) latest", site_id)
    if water and water > 0:
        await open_or_extend_alert(site_id, "flood_confirmed", REFRESH_SECONDS, {"water_depth_mm": water})
    elif water is not None:
        await clear_alerts(site_id, "water receded", types=("flood_confirmed",))
    if not SITES[site_id]["river"]:
        return
    precip = await db.fetchval(
        "SELECT coalesce(sum(precip_mm), 0) FROM conditions WHERE site_id=$1 AND ts > now() - interval '24 hours'", site_id)
    q = await db.fetchval(
        "SELECT discharge FROM conditions WHERE site_id=$1 AND discharge IS NOT NULL ORDER BY ts DESC LIMIT 1", site_id)
    mean = discharge_mean.get(site_id)
    if precip > 50 or (q and mean and q > 2.5 * mean):
        await open_or_extend_alert(site_id, "flood_warning", REFRESH_SECONDS,
                                   {"precip_24h_mm": round(precip, 1), "discharge": q, "discharge_mean_90d": mean})


async def on_strike(ts, lat, lon, source):
    """Lightning rule. Store the strike against every site, stop work for every site within 10 miles."""
    opened = []
    rows = [(ts, lat, lon, source, s["site_id"], haversine_m(lat, lon, s["lat"], s["lon"])) for s in SITES.values()]
    await db.get_pool().executemany("INSERT INTO strikes VALUES ($1,$2,$3,$4,$5,$6)", rows)
    for *_, site_id, d in rows:
        if d >= STOPWORK_RADIUS_M:
            continue
        await db.execute("INSERT INTO events VALUES ($1,$2,$3,'strike',$4)", ts, site_id, source,
                         {"lat": lat, "lon": lon, "distance_m": d})
        opened.append(await open_or_extend_alert(site_id, "stopwork", STOPWORK_SECONDS,
                                                 {"distance_m": round(d), "source": source}, at=ts))
        if SITES[site_id]["beacon"]:
            await gateway.send(site_id, {"cmd": "STOPWORK", "seconds": STOPWORK_SECONDS,
                                         "distance_m": round(d), "source": source})
    return opened


async def expiry_loop():
    """Stop work expiry. An expired stopwork stays open as awaiting_clear until a supervisor clears it.
    Other alerts with an expiry clear themselves once their readings stop refreshing them."""
    while True:
        try:
            rows = await db.fetch(
                "UPDATE alerts SET payload = payload || '{\"awaiting_clear\": true}'::jsonb"
                " WHERE type='stopwork' AND cleared IS NULL AND expires < now()"
                " AND NOT coalesce((payload->>'awaiting_clear')::bool, false) RETURNING *")
            rows += await db.fetch(
                "UPDATE alerts SET cleared=now(), cleared_by='expired'"
                " WHERE type<>'stopwork' AND cleared IS NULL AND expires < now() RETURNING *")
            for r in rows:
                await hub.publish(r["site_id"], {"type": "alert", "alert": alert_json(r)})
        except Exception:
            log.exception("expiry loop")
        await asyncio.sleep(5)
