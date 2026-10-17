# PlanIT Beacon

## Platform Build Guide

*PlanIT Beacon, SwampHacks XII*

Version 2, October 2026. Markdown edition for the repo. Web app moved to docs/web-guide.md, simulator ingest updated for the Roblox bridge.

This guide covers the backend core of PlanIT Beacon, the database, the fetchers, the rules engine, the scheduler, the 6 PM briefing hook, the connection to the physical beacon and to the Roblox simulator, hosting, and the MLH integrations (Tiger Data, Auth0, Vultr). It is written for Viet, who owns backend/app/core, step by step, with a test at the end of each step and every URL, parameter, and message format spelled out. The hazard index, briefing text, and photo tagging are Chris's, in backend/app/intel, and this guide only shows where core calls them. Where this guide and a file in contracts/ disagree, the contract wins.

**Build order for this weekend.** The Pi and the Roblox bridge both need a public backend before anything else does, so do the sections in this order, not the numbered order. Section 2 schema. Section 3.2 sites. Section 3.5 rules. Section 3.10 sim ingest. Section 3.9 gateway endpoint and GET /sites/{id}/device. The site websocket in 3.7. Then section 5, deploy with Chris the moment it boots, even with no fetchers. Then switch to the Luau Bridge in sim/src/Bridge (docs/simulator-guide.md section 4) for a couple of hours. Then come back for 3.3 fetchers, 3.6 scheduler, 3.8 Auth0, and section 6.

# 1. Read this first

The platform is one backend, one database, and one web app with three faces (supervisor dashboard, crew phone page, beacon kiosk). Everything that happens, whether it came from a weather feed, the physical beacon, the simulator, or a crew member's phone, becomes the same kind of event in the same table, and one rules engine reads that table. That single rule is what makes the live beacon site, the 49 feed only sites, and the simulated scenarios all behave identically.

## 1.1 The checklist the challenge judges hold

| **Requirement** | **Where it lives** | **How a judge sees it** |
|---|---|---|
| At least 50 real power plant sites | sites table from EIA-860M | The map |
| One combined risk picture per site | conditions table plus the site page | Click any site |
| Lightning within 10 miles, stop work, 30 minute reset | rules engine, lightning rule | Storm scenario, the countdown resets on the second strike |
| Flood warning for river sites after heavy rain | rules engine, flood rule | Flood scenario |
| Daily 6 PM next day briefing | scheduler job per site timezone | Briefing panel, Run now button |
| Crew hazard reporting with photo and map pin | crew page, reports table | Gator scenario, a judge files one |
| Supervisor dashboard ranking sites | ranked list and colored map | The first screen |
| Hazard index 0 to 10 from ML | hazard_index table, scored daily | Number on every site with three reasons |

## 1.2 Repository layout

```
backend/
  app/
    main.py                 app, routers, startup (Viet)
    core/                   Viet. db, sites, fetchers, rules, scheduler, hub, auth, gateway, sim
      data/sites.csv        committed, produced by Chris from EIA-860M
    intel/                  Chris. scoring, briefing, tagging, router (see docs/ai-ml-guide.md)
  requirements.txt
  Dockerfile
web/                        Cam (see docs/web-guide.md)
sim/                        Slavik and Viet (see docs/simulator-guide.md)
firmware/                   Slavik, pod, controlbox, gateway (see docs/hardware-guide.md)
ml/                         Chris, training pipeline (see docs/ai-ml-guide.md)
contracts/                  the interfaces, read before writing anything that crosses a folder
deploy/docker-compose.yml   backend and web containers, env from the repo root .env
```

## 1.3 Accounts to create tonight

| **Service** | **What for** | **What you get** | **Time** |
|---|---|---|---|
| Tiger Cloud (Timescale) | The database | A Postgres connection string with TimescaleDB enabled | 5 min |
| Auth0 | Sign in, roles, passwordless | Domain, client id, API audience | 10 min |
| Google AI Studio | Gemini API key | GEMINI_API_KEY | 3 min |
| MapTiler Cloud (Cam) | Terrain and satellite tiles for the dashboard map | VITE_MAPTILER_KEY | 3 min |
| Vultr (Chris, existing account with MLH credits) | A VM with a public IP | Ubuntu server | 15 min |
| Cloudflare (optional) | Tunnel if Vultr is slow | cloudflared token | 10 min |

