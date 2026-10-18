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
- 2026-10-17 Viet: Open-Meteo forecast every 15 min and flood hourly, not 5 min, to stay under the free 10k calls a day with 50 sites.
- deploy: public address is https://api.omnirisking-it-all-at-swamphacks.us (Caddy on the Vultr box, Let's Encrypt, config in deploy/Caddyfile), replacing the trycloudflare quick tunnel whose address changed on every restart. Bare domain is reserved for the web app.
- intel: 7.2 hose photo tags as equipment (trip hazard, confidence 0.85, JPEG and HEIC), never downed_line. Accepted: the guide expected standing_water or other, but the safety property the test protects (no false downed_line) holds.
- intel: Gemini calls go through a queue, at most 4 in flight. 429/500/503 are retried: up to ~3 minutes for briefings (the 6 PM burst queues instead of falling back), one short retry for photo tags and the index sentence. An exhausted daily quota falls back to the template immediately. The free tier allows gemini-3.8-flash only 20 requests a day per project.
- intel: Gemini project moved to paid Tier 1 (billing on, budget alert recommended) because the free tier's 20 requests a day could not cover 50 briefings. Verified: 8 concurrent briefings all came from Gemini with no invented numbers.
- core: POST /supervisor/pin {pin} -> {ok} checks a typed supervisor PIN for any signed in user (crew phone Change site), constant time compare, a wrong PIN answers after 1 s. The FEMA flood zone (sfha, flood_zone) comes from intel/model/site_static.json and is attached to SITES in memory at load, so GET /sites and /sites/{id} carry it with no database write (the sites.sfha column stays unfilled). (Chris, 2026-10-17)
- core, site twin scenarios (Chris, 2026-10-18): /sim/water also sends the beacon WATER pct (depth_mm x 2.5, so 40 mm reads 100%); flood_confirmed follows the latest beacon or sim depth in the last 10 min and clears at 0 instead of waiting out the hour; /sim/weather gust is mph (stored km/h), raising wind_warning at 28 mph and wind_danger at 40 (the World's AERIAL_GUST and STOP_GUST, dashboard only); /sim/reset sends CLEAR when a stopwork or heat_danger was open and always WATER 0; POST /sim/wildlife files a no photo hazard report 60 m east of the site (tag alligator) plus a sim wildlife event, since the dashboard's wildlife factor reads reports; REST carries heat_index_f.
