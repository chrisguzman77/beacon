"""Jobs: feeds, the daily score, and the 6 PM next day briefing in each site's own timezone."""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app import intel

from . import fetchers, gateway, hub
from .sites import SITES

log = logging.getLogger("core.scheduler")
scheduler = AsyncIOScheduler(timezone="UTC")


async def briefing_job(site_id):
    """Intel writes the briefings row; core pushes it to the dashboard and has the beacon speak it."""
    try:
        result = await intel.run_briefing(site_id)
    except Exception:
        log.exception("briefing site %s", site_id)
        return None
    for_date = (datetime.now(ZoneInfo(SITES[site_id]["tz"])) + timedelta(days=1)).date().isoformat()
    await hub.publish(site_id, {"type": "briefing", "for_date": for_date, **result})
    if SITES[site_id]["beacon"]:
        await gateway.send(site_id, {"cmd": "BRIEFING", "english": result.get("english"),
                                     "spanish": result.get("spanish"), "for_date": for_date})
    log.info("briefing site %s for %s (%s)", site_id, for_date, result.get("source"))
    return result


def start():
    # Open-Meteo's free tier is 10k calls a day; 50 sites every 15 min stays under it
    scheduler.add_job(fetchers.fetch_forecast_all, "interval", minutes=15, next_run_time=datetime.now(ZoneInfo("UTC")),
                      max_instances=1, coalesce=True)
    scheduler.add_job(fetchers.fetch_flood_all, "interval", minutes=60, next_run_time=datetime.now(ZoneInfo("UTC")),
                      max_instances=1, coalesce=True)
    scheduler.add_job(intel.score_all, CronTrigger(hour=5, minute=0, timezone="UTC"))
    for s in SITES.values():
        scheduler.add_job(briefing_job, CronTrigger(hour=18, minute=0, timezone=s["tz"]), args=[s["site_id"]],
                          id=f"briefing-{s['site_id']}", misfire_grace_time=3600)
    scheduler.start()
    log.info("scheduler started, %d briefing jobs", len(SITES))