Tiger Cloud and Auth0 are Viet's to create. Put the values in the repo root .env (copied from .env.example), never commit it, and paste GATEWAY_TOKEN and SIM_TOKEN to Slavik in the team chat once Chris generates them (openssl rand -hex 24).

# 2. Database on Tiger Data

Tiger Data is PostgreSQL with the TimescaleDB extension. Three tables become hypertables (time partitioned), two continuous aggregates feed the dashboard, and compression keeps the free tier comfortable all weekend.

1. Create a service in Tiger Cloud. Copy the connection string into deploy/.env as DATABASE_URL.

2. Connect with psql or any client and run the schema below. TEST. `SELECT * FROM timescaledb_information.hypertables;` lists conditions, events, and strikes.

```
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE sites (site_id int PRIMARY KEY, name text, state text, county text, lat double precision, lon double precision,
  tz text, tech text, mw double precision, coastal bool, river bool, sfha bool, beacon bool DEFAULT false);
CREATE TABLE crew (crew_id serial PRIMARY KEY, site_id int REFERENCES sites, name text, auth0_sub text, phone text);
CREATE TABLE conditions (ts timestamptz NOT NULL, site_id int NOT NULL, source text NOT NULL,
  temp_c real, humidity real, heat_index_f real, precip_mm real, soil real, discharge real, water_depth_mm real,
  wind_gust_kmh real, light smallint, PRIMARY KEY (site_id, ts, source));
SELECT create_hypertable('conditions', 'ts');
CREATE TABLE events (ts timestamptz NOT NULL, site_id int NOT NULL, source text NOT NULL, type text NOT NULL, payload jsonb);
SELECT create_hypertable('events', 'ts');
CREATE INDEX ON events (site_id, ts DESC);
CREATE TABLE strikes (ts timestamptz NOT NULL, lat double precision, lon double precision, source text, site_id int, distance_m real);
SELECT create_hypertable('strikes', 'ts');
CREATE TABLE alerts (alert_id serial PRIMARY KEY, site_id int, type text, started timestamptz, expires timestamptz, cleared timestamptz,
  cleared_by text, payload jsonb);
CREATE TABLE reports (report_id serial PRIMARY KEY, site_id int, ts timestamptz, crew_id int, lat double precision, lon double precision,
  photo_path text, tag text, description text, confidence real, note text);
CREATE TABLE briefings (site_id int, for_date date, generated timestamptz, english text, spanish text, payload jsonb, source text,
  PRIMARY KEY (site_id, for_date));
CREATE TABLE hazard_index (site_id int, for_date date, probability real, index smallint, top_features jsonb, PRIMARY KEY (site_id, for_date));
CREATE TABLE checkins (ts timestamptz NOT NULL, site_id int, crew_id int, action text);
SELECT create_hypertable('checkins', 'ts');
-- continuous aggregates for the dashboard
CREATE MATERIALIZED VIEW site_hourly WITH (timescaledb.continuous) AS
  SELECT site_id, time_bucket('1 hour', ts) AS bucket, max(heat_index_f) AS heat_max, sum(precip_mm) AS precip,
         max(wind_gust_kmh) AS gust_max, avg(soil) AS soil, max(water_depth_mm) AS water
  FROM conditions GROUP BY site_id, bucket;
SELECT add_continuous_aggregate_policy('site_hourly', start_offset => INTERVAL '3 days', end_offset => INTERVAL '10 minutes', schedule_interval => INTERVAL '10 minutes');
CREATE MATERIALIZED VIEW site_daily WITH (timescaledb.continuous) AS
  SELECT site_id, time_bucket('1 day', ts) AS bucket, max(heat_index_f) AS heat_max, sum(precip_mm) AS precip, max(wind_gust_kmh) AS gust_max
  FROM conditions GROUP BY site_id, bucket;
SELECT add_continuous_aggregate_policy('site_daily', start_offset => INTERVAL '30 days', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '1 hour');
-- compression
ALTER TABLE conditions SET (timescaledb.compress, timescaledb.compress_segmentby = 'site_id');
SELECT add_compression_policy('conditions', INTERVAL '1 day');
```

> **Note.** The beacon's readings and the feed's readings for the same site sit side by side in conditions, distinguished by source. The site page shows them as two lines on the same chart, which is the forecast versus measured view.

