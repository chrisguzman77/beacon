"""REST and the site websocket. contracts/api.md."""
from fastapi import APIRouter, HTTPException, WebSocket

from . import db, fetchers, gateway, hub, muster
from .rules import alert_json
from .sites import SITES

router = APIRouter()


@router.get("/health")
async def health():
    return {"ok": True, "gateway": {sid: gateway.connected(sid) for sid in SITES if SITES[sid]["beacon"]},
            "fetchers": fetchers.health}


@router.get("/sites")
async def list_sites():
    alerts = await db.fetch("SELECT * FROM alerts WHERE cleared IS NULL")
    idx = await db.fetch("SELECT DISTINCT ON (site_id) site_id, index FROM hazard_index ORDER BY site_id, for_date DESC")
    idx = {r["site_id"]: r["index"] for r in idx}
    crew_in = await db.fetch(
        "SELECT site_id, count(*) AS n FROM (SELECT DISTINCT ON (crew_id) site_id, action FROM checkins"
        " WHERE ts > now() - interval '24 hours' ORDER BY crew_id, ts DESC) k WHERE action='in' GROUP BY site_id")
    crew_in = {r["site_id"]: r["n"] for r in crew_in}
    out = []
    for s in SITES.values():
        out.append({**s, "index": idx.get(s["site_id"]),
                    "alerts": [alert_json(a) for a in alerts if a["site_id"] == s["site_id"]],
                    "crew_on_site": crew_in.get(s["site_id"], 0)})
    return out


@router.get("/sites/{site_id}")
async def site_detail(site_id: int):
    s = SITES.get(site_id)
    if not s:
        raise HTTPException(404, "unknown site")
    alerts = await db.fetch("SELECT * FROM alerts WHERE site_id=$1 AND cleared IS NULL ORDER BY alert_id", site_id)
    history = await db.fetch("SELECT * FROM alerts WHERE site_id=$1 ORDER BY alert_id DESC LIMIT 50", site_id)
    idx = await db.fetchrow("SELECT * FROM hazard_index WHERE site_id=$1 ORDER BY for_date DESC LIMIT 1", site_id)
    brief = await db.fetchrow("SELECT * FROM briefings WHERE site_id=$1 ORDER BY for_date DESC LIMIT 1", site_id)
    reports = await db.fetch("SELECT * FROM reports WHERE site_id=$1 ORDER BY ts DESC LIMIT 20", site_id)
    return {**s,
            "alerts": [alert_json(a) for a in alerts],
            "alert_history": [alert_json(a) for a in history],
            "index": dict(idx) if idx else None,
            "briefing": dict(brief) if brief else None,
            "reports": [dict(r) for r in reports],
            "device": gateway.last_state.get(site_id, {"online": False})}


@router.get("/sites/{site_id}/device")
async def site_device(site_id: int):
    return gateway.last_state.get(site_id, {"online": False})


@router.get("/sites/{site_id}/muster")
async def site_muster(site_id: int):
    return await muster.roster(site_id)


@router.websocket("/ws/site/{site_id}")
async def site_ws(ws: WebSocket, site_id: int, token: str = ""):
    await ws.accept()
    hub.subscribe(site_id, ws)
    try:
        if site_id in gateway.last_state:
            await ws.send_json({"type": "device", **gateway.last_state[site_id]})
        while True:
            await ws.receive_text()  # clients do not send anything; this just waits for disconnect
    except Exception:  # WebSocketDisconnect, or Starlette's not-connected error after a failed send
        pass
    finally:
        hub.unsubscribe(site_id, ws)
