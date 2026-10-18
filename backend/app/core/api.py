"""REST and the site websocket. contracts/api.md."""
import asyncio
import secrets
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, WebSocket
from pydantic import BaseModel

from app import intel

from . import db, fetchers, gateway, hub, muster, rules
from .auth import get_user, require_supervisor
from .config import settings
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


async def _conditions(site_id, hours):
    rows = await db.fetch("SELECT bucket AS ts, heat_max, precip, gust_max, soil, water FROM site_hourly"
                          " WHERE site_id=$1 AND bucket > now() - make_interval(hours => $2) ORDER BY bucket",
                          site_id, hours)
    return [dict(r) for r in rows]


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
            "conditions": await _conditions(site_id, 48),
            "alerts": [alert_json(a) for a in alerts],
            "alert_history": [alert_json(a) for a in history],
            "index": dict(idx) if idx else None,
            "briefing": dict(brief) if brief else None,
            "reports": [dict(r) for r in reports],
            "device": gateway.last_state.get(site_id, {"online": False})}


@router.get("/sites/{site_id}/conditions")
async def site_conditions(site_id: int, hours: int = 48):
    if site_id not in SITES:
        raise HTTPException(404, "unknown site")
    return await _conditions(site_id, min(hours, 24 * 30))


@router.get("/sites/{site_id}/device")
async def site_device(site_id: int):
    return gateway.last_state.get(site_id, {"online": False})


@router.get("/sites/{site_id}/muster")
async def site_muster(site_id: int):
    return await muster.roster(site_id)


@router.get("/me")
async def me(user=Depends(get_user)):
    return user


async def _crew_for(site_id, user, name=None):
    """The crew row for this Auth0 user at this site, created on first use."""
    cid = await db.fetchval("SELECT crew_id FROM crew WHERE site_id=$1 AND auth0_sub=$2", site_id, user["sub"])
    if cid is None:
        cid = await db.fetchval("INSERT INTO crew (site_id, name, auth0_sub) VALUES ($1,$2,$3) RETURNING crew_id",
                                site_id, name or user["sub"].split("|")[-1], user["sub"])
    return cid


class CheckinIn(BaseModel):
    site_id: int
    action: str
    lat: float | None = None
    lon: float | None = None
    via: str = "phone"
    name: str | None = None


@router.post("/checkin")
async def post_checkin(body: CheckinIn, user=Depends(get_user)):
    if body.site_id not in SITES or body.action not in ("in", "out"):
        raise HTTPException(422, "unknown site or action")
    cid = await _crew_for(body.site_id, user, body.name)
    await muster.checkin(body.site_id, cid, body.action, body.via, extra={"lat": body.lat, "lon": body.lon})
    return await muster.push(body.site_id)


@router.post("/reports")
async def post_report(photo: UploadFile = File(...), site_id: int = Form(...), lat: float | None = Form(None),
                      lon: float | None = Form(None), note: str = Form(""), user=Depends(get_user)):
    site = SITES.get(site_id)
    if not site:
        raise HTTPException(404, "unknown site")
    data = await photo.read()
    mime = photo.content_type or "image/jpeg"
    name = f"{uuid.uuid4().hex}{Path(photo.filename or '').suffix or '.jpg'}"
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    (Path(settings.upload_dir) / name).write_bytes(data)
    tag = await intel.tag_photo(data, mime, site["name"])
    cid = await _crew_for(site_id, user)
    r = await db.fetchrow(
        "INSERT INTO reports (site_id,ts,crew_id,lat,lon,photo_path,tag,description,confidence,note)"
        " VALUES ($1,now(),$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        site_id, cid, lat, lon, f"/uploads/{name}", tag["tag"], tag["description"], tag["confidence"], note)
    payload = {"report_id": r["report_id"], "tag": tag["tag"], "description": tag["description"], "lat": lat, "lon": lon}
    await db.execute("INSERT INTO events VALUES ($1,$2,'crew','hazard_report',$3)", r["ts"], site_id, payload)
    await hub.publish(site_id, {"type": "report", **payload, "photo_path": r["photo_path"], "ts": r["ts"].isoformat()})
    return {"report_id": r["report_id"], **tag, "photo_path": r["photo_path"]}


class ClearIn(BaseModel):
    pin: str
    by: str | None = None


@router.post("/alerts/{alert_id}/clear")
async def clear_alert(alert_id: int, body: ClearIn, user=Depends(require_supervisor)):
    if not secrets.compare_digest(body.pin, settings.supervisor_pin):
        raise HTTPException(403, "wrong PIN")
    by = body.by or "Supervisor"
    r = await db.fetchrow("UPDATE alerts SET cleared=now(), cleared_by=$2 WHERE alert_id=$1 AND cleared IS NULL RETURNING *",
                          alert_id, by)
    if not r:
        raise HTTPException(404, "no open alert with that id")
    await hub.publish(r["site_id"], {"type": "alert", "alert": alert_json(r)})
    if r["type"] == "stopwork" and SITES[r["site_id"]]["beacon"]:
        await gateway.send(r["site_id"], {"cmd": "CLEAR", "by": by})
    return alert_json(r)


class PinIn(BaseModel):
    pin: str


@router.post("/supervisor/pin")
async def check_pin(body: PinIn, user=Depends(get_user)):
    """A typed supervisor PIN, for Change site on a crew phone. A wrong PIN waits 1 s to slow guessing."""
    ok = secrets.compare_digest(body.pin.encode(), settings.supervisor_pin.encode())
    if not ok:
        await asyncio.sleep(1)
    return {"ok": ok}


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
