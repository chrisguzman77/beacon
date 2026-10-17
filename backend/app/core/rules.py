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
    expires = at + timedelta(seconds=seconds)
    row = await db.fetchrow(
        "SELECT * FROM alerts WHERE site_id=$1 AND type=$2 AND cleared IS NULL ORDER BY alert_id DESC LIMIT 1",
        site_id, type_)
    if row:
        p = row["payload"] or {}
        p.update(payload)
        p["awaiting_clear"] = False
        p["resets"] = p.get("resets", 0) + 1
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
    """Stop work expiry. An expired stopwork stays open as awaiting_clear until a supervisor clears it."""
    while True:
        try:
            rows = await db.fetch(
                "UPDATE alerts SET payload = payload || '{\"awaiting_clear\": true}'::jsonb"
                " WHERE type='stopwork' AND cleared IS NULL AND expires < now()"
                " AND NOT coalesce((payload->>'awaiting_clear')::bool, false) RETURNING *")
            for r in rows:
                await hub.publish(r["site_id"], {"type": "alert", "alert": alert_json(r)})
        except Exception:
            log.exception("expiry loop")
        await asyncio.sleep(5)