# 3. Backend

## 3.1 Skeleton

1. Python 3.11, `scripts/dev.sh backend` creates the venv and installs backend/requirements.txt.

2. Modules, all in backend/app/core/. db.py (asyncpg pool, exposes get_pool() which intel also uses), sites.py (loader), fetchers.py (one function per feed), rules.py (the engine), hub.py (websocket channels), auth.py (Auth0 JWT), scheduler.py (jobs), sim.py (simulation ingest), gateway.py (beacon connection and the last device state), api.py (the REST routes). backend/app/main.py creates the app, includes core's router and `intel.router`, starts the scheduler.

3. The three calls into intel, and nothing else (contracts/intel-interface.md). `await intel.score_all()` from the scheduler daily. `await intel.run_briefing(site_id)` from the 6 PM job. `await intel.tag_photo(image_bytes, mime, site_name)` inside POST /reports. Until Chris's code lands, `backend/app/intel/__init__.py` can hold three stubs returning fixed values so core runs end to end.

4. TEST. `uvicorn app.main:app --reload` from backend/ serves /docs with the routes listed in section 3.7.

## 3.2 Sites loader

1. On first start, if the sites table is empty, read backend/app/core/data/sites.csv (Chris commits it, columns site_id, name, state, county, lat, lon, tz, tech, mw, coastal, river) and insert the 50 rows. Mark the one site that has the physical beacon with beacon = true (the Florida site nearest Gainesville so the story is local). Its site_id goes in .env as BEACON_SITE_ID.

2. Until the real CSV lands, a hand written CSV with five Florida plants is enough to keep building. Do not wait on it.

3. TEST. GET /sites returns the rows with tz filled.

## 3.3 Fetchers

Each fetcher is an async function taking a site and returning rows for conditions, events, or strikes. The scheduler runs the set every five minutes with a two second stagger between sites. All of these are keyless.

| **Feed** | **Request** | **What to store** |
|---|---|---|
| Open-Meteo forecast | GET https://api.open-meteo.com/v1/forecast?latitude=&longitude=&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,precipitation_probability,wind_gusts_10m,soil_moisture_0_to_1cm&daily=temperature_2m_max,apparent_temperature_max,precipitation_sum,wind_gusts_10m_max&past_days=1&forecast_days=2&timezone=auto | The current hour into conditions with source feed. Keep the hourly arrays in memory for the briefing and the storm timing |
| Open-Meteo flood | GET https://flood-api.open-meteo.com/v1/flood?latitude=&longitude=&daily=river_discharge&past_days=90&forecast_days=3 | Today's discharge into conditions. Keep the 90 day mean per site for the flood rule |
| NWS alerts | GET https://api.weather.gov/alerts/active?point=LAT,LON with header User-Agent: PlanITBeacon (team email) | Each active alert as an event of type nws_alert with the headline and severity in payload |
| NOAA tides | Find the nearest station once from https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels, then GET https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&station=ID&date=latest&datum=MLLW&units=metric&time_zone=gmt&format=json | Water level for coastal sites into conditions as water_depth_mm only when above the station's flood threshold, otherwise an event of type tide_level |
| FEMA NFHL | Once per site at startup, the query in the ML guide section 2.5 | sites.sfha |
| iNaturalist | GET https://api.inaturalist.org/v1/observations?taxon_name=Alligator%20mississippiensis&lat=&lng=&radius=5&d1=DATE_30_DAYS_AGO&per_page=50 | Each observation as an event of type wildlife with species, date, and coordinates |
| Lightning (Blitzortung) | One websocket connection for the whole backend, best effort. Parse strikes with lat and lon | Into strikes with source feed, then the lightning rule computes distance to every site |

1. Write fetch_openmeteo first and run it for one site by hand. TEST. A row appears in conditions with a plausible heat index.

2. Add the others one at a time. Each one logs a single line per site per run, nothing noisier.

3. Wrap every fetcher in a try and except that logs and continues. A dead feed must never stop the loop.

> **Caution.** The Blitzortung community feed is throttled and sometimes blocks new connections. It is never demo critical. Lightning for the demo comes from the simulator and from the beacon's own flash to bang detection. If the feed fails, the dashboard simply shows no regional strikes.

## 3.4 Heat index

