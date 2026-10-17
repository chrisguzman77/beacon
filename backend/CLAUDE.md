# backend

Two owners, one app. Viet owns app/core (database, sites loader, fetchers, rules engine, scheduler, websocket hub, Auth0, the gateway endpoint, sim ingest, main.py, deployment). Chris owns app/intel (hazard index scoring, the 6 PM briefing, Gemini photo tagging, the index explanation). The boundary is contracts/intel-interface.md: core calls three intel functions and includes one intel router, intel writes three tables that core created. Neither edits the other's folder.

Guide: docs/platform-guide.md (core, follow its Build order paragraph, not the section numbers) and docs/ai-ml-guide.md (intel). Viet's Roblox Bridge is docs/simulator-guide.md section 4.

Suggested stack, with alternatives to discuss with the human if they prefer otherwise:
- FastAPI with asyncpg and websockets. Alternative: Node with Fastify and ws, same contracts, if Viet is faster in TypeScript. Pros of FastAPI: the ML and Gemini code is Python, one language in this folder. Pros of Node: shared types with web.
- Tiger Data (PostgreSQL plus TimescaleDB) as the only database, for the MLH challenge and because the data is time series. Alternative: plain Postgres on Supabase if Tiger signup fails, same SQL minus the hypertable lines.
- APScheduler for the 5 minute fetch loop and the 6 PM per timezone jobs.
- Auth0 for supervisor and crew sign in, verified with PyJWT against the tenant's JWKS. Crew uses passwordless.

Run: scripts/dev.sh backend. Env: see contracts/env.md.

Must be public (Vultr or a tunnel) before the Roblox bridge or the Pi can be tested. Chris handles Vultr.

Build order for core, because the Pi and the Roblox bridge need the backend before anything else does: schema and sites loader, rules and alerts, the /sim/* routes, /ws/gateway and GET /sites/{id}/device, the site websocket, then deploy with Chris the moment it boots even with no fetchers. Then Viet switches to the Luau Bridge in sim/src/Bridge for a couple of hours. Then fetchers, scheduler, Auth0, briefing hooks. If core is behind at Saturday noon, Chris takes the fetchers (each is a function returning events, the most separable chunk).

## Decisions
(append one line per decision, newest last)
- 2026-10-17 Viet: FastAPI + asyncpg for core (one language with intel).
- 2026-10-17 Viet: Tiger Data as the database; local dev against the timescale/timescaledb Docker image until the Tiger service exists.
- intel: GEMINI_MODEL is gemini-3.8-flash. The guide's gemini-2.5-flash returns 404 for new API keys (checked against the live model list).
