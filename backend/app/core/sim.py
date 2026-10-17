"""Simulation ingest from Roblox and the mic listener. contracts/roblox-bridge.md and contracts/api.md."""
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from . import rules
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