Compute heat index in Fahrenheit from temperature and relative humidity with the NWS Rothfusz regression (the formula is in the ML guide, section 4). Store it in conditions.heat_index_f. The thresholds the rules use are 103 (warning) and 115 (danger), which are the NWS caution and danger boundaries.

## 3.5 Rules engine

A background task that wakes on every new event or conditions row for a site and evaluates five rules. Rules create, extend, or clear rows in alerts and push a message on the site's channel.

| **Rule** | **Condition** | **Action** |
|---|---|---|
| Lightning | A strike with distance_m under 16093 to the site | Create alert type stopwork with expires = now + 1800 s, or if one is open, set expires = now + 1800 s. Send STOPWORK to the beacon if the site has one |
| Stop work expiry | An open stopwork alert whose expires has passed | Mark the alert awaiting_clear. The equipment stays locked until a supervisor clears it |
| Flood | site.river and (precip in the last 24 h over 50 mm or discharge over 2.5 times the 90 day mean), or beacon water_depth_mm over 0 | Create or refresh alert type flood_warning, or flood_confirmed when the beacon reports water |
| Heat | heat_index_f at or above 103 (warning) or 115 (danger), using the beacon's measured value for the beacon site and the feed value elsewhere | Create or refresh alert type heat_warning or heat_danger. For heat_danger send REST to the beacon |
| Tilt | Beacon event tilt with value 1 | Create alert type beacon_unsafe until a tilt 0 arrives |
| Muster | During stopwork, radar presence has been 0 for 10 s | Set alert payload zone_clear = true, list crew checked in but not out |

```
R_EARTH = 6371000.0
def haversine_m(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, asin, sqrt
    p1, p2 = radians(lat1), radians(lat2); dp = p2 - p1; dl = radians(lon2 - lon1)
    a = sin(dp/2)**2 + cos(p1)*cos(p2)*sin(dl/2)**2
    return 2 * R_EARTH * asin(sqrt(a))

async def on_strike(strike):
    for site in SITES:
        d = haversine_m(strike.lat, strike.lon, site.lat, site.lon)
        await db.execute('INSERT INTO strikes VALUES ($1,$2,$3,$4,$5,$6)', strike.ts, strike.lat, strike.lon, strike.source, site.site_id, d)
        if d < 16093:
            await open_or_extend_alert(site.site_id, 'stopwork', seconds=1800, payload={'distance_m': d, 'source': strike.source})
            await hub.publish(site.site_id, {'type': 'stopwork', 'distance_m': d, 'expires': now() + 1800})
            if site.beacon: await gateway.send(site.site_id, {'cmd': 'STOPWORK', 'seconds': 1800, 'distance_m': d})
```

1. TEST. `POST /sim/strike {"site_id": 7, "bearing": 270, "miles": 8}` creates a stopwork alert for site 7 with expires 30 minutes out. Post it again and expires moves forward. Post one at 15 miles and nothing happens.

## 3.6 Scheduler and the 6 PM briefing

1. APScheduler with an AsyncIOScheduler. Jobs. fetch_all every 5 minutes. `intel.score_all()` daily at 05:00 UTC. briefing per site, a cron job at 18:00 in each site's timezone, added at startup by looping the sites.

2. The briefing job is one line in core: `result = await intel.run_briefing(site_id)`. Intel builds the payload, calls Gemini, writes the briefings row, and returns {english, spanish, source}. Core then pushes it on the site channel and, if the site has a beacon, sends `{"cmd":"BRIEFING","english":...,"spanish":...}` to the gateway, which speaks it.

3. `POST /briefings/{site_id}/run` is intel's route (it is on intel.router), so the demo can trigger it on demand. Core does not need to add it.

4. TEST. Call POST /briefings/{BEACON_SITE_ID}/run. A briefing row appears with english and spanish, and the beacon speaks it.

## 3.7 REST and WebSocket surface

The full list is contracts/api.md. The ones core owns, in build order.

