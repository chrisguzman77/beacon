import csv
import json
import logging
from pathlib import Path

from timezonefinder import TimezoneFinder

from . import db
from .config import settings

log = logging.getLogger("core.sites")
CSV = Path(__file__).parent / "data" / "sites.csv"
# FEMA flood zone per site (sfha, fld_zone), fetched once by ml/ and shipped with the model.
STATIC = Path(__file__).parents[1] / "intel" / "model" / "site_static.json"

# site_id -> dict, loaded once at startup. Rules and sim read this, not the database.
SITES: dict[int, dict] = {}


def _bool(v):
    return str(v).strip().lower() in ("1", "true", "t", "yes", "y")


async def load():
    """Upsert every boot so the CSV stays the source of truth (Chris's 50 sites replace the placeholder)."""
    tf = TimezoneFinder()
    with open(CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        lat, lon = float(r["lat"]), float(r["lon"])
        await db.execute(
            "INSERT INTO sites (site_id,name,state,county,lat,lon,tz,tech,mw,coastal,river,beacon)"
            " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (site_id) DO UPDATE SET"
            " name=EXCLUDED.name, state=EXCLUDED.state, county=EXCLUDED.county, lat=EXCLUDED.lat, lon=EXCLUDED.lon,"
            " tz=EXCLUDED.tz, tech=EXCLUDED.tech, mw=EXCLUDED.mw, coastal=EXCLUDED.coastal, river=EXCLUDED.river,"
            " beacon=EXCLUDED.beacon",
            int(r["site_id"]), r["name"], r["state"], r["county"], lat, lon,
            r.get("tz") or tf.timezone_at(lat=lat, lng=lon), r["tech"], float(r["mw"] or 0),
            _bool(r["coastal"]), _bool(r["river"]), int(r["site_id"]) == settings.beacon_site_id)
    log.info("loaded %d sites from %s", len(rows), CSV.name)
    SITES.clear()
    for r in await db.fetch("SELECT * FROM sites ORDER BY site_id"):
        SITES[r["site_id"]] = dict(r)
    # Kept in memory, not written to the table: GET /sites and /sites/{id} carry sfha and flood_zone.
    static = json.loads(STATIC.read_text())
    for sid, s in SITES.items():
        z = static.get(str(sid), {})
        s["sfha"], s["flood_zone"] = z.get("sfha", s["sfha"]), z.get("fld_zone")
