import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import intel
from app.core import api, db, gateway, muster, rules, scheduler, sim, sites

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
    scheduler.scheduler.shutdown(wait=False)
    for t in tasks:
        t.cancel()
    await db.close()


app = FastAPI(title="PlanIT Beacon", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(api.router)
app.include_router(sim.router)
app.include_router(gateway.router)
# intel.router lands with Chris's code (contracts/intel-interface.md)
if hasattr(intel, "router"):
    app.include_router(intel.router)
