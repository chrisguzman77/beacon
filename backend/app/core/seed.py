"""Demo seed, run by hand: python -m app.core.seed (from backend/). Safe to run twice.
Crew for the beacon site (remote digits 1 to 5 in this order) and two sample hazard reports.
Conditions are not seeded: the forecast fetcher writes the last 24 real hours for every site on boot."""
import asyncio

from . import db, sites
from .config import settings

CREW = ["Viet", "Chris", "Cam", "Slavik", "Visitor"]
REPORTS = [
    ("alligator", "Adult alligator sunning on the bank near the east culvert, about 30 ft from the work zone.", 0.91),
    ("downed_line", "Low hanging conductor across the access road after last night's wind.", 0.84),
]


async def main():
    await db.connect()
    await db.init_schema()
    await sites.load()
    sid = settings.beacon_site_id
    site = sites.SITES[sid]
    have = {r["name"] for r in await db.fetch("SELECT name FROM crew WHERE site_id=$1 AND auth0_sub IS NULL", sid)}
    for name in CREW:
        if name not in have:
            await db.execute("INSERT INTO crew (site_id, name) VALUES ($1,$2)", sid, name)
    if not await db.fetchval("SELECT count(*) FROM reports WHERE site_id=$1 AND note='seed'", sid):
        for i, (tag, desc, conf) in enumerate(REPORTS):
            lat, lon = site["lat"] + 0.002 * (i + 1), site["lon"] - 0.002
            rid = await db.fetchval(
                "INSERT INTO reports (site_id,ts,lat,lon,tag,description,confidence,note)"
                " VALUES ($1, now() - interval '3 hours' * $2, $3,$4,$5,$6,$7,'seed') RETURNING report_id",
                sid, i + 1, lat, lon, tag, desc, conf)
            await db.execute("INSERT INTO events VALUES (now(),$1,'crew','hazard_report',$2)", sid,
                             {"report_id": rid, "tag": tag, "description": desc, "lat": lat, "lon": lon})
    print(f"seeded site {sid} ({site['name']}): crew {CREW}, {len(REPORTS)} reports")
    await db.close()


if __name__ == "__main__":
    asyncio.run(main())
