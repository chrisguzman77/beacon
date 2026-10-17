"""Check ins, zone presence, and the muster list. Roblox players become crew rows (auth0_sub roblox:<name>)."""
import asyncio
import logging
import time
from collections import defaultdict

from . import db, gateway, hub, rules

log = logging.getLogger("core.muster")
ZONE_CLEAR_SECONDS = 10

# site_id -> {source: count}. The zone is occupied if any source sees someone.
presence: dict[int, dict[str, int]] = defaultdict(dict)
_zero_since: dict[int, float] = {}


def set_presence(site_id, source, count):
    presence[site_id][source] = count
    if any(presence[site_id].values()):
        _zero_since.pop(site_id, None)
    else:
        _zero_since.setdefault(site_id, time.monotonic())


def zone_clear(site_id):
    t = _zero_since.get(site_id)
    return t is not None and time.monotonic() - t >= ZONE_CLEAR_SECONDS


async def roster(site_id):
    rows = await db.fetch(
        "SELECT c.crew_id, c.name, c.auth0_sub, k.action FROM crew c LEFT JOIN LATERAL"
        " (SELECT action FROM checkins WHERE crew_id=c.crew_id AND site_id=$1 AND ts > now() - interval '24 hours'"
        "  ORDER BY ts DESC LIMIT 1) k ON true WHERE c.site_id=$1 ORDER BY c.crew_id", site_id)
    return {"in": [r["name"] for r in rows if r["action"] == "in"],
            "out": [r["name"] for r in rows if r["action"] != "in"],
            "zone_clear": zone_clear(site_id)}


async def push(site_id):
    r = await roster(site_id)
    await gateway.send(site_id, {"cmd": "MUSTER", "in": r["in"], "out": r["out"]})
    await hub.publish(site_id, {"type": "muster", **r})
    return r


async def checkin(site_id, crew_id, action, via, ts=None, extra=None):
    ts = ts or rules.now()
    await db.execute("INSERT INTO checkins VALUES ($1,$2,$3,$4)", ts, site_id, crew_id, action)
    await db.execute("INSERT INTO events VALUES ($1,$2,$3,'checkin',$4)", ts, site_id,
                     "sim" if via == "roblox" else "crew" if via == "phone" else "beacon",
                     {"crew_id": crew_id, "action": action, "via": via, **(extra or {})})


async def remote_checkin(site_id, crew_number, action=None, ts=None):
    """IR remote digit N is crew member N of the site in crew_id order, Roblox players excluded. No action toggles."""
    rows = await db.fetch("SELECT crew_id, name FROM crew WHERE site_id=$1 AND coalesce(auth0_sub, '') NOT LIKE 'roblox:%'"
                          " ORDER BY crew_id", site_id)
    if not 1 <= crew_number <= len(rows):
        log.info("site %s remote checkin for unknown crew_number %s", site_id, crew_number)
        return
    crew = rows[crew_number - 1]
    if action not in ("in", "out"):
        action = "out" if crew["name"] in (await roster(site_id))["in"] else "in"
    await checkin(site_id, crew["crew_id"], action, "remote", ts=ts, extra={"crew_number": crew_number})
    await push(site_id)


async def roblox_presence(site_id, users):
    """Players inside the ZonePart are checked in, players who left are checked out."""
    rows = await db.fetch("SELECT crew_id, name FROM crew WHERE site_id=$1 AND auth0_sub LIKE 'roblox:%'", site_id)
    ids = {r["name"]: r["crew_id"] for r in rows}
    for u in users:
        if u not in ids:
            ids[u] = await db.fetchval(
                "INSERT INTO crew (site_id, name, auth0_sub) VALUES ($1,$2,$3) RETURNING crew_id", site_id, u, f"roblox:{u}")
    current = set((await roster(site_id))["in"])
    changed = False
    for name, cid in ids.items():
        want_in = name in users
        if want_in != (name in current):
            await checkin(site_id, cid, "in" if want_in else "out", "roblox", extra={"roblox_user": name})
            changed = True
    if changed:
        await push(site_id)


async def zone_loop():
    """Muster rule. During stop work, presence 0 for 10 s sets zone_clear on the alert."""
    while True:
        try:
            for a in await db.fetch("SELECT * FROM alerts WHERE type='stopwork' AND cleared IS NULL"):
                sid, p = a["site_id"], a["payload"] or {}
                clear = zone_clear(sid)
                if clear != bool(p.get("zone_clear")):
                    p["zone_clear"] = clear
                    p["crew_in"] = (await roster(sid))["in"] if clear else []
                    r = await db.fetchrow("UPDATE alerts SET payload=$2 WHERE alert_id=$1 RETURNING *", a["alert_id"], p)
                    await hub.publish(sid, {"type": "alert", "alert": rules.alert_json(r)})
                    await push(sid)
        except Exception:
            log.exception("zone loop")
        await asyncio.sleep(2)