| **Method and path** | **Auth** | **Purpose** |
|---|---|---|
| GET /health | any | Each fetcher's last success time, gateway connected or not |
| GET /sites | any | All sites with current index, alert summary, last conditions, crew_on_site |
| GET /sites/{id} | any | Site detail, conditions for 48 h from site_hourly, alerts, reports, briefing, index with top features |
| GET /sites/{id}/conditions?hours=48 | any | Chart data from the continuous aggregate, feed and beacon sources |
| GET /sites/{id}/device | any | The last "state" message the gateway sent, as JSON. Roblox polls this once a second to mirror the real beacon, the dashboard shows it as the LIVE BEACON badge. Return {"online": false} if no gateway has connected |
| GET /sites/{id}/muster | any | Crew in, crew out, zone_clear |
| POST /checkin | crew or supervisor, or gateway relay | site_id, action in or out, lat, lon, via. Inserts into checkins, pushes muster. Check ins from the kiosk arrive on the gateway websocket instead (section 3.9) so they work offline |
| POST /reports | crew or supervisor | Multipart photo plus site_id, lat, lon, note. Saves the file under UPLOAD_DIR, calls `intel.tag_photo`, inserts, pushes a report event |
| POST /alerts/{id}/clear | supervisor | Body pin. Verifies against SUPERVISOR_PIN, sets cleared and cleared_by, sends CLEAR to the beacon |
| POST /sim/strike, /sim/weather, /sim/water, /sim/presence, /sim/bang | X-Token SIM_TOKEN | Simulation ingest, section 3.10 |
| WS /ws/site/{id}?token= | any | Pushes alerts, conditions, muster, reports, count echoes, device state, and the briefing when it is generated |
| WS /ws/gateway/{site_id}?token= | GATEWAY_TOKEN | The beacon connection, section 3.9 |

Intel's routes (GET /sites/{id}/index/explain, POST /briefings/{site_id}/run) come in through `intel.router`.

## 3.8 Auth0

1. In Auth0 create a Regular Web Application for the dashboard and crew page (single page app settings, allowed callback and logout URLs set to the Vultr domain and localhost:5173).

2. Create an API with an identifier like https://planit-beacon/api. This is the audience the SPA requests tokens for.

3. Enable the Passwordless connection with SMS or email for the crew. Enable Google social login for supervisors if wanted.

4. Add an Action on login that sets a custom claim https://planit-beacon/role to supervisor or crew based on app_metadata, defaulting to crew. Mark your own accounts as supervisor in the Auth0 user page.

5. In FastAPI verify the bearer token with PyJWT's PyJWKClient against https://DOMAIN/.well-known/jwks.json, check audience and issuer, and read the role claim. A dependency get_user returns sub and role, and a second dependency require_supervisor raises 403 otherwise.

6. The gateway and the simulator use a static token from .env instead of Auth0, since they are not people.

7. TEST. `curl -H 'Authorization: Bearer <token from the SPA>' /me` returns the sub and role. Without the header, /reports returns 401.

```
import jwt, os
from fastapi import Depends, HTTPException, Header
jwks = jwt.PyJWKClient(f"https://{os.environ['AUTH0_DOMAIN']}/.well-known/jwks.json")
def get_user(authorization: str = Header(...)):
    token = authorization.split(' ', 1)[1]
    key = jwks.get_signing_key_from_jwt(token).key
    claims = jwt.decode(token, key, algorithms=['RS256'], audience=os.environ['AUTH0_AUDIENCE'], issuer=f"https://{os.environ['AUTH0_DOMAIN']}/")
    return {'sub': claims['sub'], 'role': claims.get('https://planit-beacon/role', 'crew')}
def require_supervisor(user=Depends(get_user)):
    if user['role'] != 'supervisor': raise HTTPException(403)
    return user
```

## 3.9 The beacon connection

The Pi gateway opens WS /ws/gateway/{site_id}?token=GATEWAY_TOKEN and keeps it open with a ping every 15 seconds. Messages are JSON, one per frame. The exact list is contracts/gateway-ws.md, summarized here.

