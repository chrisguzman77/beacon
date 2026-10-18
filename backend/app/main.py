import asyncio
import logging
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import intel
from app.core import api, db, gateway, muster, rules, scheduler, sim, sites
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logging.getLogger("apscheduler").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    await db.init_schema()
    await sites.load()
    tasks = [asyncio.create_task(rules.expiry_loop()), asyncio.create_task(muster.zone_loop())]
    scheduler.start()
    yield
    if scheduler.scheduler.running:
        scheduler.scheduler.shutdown(wait=False)
    for t in tasks:
        t.cancel()
    await db.close()


app = FastAPI(title="OmniRisk", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(api.router)
app.include_router(sim.router)
app.include_router(gateway.router)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
# intel.router lands with Chris's code (contracts/intel-interface.md)
if hasattr(intel, "router"):
    app.include_router(intel.router)
