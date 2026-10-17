import json
import logging
from pathlib import Path

import asyncpg

from .config import settings

log = logging.getLogger("core.db")
_pool: asyncpg.Pool | None = None


async def _init_conn(conn):
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def connect():
    global _pool
    _pool = await asyncpg.create_pool(settings.database_url, min_size=4, max_size=10, init=_init_conn)


async def close():
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    """Shared pool, also used by intel (contracts/intel-interface.md)."""
    return _pool


async def init_schema():
    async with _pool.acquire() as conn:
        if await conn.fetchval("SELECT to_regclass('public.sites')"):
            return
        log.info("creating schema")
        # Continuous aggregates cannot be created inside a transaction, so run statement by statement.
        sql = (Path(__file__).parent / "schema.sql").read_text()
        lines = [l for l in sql.splitlines() if not l.strip().startswith("--")]
        for stmt in "\n".join(lines).split(";"):
            if stmt.strip():
                await conn.execute(stmt)


async def execute(q, *args):
    return await _pool.execute(q, *args)


async def fetch(q, *args):
    return await _pool.fetch(q, *args)


async def fetchrow(q, *args):
    return await _pool.fetchrow(q, *args)


async def fetchval(q, *args):
    return await _pool.fetchval(q, *args)
