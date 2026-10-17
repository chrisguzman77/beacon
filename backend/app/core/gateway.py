"""The Pi gateway connection. contracts/gateway-ws.md is the source of truth for messages."""
import logging
import secrets
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from . import db, hub, rules
from .config import settings

log = logging.getLogger("core.gateway")
router = APIRouter()

_conns: dict[int, WebSocket] = {}
# Last "state" message per site, served at GET /sites/{id}/device. Memory only, Roblox polls it every second.
last_state: dict[int, dict] = {}
_last_presence: dict[int, int] = {}


def connected(site_id):
    return site_id in _conns


async def send(site_id, msg):
    ws = _conns.get(site_id)
    if not ws:
        return False
    try:
        await ws.send_json(msg)
        return True
    except Exception:
        _conns.pop(site_id, None)
        return False


def _ts(msg):
    """Replayed messages keep their original time."""
    try:
        return datetime.fromisoformat(msg["ts"])
    except Exception:
        return rules.now()


async def _pod(site_id, m):
    ts = _ts(m)
    # W is the pod's 0..100 water level; anything above 0 means water at the beacon.
    await db.execute(
        "INSERT INTO conditions (ts,site_id,source,temp_c,humidity,water_depth_mm) VALUES ($1,$2,'beacon',$3,$4,$5)"
        " ON CONFLICT DO NOTHING", ts, site_id, m.get("T"), m.get("H"), m.get("W"))
    p = int(m.get("P", 0))
    if _last_presence.get(site_id) != p:
        _last_presence[site_id] = p
        payload = {"count": p, "still_energy": m.get("S"), "moving_energy": m.get("M"), "distance_cm": m.get("D")}
        await db.execute("INSERT INTO events VALUES ($1,$2,'beacon','presence',$3)", ts, site_id, payload)
        await hub.publish(site_id, {"type": "presence", **payload})


async def _local_stopwork(site_id, m):
    ts = _ts(m)
    payload = {"distance_m": m.get("distance_m"), "flash_ts_us": m.get("flash_ts_us"), "bang_ts_us": m.get("bang_ts_us")}
    await db.execute("INSERT INTO events VALUES ($1,$2,'beacon','local_stopwork',$3)", ts, site_id, payload)
    await db.execute("INSERT INTO strikes (ts,source,site_id,distance_m) VALUES ($1,'beacon',$2,$3)",
                     ts, site_id, m.get("distance_m"))
    await rules.open_or_extend_alert(site_id, "stopwork", rules.STOPWORK_SECONDS,
                                     {"distance_m": m.get("distance_m"), "source": "beacon"}, at=ts)


async def _handle(site_id, m):
    kind = m.get("kind")
    if kind == "state":
        last_state[site_id] = {k: v for k, v in m.items() if k != "kind"}
        await hub.publish(site_id, {"type": "device", **last_state[site_id]})
    elif kind == "pod":
        await _pod(site_id, m)
    elif kind == "local_stopwork":
        await _local_stopwork(site_id, m)
    elif kind == "count":
        await hub.publish(site_id, {"type": "count", "seconds": m.get("seconds")})
    elif kind == "estop":
        await db.execute("INSERT INTO events VALUES ($1,$2,'beacon','estop','{}')", _ts(m), site_id)
        await hub.publish(site_id, {"type": "estop"})
    elif kind == "pin":
        # The Pi already checked the PIN and released locally; ok false is logged only.
        if m.get("ok"):
            await rules.clear_alerts(site_id, "Supervisor PIN at beacon")
        else:
            log.info("site %s bad PIN at beacon", site_id)
    else:
        log.info("site %s gateway %s not handled yet", site_id, kind)


@router.websocket("/ws/gateway/{site_id}")
async def gateway_ws(ws: WebSocket, site_id: int, token: str = ""):
    if not secrets.compare_digest(token, settings.gateway_token):
        await ws.close(code=1008)
        return
    await ws.accept()
    _conns[site_id] = ws
    log.info("gateway %s connected", site_id)
    crew = await db.fetch("SELECT crew_id AS id, name FROM crew WHERE site_id=$1 ORDER BY crew_id", site_id)
    await ws.send_json({"cmd": "CREW", "crew": [dict(r) for r in crew]})
    try:
        while True:
            m = await ws.receive_json()
            try:
                await _handle(site_id, m)
            except Exception:
                log.exception("gateway %s message %s", site_id, m)
    except WebSocketDisconnect:
        pass
    finally:
        if _conns.get(site_id) is ws:
            _conns.pop(site_id)
            if site_id in last_state:
                last_state[site_id]["online"] = False
        log.info("gateway %s disconnected", site_id)