```
up    {"kind":"pod","ts":...,"P":1,"D":182,"S":41,"M":12,"T":33.1,"H":78,"W":0,"TILT":0}
up    {"kind":"flash","ts_us":1729170131045123}
up    {"kind":"local_stopwork","ts":...,"distance_m":1030,"flash_ts_us":...,"bang_ts_us":...}
up    {"kind":"count","seconds":1793}
up    {"kind":"checkin","ts":...,"crew_number":3,"action":"in","via":"remote"}     IR remote digit 1 to 9 toggles crew N
up    {"kind":"estop","ts":...}
up    {"kind":"pin","value":"1234"}
up    {"kind":"state","led":"strobe","countdown":1793,"index":7,"interlock":"locked","presence":true,"online":true,"lcd":["LOCKED OUT","LIGHTNING 8MI 29:53"]}
down  {"cmd":"STOPWORK","seconds":1800,"distance_m":12874,"source":"sim"}
down  {"cmd":"CLEAR","by":"J. Smith"}
down  {"cmd":"INDEX","value":7,"reason":"Heat index 108"}
down  {"cmd":"REST","seconds":900}
down  {"cmd":"MUSTER","in":["Alice","Bob"],"out":[]}
down  {"cmd":"BRIEFING","english":"...","spanish":"..."}
down  {"cmd":"BANG","ts_us":...}       relayed from POST /sim/bang (the laptop mic listener) so the Pi can pair it with its own FLASH
down  {"cmd":"DEMO_SCALE","value":60}
```

1. Pod lines become conditions rows (source beacon) and presence events. A flash from the Pi and a bang from POST /sim/bang are paired by the backend as well as by the Pi, whichever decides first wins, and the result is a strikes row with source beacon.

2. A local_stopwork from the beacon opens the same alert the lightning rule would, so the dashboard shows it even if the backend never saw a strike.

3. Every "state" message is stored in memory as the site's last device state and served at GET /sites/{id}/device, and pushed on the site websocket. This is what Roblox polls, so keep it cheap, a dict per site, no database write.

4. A checkin with via remote carries crew_number, the remote digit 1 to 9, meaning crew member N of the site in crew_id order (Roblox players excluded). It is inserted into checkins exactly like POST /checkin, toggling that member if action is missing, then MUSTER is sent back down so the beacon's crew count digit and the dashboard agree.

5. The gateway's offline queue replays with original timestamps, and the backend inserts them with those timestamps, so the timeline is honest after a disconnect.

6. TEST. Before the Pi exists, connect with `websocat` or a ten line Python client, send a pod line and a state message, and confirm GET /sites/{id}/device returns the state. With the Pi connected, wave at the radar and watch a presence event arrive. Pull the Pi's network, flash and clap, reconnect, and watch the queued local_stopwork arrive with its original time.

## 3.10 Simulation ingest

The simulator is a Roblox experience (docs/simulator-guide.md). It calls these routes from Luau server scripts with the header X-Token: SIM_TOKEN. It cannot reach localhost, so these routes are only testable against the public deployment, which is why section 5 comes early. Exact bodies are in contracts/roblox-bridge.md.

1. POST /sim/strike with site_id, bearing in degrees, miles. The backend converts to lat and lon by moving from the site along the bearing (bearing 270 is west), inserts a strikes row with source sim, and calls on_strike. Nothing else is special, the lightning rule does the rest.

2. POST /sim/weather with site_id, temp_c, humidity, precip_mm, gust. Inserts a conditions row with source sim and runs the heat and flood rules.

3. POST /sim/water with site_id, depth_mm. Inserts conditions.water_depth_mm with source sim and runs the flood rule.

4. POST /sim/presence with site_id, count, users (a list of Roblox usernames inside the zone). Writes a presence event with source sim. Each username that is not already checked in becomes a checkins row with action in and via roblox, and a username that disappears from the list becomes action out, so a judge who walks into the zone in Roblox appears on the muster list and leaves it when they step out. Push MUSTER to the gateway and the site channel on each change.

5. POST /sim/bang with site_id, ts_us, from the mic listener page on the demo laptop. Relay it to the gateway as `{"cmd":"BANG","ts_us":...}` and try to pair it with the last flash from that site.

6. Roblox does not open a websocket. It polls GET /sites/{id}/device once a second and GET /sites/{id} every ten seconds, which is how the in world beacon mirrors the real one. Both must answer in well under a second.

7. TEST. From the public address, `curl -X POST -H 'X-Token: ...' -H 'Content-Type: application/json' -d '{"site_id":1,"bearing":270,"miles":8}' https://PUBLIC/sim/strike` creates a stopwork alert and, with the Pi connected, stops the fan. `curl -X POST ... -d '{"site_id":1,"count":1,"users":["Judge1"]}' /sim/presence` puts Judge1 on GET /sites/1/muster.

# 4. Web app

Moved to docs/web-guide.md, which Cam owns. Core's only obligations to it are the routes and websocket messages in contracts/api.md and CORS allowing the Vultr address and localhost:5173.

# 5. Hosting

Chris owns the Vultr account and deploy/. Viet makes the backend containerizable (a Dockerfile in backend/ that runs `uvicorn app.main:app --host 0.0.0.0 --port 8000`) and the two of you deploy together the first time. Do this the moment the backend boots with sites and /sim/strike, not when it is finished. Every later deploy is `git pull && docker compose up -d --build` on the server.

## 5.1 Vultr

1. Create a Cloud Compute instance, Ubuntu 24.04, the smallest plan with 2 GB RAM, in a US east region. Note the public IP.

2. SSH in, install Docker and Docker Compose, clone the repo on the dev branch.

3. deploy/docker-compose.yml runs two services, backend (uvicorn on 8000) and web (nginx serving the Vite build on 80). The database is Tiger Cloud, not a container. Add a caddy service with a domain only if someone has a domain handy; HTTPS matters for the crew phone page's camera and GPS (browsers require a secure context for both), so if there is no domain, use the Cloudflare tunnel in 5.2 for the phone page and keep the IP for everything else.

4. Copy .env.example to .env at the repo root on the server and fill it (contracts/env.md says who owns each value). Never commit it.

5. `docker compose -f deploy/docker-compose.yml up -d --build`. TEST. GET http://IP:8000/sites returns rows, GET /docs opens. Update the Auth0 allowed URLs to the public address.

6. Paste the public address in the team chat. Slavik puts it in the Pi's BACKEND_URL and the Roblox Bridge attributes, Cam in web/.env as VITE_API_URL.

## 5.2 Tunnel

1. For HTTPS without a domain, run `cloudflared tunnel --url http://localhost:8000` on the server (or on a laptop running the backend) and use the trycloudflare address. Roblox HttpService is happy with it, phones get a secure context, and it costs nothing.

2. The tunnel address changes on restart, so write it in one place per consumer and restart them. If the tunnel is the public address, start it once Saturday morning and never restart it.

# 6. Seed data, demo controls, and tests

1. seed.py inserts the sites from the CSV, five crew members for the beacon site (the team's first names plus one placeholder named Visitor), two sample reports with photos, and 48 hours of synthetic conditions for all sites so the charts are not empty on first load.

2. GET /health lists each fetcher's last success time and whether the gateway is connected. The dashboard's status bar reads it.

3. End to end test script (one file, run by hand). Post a sim strike at 8 miles for the beacon site, assert an alert exists, assert the gateway received STOPWORK (a fake gateway websocket client in the test), post a second strike, assert expires moved, post a clear with the PIN, assert cleared_by is set. This is the only test file this weekend.

# 7. Order of work and cut list

Everything done by 3 AM Sunday. No checkpoints, just this order.

| **Block** | **Core (Viet)** | **Done when** |
|---|---|---|
| First | Schema, sites loader, rules with the lightning reset, /sim/strike, gateway websocket with device state, site websocket, Dockerfile | A curl to /sim/strike on the public address creates an alert and the fake gateway client receives STOPWORK |
| Second | The Luau Bridge in sim/src/Bridge (simulator guide section 4) | The in world beacon turns red when the curl above runs |
| Third | Open-Meteo forecast and flood fetchers, heat index, heat and flood rules, scheduler with the 6 PM job calling intel, /sim/weather /water /presence /bang, CREW and MUSTER to the gateway | The dashboard shows live conditions for every site and a Roblox player in the zone appears on the muster |
| Fourth | Auth0, POST /reports calling intel.tag_photo, POST /checkin, NWS alerts, iNaturalist, GET /health, seed.py | Every line of the judges' checklist in section 1.1 is demonstrable |
| Fifth | Tides, FEMA flag, the test script, offline replay test, README section for the backend | Fresh clone boots with docker compose |

Cut in this order if behind. Tides and FEMA. iNaturalist (seed two wildlife events instead). NWS alerts. Auth0 passwordless for crew (keep supervisor login, let crew check in from the kiosk). Never cut the lightning rule with reset, the flood rule, the 6 PM job, GET /sites/{id}/device, /sim/strike, /sim/presence, or the gateway endpoint.
