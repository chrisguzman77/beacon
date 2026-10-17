# SETUP.md, repository bootstrap for `beacon`

Run this once, before anyone else clones. Open the empty clone of the `beacon` repository in Claude Code and say: "Execute SETUP.md top to bottom. Create every file exactly as specified, then do the git steps, then print the verification checklist with results."

Preconditions on the machine running this. `git`, `gh` (authenticated with `gh auth status`), Node 20 or newer, Python 3.11 or newer. The repo `beacon` exists on GitHub with Cam, Viet, and Slavik as collaborators and has either no commits or only a README.

Everything below is to be done literally. Where a file's contents are given, write them verbatim. Where a file is marked "stub", write the short contents shown; the full version arrives later in `docs/`.

---

## 1. Folder structure

Create these folders. Put a `.gitkeep` in any that would otherwise be empty.

```
beacon/
  CLAUDE.md
  SETUP.md                      (this file, keep it)
  README.md
  .gitignore
  .github/CODEOWNERS
  .github/pull_request_template.md
  .env.example
  contracts/
    README.md
    events.md
    serial.md
    gateway-ws.md
    api.md
    intel-interface.md
    roblox-bridge.md
    env.md
  docs/                         (the four build guides land here as markdown)
    .gitkeep
  backend/
    CLAUDE.md
    app/
      __init__.py
      core/        .gitkeep     (Viet)
      intel/       .gitkeep     (Chris)
    requirements.txt
  ml/
    CLAUDE.md
    data/raw/.gitkeep
    data/processed/.gitkeep
    report/.gitkeep
    requirements.txt
  web/
    CLAUDE.md
    .gitkeep
  sim/
    CLAUDE.md
    place/       .gitkeep       (the .rbxl place file, committed as a binary, Slavik)
    src/World/   .gitkeep       (Luau for scenarios, lightning, zone, beacon visuals, Slavik)
    src/Bridge/  .gitkeep       (Luau HTTP bridge to the backend, Viet)
  firmware/
    CLAUDE.md
    pod/         .gitkeep       (MicroPython for the RP2040-Zero)
    controlbox/  .gitkeep       (Arduino sketch for the UNO)
    gateway/     .gitkeep       (Python for the Raspberry Pi)
  deploy/
    docker-compose.yml
    .gitkeep
  scripts/
    dev.sh
```

---

## 2. Root files

### `.gitignore`

```
# python
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/
# node
node_modules/
dist/
.vite/
# env and secrets
.env
.env.*
!.env.example
# data and models
ml/data/raw/*
!ml/data/raw/.gitkeep
ml/data/processed/*
!ml/data/processed/.gitkeep
*.parquet
*.joblib
# uploads
backend/uploads/
# os and editors
.DS_Store
Thumbs.db
.vscode/
.idea/
# roblox autosaves and locks
*.rbxl.lock
*.rbxlx.lock
*_autosave*
```

### `README.md`

```
# PlanIT Beacon

A jobsite safety platform for utility field crews, built at SwampHacks XII for the PlanIT Control challenge.

The platform watches 50 real power plant sites, merges weather, heat, lightning, flooding, soil, and wildlife data into one risk picture per site, raises stop work alerts under the challenge's rules, sends a 6 PM next day briefing, accepts crew hazard photos, ranks sites for supervisors, and scores every site 0 to 10 with a machine learning hazard index.

A physical site beacon (Raspberry Pi, RP2040 sensor pod, Arduino control box, 7 inch touchscreen) senses heat, lightning, standing water, and crew presence on its own, speaks its alerts, cuts equipment power on a stop work, and keeps working with no internet.

A Roblox experience is the digital twin of the beacon's site. Scenarios run in Luau, lightning in Roblox strikes the real device through its own sensors, judges join as crew from their phones, and the in world beacon mirrors the real one.

## Layout

| Folder | Owner | What |
|---|---|---|
| backend/app/core | Viet | database, fetchers, rules, scheduler, websockets, auth, gateway endpoint, sim ingest |
| backend/app/intel | Chris | hazard index scoring, briefing, Gemini photo tagging |
| ml | Chris | training pipeline |
| web | Cam | dashboard, crew page, beacon kiosk |
| sim/src/World, sim/place | Slavik | Roblox place, scenarios, lightning, zone, beacon visuals, scene |
| sim/src/Bridge | Viet | Luau HTTP bridge to the backend |
| firmware | Slavik | pod, control box, Pi gateway |
| contracts | Chris (changes announced in chat) | the interfaces every piece speaks |
| docs | everyone | the build guides |

## Branches

`main` is demo ready and only receives merges from `dev`. `dev` is integration. Work on `feature/<area>-<thing>` off `dev`, merge back often. See CLAUDE.md.

## Running

See `scripts/dev.sh` and each folder's CLAUDE.md.
```

### `.github/CODEOWNERS`

```
# Folder ownership. GitHub will request these reviews on PRs to main.
/backend/app/core/   @VIET_GITHUB
/backend/app/intel/  @CHRIS_GITHUB
/ml/                 @CHRIS_GITHUB
/web/                @CAM_GITHUB
/sim/                @SLAVIK_GITHUB
/sim/src/Bridge/     @VIET_GITHUB
/firmware/           @SLAVIK_GITHUB
/contracts/          @CHRIS_GITHUB
/deploy/             @CHRIS_GITHUB
```

Replace the four placeholders with the real GitHub usernames before committing. Ask the human for them if they are not in the conversation.

### `.github/pull_request_template.md`

```
## What
One or two lines.

## Demo impact
Does this change anything a judge sees or the beacon does? Yes or no, and what.

## Contracts
Did this touch anything in contracts/? If yes, who was told.

## Tested
What you ran. A TEST line from the guide is enough.
```

### `.env.example`

```
# Copy to .env in the folder that needs it. Never commit .env.

# backend
DATABASE_URL=postgresql://user:pass@host:5432/tsdb?sslmode=require
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://planit-beacon/api
AUTH0_CLIENT_ID=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GATEWAY_TOKEN=change-me-long-random
SIM_TOKEN=change-me-long-random
UPLOAD_DIR=./uploads
PUBLIC_URL=https://your.public.address
BEACON_SITE_ID=1
DEMO_COUNTDOWN_SCALE=1

# web (Vite reads VITE_ prefixed vars)
VITE_API_URL=https://your.public.address
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_AUDIENCE=https://planit-beacon/api
VITE_MAPTILER_KEY=
VITE_MODE=dashboard

# gateway (on the Pi)
BACKEND_URL=wss://your.public.address/ws/gateway/1
GATEWAY_TOKEN=change-me-long-random
SITE_ID=1
POD_PORT=/dev/serial/by-id/usb-MicroPython-...
UNO_PORT=/dev/serial/by-id/usb-Arduino-...
SUPERVISOR_PIN=1234
DEMO_COUNTDOWN_SCALE=1

# sim (set inside Roblox Studio as attributes on the Bridge script, not as a file)
# BACKEND_URL, SIM_TOKEN, SITE_ID
```

### `scripts/dev.sh`

```
#!/usr/bin/env bash
# One command to run what you own locally. Usage: scripts/dev.sh backend | web | ml
set -e
case "$1" in
  backend)
    cd backend && python -m venv .venv 2>/dev/null || true && . .venv/bin/activate && pip install -q -r requirements.txt && uvicorn app.main:app --reload --port 8000 ;;
  web)
    cd web && npm install && npm run dev ;;
  ml)
    cd ml && python -m venv .venv 2>/dev/null || true && . .venv/bin/activate && pip install -q -r requirements.txt && echo "ml env ready" ;;
  *)
    echo "usage: scripts/dev.sh backend|web|ml" ;;
esac
```

Make it executable with `chmod +x scripts/dev.sh`.

### `deploy/docker-compose.yml`

```
services:
  backend:
    build: ../backend
    env_file: ../.env
    ports: ["8000:8000"]
    volumes: ["uploads:/app/uploads"]
    restart: unless-stopped
  web:
    build: ../web
    ports: ["80:80"]
    restart: unless-stopped
volumes:
  uploads:
```

### `backend/requirements.txt`

```
fastapi
uvicorn[standard]
asyncpg
websockets
apscheduler
httpx
pydantic-settings
pyjwt[crypto]
timezonefinder
pandas
openpyxl
google-genai
joblib
lightgbm
shap
python-multipart
```

### `ml/requirements.txt`

```
pandas
numpy
pyarrow
scikit-learn
lightgbm
shap
requests
pgeocode
joblib
matplotlib
tqdm
google-genai
asyncpg
python-dotenv
timezonefinder
```

### `backend/app/__init__.py`

Empty file.

---

## 3. Root `CLAUDE.md`

Write this exactly.

```
# PlanIT Beacon

You are working inside a four person hackathon repository. This file is the framework every session shares. It fixes what must be true (the requirements, the contracts between pieces, the demo) and leaves how to build each piece to the person who owns that folder, working with you. Read it, then read the CLAUDE.md in the folder you are working in, then the matching guide in docs/ if one exists.

## Purpose

Utility field crews get hurt by hazards that were knowable the night before, because the data lives in a dozen places and nobody turns it into a decision. We are building the platform that does, plus a physical beacon that puts the decision on the jobsite and makes stop work physically enforceable, plus a Roblox twin of the site where simulated storms strike the real device.

## What must be true at the demo (the definition of done)

1. The dashboard shows at least 50 real power plant sites on a map, ranked by a 0 to 10 hazard index from a trained model, each with live conditions merged from weather, heat, rain, soil, river, flood zone, lightning, and wildlife sources.
2. A lightning strike within 10 miles of a site creates a stop work alert with a 30 minute countdown that restarts on every new strike. A river site gets a flood warning after heavy rain. Heat index over the thresholds raises heat alerts.
3. Every evening at 6 PM in each site's local time a next day briefing is generated (English and Spanish) and can also be run on demand.
4. A crew member can take a photo of a hazard on their phone, it is tagged, pinned to the site map, and saved.
5. The physical beacon detects a lightning flash and thunder with its own sensors, computes the distance, cuts the equipment motor, shows the countdown on its display and touchscreen, speaks the alert, and keeps doing all of this with no internet. A supervisor PIN restores power. Crew check in on the touchscreen and the radar confirms the work zone is clear.
6. In the Roblox experience, pressing play on the storm scenario makes lightning strike in world, the screen flashes and thunder plays, the real beacon reacts (through its sensors and through the backend), the in world beacon mirrors the real one, and a judge who joins and walks into the work zone appears on the muster list.

If a task does not move one of those six forward, it waits.

## How we work

- This is a prototype built in about 30 hours. It will have bugs. A bug that does not affect the six points above is not fixed this weekend. Do not refactor, do not add tests beyond the TEST lines in the guides, do not gold plate.
- Prefer the fastest thing that works. If two approaches are close, pick the one with less code.
- Tools are suggestions, not orders. Each folder's CLAUDE.md names a suggested stack and the alternatives with their tradeoffs. When a choice is open, ask the human a short question with the pros and cons, agree in under five minutes, write the decision as one line at the bottom of that folder's CLAUDE.md under "Decisions", and move on.
- Contracts are not suggestions. Everything in contracts/ is how the pieces talk to each other. If you need to change one, stop, tell the human, they announce it in the team chat, and the change is a commit to contracts/ with the message starting "contract:". Never change a contract silently.
- Stay in your folder. Every folder has one owner (see README.md). backend and sim are each split between two owners at a boundary written in contracts/ (intel-interface.md and the Inside Roblox section of roblox-bridge.md). Do not edit another owner's folder. If you need something from it, ask.
- Every step ends with a test. The guides in docs/ have a TEST line after each step. Run it. If you cannot run it (no hardware here), say so and tell the human exactly what to run and what to expect.
- When something external disagrees with the guide (an API changed, a model id is different, a library renamed a function), trust the live documentation, fix it, and note it in the folder's CLAUDE.md under "Decisions".

## Git

Branches. `main` is demo ready and only receives merges from `dev`. `dev` is integration. All work happens on `feature/<area>-<thing>` branches created from `dev` (areas: core, intel, ml, web, sim, firmware, contracts).

Routine. Before starting, `git checkout dev && git pull`. Create your feature branch. Commit small and often with messages like `web: crew check in page`. When a feature works, merge `dev` into your branch, resolve anything, then merge your branch into `dev` and push. Merge to `dev` at least every few hours so nobody integrates at 2 AM. `dev` must always boot. Never force push, never rewrite history, never commit `.env`.

Parallel sessions. If the human is running more than one Claude Code session on this repo on the same machine, each session must be in its own git worktree so they do not overwrite each other. Check with `git worktree list`. If you are not in a worktree and another session is running, create one: `git worktree add ../beacon-<area> feature/<area>-<thing>` and work there. One worktree per branch.

Merging to main. Only the human merges `dev` into `main`, when the demo script runs end to end on `dev`.

## Contracts (read these before writing anything that crosses a folder)

- contracts/events.md, the one event shape every source writes
- contracts/serial.md, pod to Pi and Pi to UNO lines
- contracts/gateway-ws.md, the Pi to backend websocket messages
- contracts/api.md, REST and websocket routes
- contracts/intel-interface.md, how core calls intel
- contracts/roblox-bridge.md, how the Roblox experience talks to the backend
- contracts/env.md, every environment variable and who sets it

## The demo script (what "working" means)

1. Roblox on one laptop, dashboard on another, the beacon on the table with the fan spinning, the touchscreen showing the site status.
2. Press play on Storm from the west. Sky darkens in Roblox, a bolt hits at 8 miles, the screen flashes, thunder rolls.
3. The beacon's photoresistor and the laptop mic catch it. The beacon says "Lightning detected, eight miles, stop work, clear the zone." The fan stops, the countdown starts on the display and the touchscreen, the equipment LCD says LOCKED OUT, the in world beacon turns red, the site jumps to the top of the ranked map.
4. A judge taps their name on the touchscreen to check in. A judge joins the Roblox experience on their phone and walks into the zone, and appears on the muster list. They step out, the zone reads clear.
5. A second strike at 6 miles resets the countdown. The supervisor PIN on the touchscreen restores power and the LCD shows who released it.
6. Tomorrow's briefing is shown and spoken. The hazard index is shown with its three reasons.
7. The Pi's hotspot is turned off. A phone flashlight and a clap still stop the fan. Reconnect, and the event appears on the dashboard.

## People

Chris owns backend/app/intel, ml, contracts, deploy. Viet owns backend/app/core and sim/src/Bridge. Cam owns web. Slavik owns sim/src/World, sim/place, and firmware. When in doubt about who to ask, ask Chris.
```

---

## 4. Area `CLAUDE.md` files (stubs, expanded later by the guides in docs/)

### `backend/CLAUDE.md`

```
# backend

Two owners, one app. Viet owns app/core (database, sites loader, fetchers, rules engine, scheduler, websocket hub, Auth0, the gateway endpoint, sim ingest, main.py, deployment). Chris owns app/intel (hazard index scoring, the 6 PM briefing, Gemini photo tagging, the index explanation). The boundary is contracts/intel-interface.md: core calls three intel functions and includes one intel router, intel writes three tables that core created. Neither edits the other's folder.

Guide: docs/platform-guide.md (core) and docs/ai-ml-guide.md section 6 and 7 (intel), when they land.

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
```

### `ml/CLAUDE.md`

```
# ml

Owner: Chris. The hazard index training pipeline. Output is model.joblib, calibrator.joblib, schema.json, and report/metrics.md, consumed by backend/app/intel/scoring.py.

Guide: docs/ai-ml-guide.md when it lands. Sections 2 to 5 are this folder.

Fixed: time based split (train to 2022, validate 2023, test 2024), a rule baseline every metric is compared against, calibrated probabilities, a 0 to 10 mapping by validation deciles, SHAP top three features, and an honesty paragraph about county and day resolution. These are what the AI judges read.

Suggested: LightGBM. Alternative: sklearn HistGradientBoosting if LightGBM will not install, same interface. Open-Meteo archive for historical weather. NOAA Storm Events plus OSHA severe injuries for labels.

Never commit data/raw, data/processed, or model files. Commit the scripts and report/metrics.md.

## Decisions
```

### `web/CLAUDE.md`

```
# web

Owner: Cam. One Vite React app with three faces: the supervisor dashboard (/dashboard, /site/:id), the crew phone page (/crew), and the beacon kiosk (/beacon, built with VITE_MODE=beacon and served from the Pi by the gateway, talks to the gateway's local websocket so it works offline).

Cam has been designing in Figma. Before building anything, ask Cam what is done in Figma (which screens, is there a token set, does the plan include Dev Mode), and then agree on the handoff path together. The options, with tradeoffs:
- Screenshots plus a tokens file. Cam exports frames as PNG, writes colors, type scale, spacing, radius, and the hazard color scale into src/tokens.ts, and you build each screen from the image and the tokens. Works on any plan, reliable, fast. Default if nothing else is decided in five minutes.
- Figma MCP server (Dev Mode). More precise spacing and type, needs setup and a plan that includes Dev Mode. Only if it works in the first fifteen minutes.
- Figma to code plugins. Usually more cleanup than they save for a weekend. Not recommended.

Suggested stack, discuss if Cam prefers otherwise: React with Tailwind and shadcn/ui (fastest path to a finished look), MapLibre GL with MapTiler tiles for the map, Recharts for charts, Auth0 React SDK, zustand for the websocket store. Alternatives: plain CSS modules if Cam dislikes Tailwind; Mapbox GL if a token exists.

Fixed: the routes above, the API and websocket contracts in contracts/api.md, the kiosk's seven screens (status, crew, stop work, supervisor PIN, briefing, report, health) described in docs/hardware-guide.md Appendix C when it lands, and that the stop work screen cannot be dismissed by touch.

Polish matters here (the Easy On The Eyes prize). One dark theme shared by dashboard and kiosk, one accent per hazard type used identically everywhere, large type hierarchy, real loading and empty states, 20 mm tap targets on the kiosk. Design the kiosk screens first, judges look at them longest.

Run: scripts/dev.sh web.

## Decisions
```

### `sim/CLAUDE.md`

```
# sim

Two owners, one Roblox experience. Slavik owns src/World and place/ (scenario engine, lightning with flash and thunder, zone detection, beacon visuals, control panel, terrain and scene). Viet owns src/Bridge (the Luau that talks to the backend and writes device state onto the Beacon model). The boundary is the "Inside Roblox" section of contracts/roblox-bridge.md: a folder of BindableEvents the World fires and the Bridge listens to, and attributes on workspace.Beacon the Bridge writes and the World reads. Neither edits the other's scripts.

Core logic must be Luau (Roblox Studio challenge requirement). The scenario engine, lightning, zone detection, beacon state machine, and HTTP bridge are all Luau.

Editing the place. Default is Team Create on Slavik's place with Viet invited, both editing live in Studio. After each session, copy any script you changed into src/World or src/Bridge as a .lua text file so it can be reviewed and so Claude Code can write the next version. Alternative, only if one of you has used it before: Rojo with src/ as the source of truth and one person running rojo serve. Decide in five minutes, write the decision below.

What the World must do (Slavik)
- Run scenario timelines (Luau tables, see the contract) with play, pause, speed, and a free play lightning click.
- On a strike: draw a bolt at bearing and miles, fire a RemoteEvent so every client flashes a full screen white Frame for 3 render frames and plays the thunder Sound after miles times 4.69 seconds, then fire SimEvents.Strike.
- Detect players inside ZonePart every 0.5 s and fire SimEvents.PresenceChanged when the set changes.
- Read workspace.Beacon attributes and animate the light, countdown SurfaceGui, needle, and the equipment LCD text. Spawn an NPC worker in the zone while Presence is true. Stop the excavator animation while Interlock is "locked".
- Terrain, swamp, road, trucks, poles, gator, sky and atmosphere, from the Toolbox only, nothing uploaded (moderation delays).

What the Bridge must do (Viet)
- Http ModuleScript: HttpService wrapper with the X-Token header, JSON, one retry, and an Online flag.
- Bridge server Script: listen to SimEvents and POST to /sim/strike, /sim/weather, /sim/water, /sim/presence. Poll GET /sites/{id}/device every 1 s and GET /sites/{id} every 10 s and write the results as attributes on workspace.Beacon.
- First commit, before the backend is public: FakeBridge, a stub that cycles the Beacon attributes on a timer (green, then strobe with a countdown, then clear) so the World has something to react to. Replace it with the real Bridge once the backend is reachable.

HttpService must be enabled in Game Settings and cannot reach localhost, so the backend must be public before the real Bridge can run. BACKEND_URL, SIM_TOKEN, and SITE_ID are attributes on the Bridge script.

The demo runs the published experience in the Roblox client on Slavik's laptop. That laptop's screen is the flash source for the pod's photoresistor and its speakers are the thunder source for the mic listener.

Guide: docs/simulator-guide.md (Roblox version) when it lands.

## Decisions
```

### `firmware/CLAUDE.md`

```
# firmware

Owner: Slavik. Three programs.
- pod/ MicroPython on the Waveshare RP2040-Zero. Reads the LD2410B radar on UART1, the photoresistor at 5 kHz on core 1 for lightning flashes, the water sensor, the DHT11, the tilt switch, and the IR receiver. Streams one line every 100 ms plus immediate FLASH and IR lines. See contracts/serial.md.
- controlbox/ Arduino sketch on the UNO R3. Drives the 4 digit countdown through the 74HC595, the RGB status LED, the servo gauge needle, and the LCD1602 mounted on the equipment unit as the lockout tag. Parses commands from the Pi. See contracts/serial.md.
- gateway/ Python on the Raspberry Pi. Opens both serial ports, runs the local rules (flash to bang distance, heat, water, tilt), holds the equipment interlock on GPIO 18 and the e-stop on GPIO 23, plays voice clips, serves the kiosk build from web on port 8080 with a local websocket, connects to the backend websocket (contracts/gateway-ws.md), and queues events while offline.

Fixed: the pin maps and protocols in docs/hardware-guide.md and contracts/serial.md. The interlock fails safe (GPIO 18 low stops the motor). The countdown shown on the touchscreen, the 4 digit display, and the equipment LCD all come from the UNO's COUNT echo so they never disagree.

You cannot run hardware tests from here. For every step, tell the human exactly what to flash, what to wire, what to run, and what they should see, using the TEST lines in the guide.

Suggested: pyserial, websockets, gpiozero, FastAPI for the kiosk server, pygame or aplay for audio. Pre rendered WAV clips for the fixed voice lines.

## Decisions
```

### `contracts/README.md`

```
# contracts

The interfaces between pieces. Owned by Chris. Changing anything here requires telling the team first and a commit whose message starts with "contract:". Each file is the single source of truth for its interface. Code that disagrees with a contract is wrong, not the contract, unless the team agreed to change the contract.
```

---

## 5. Contract files

### `contracts/events.md`

```
# Event shape

Every source (feed, beacon, sim, crew) writes this shape into the events hypertable. The rules engine reads events and never checks source.

{
  "site_id": 17,
  "ts": "2026-10-17T14:02:11Z",
  "source": "feed" | "beacon" | "sim" | "crew",
  "type": "strike" | "conditions" | "presence" | "water" | "tilt" | "checkin" | "hazard_report" | "estop" | "nws_alert" | "wildlife" | "local_stopwork",
  "payload": { }
}

Payloads by type
- strike: { lat, lon, distance_m }
- conditions: { temp_c, humidity, heat_index_f, precip_mm, soil, discharge, water_depth_mm, wind_gust_kmh }
- presence: { count: 0..3, still_energy, moving_energy, distance_cm }
- water: { depth_mm }
- tilt: { value: 0 | 1 }
- checkin: { crew_id | crew_number | roblox_user, action: "in" | "out", lat, lon, via: "phone" | "kiosk" | "remote" | "roblox" }
- hazard_report: { report_id, tag, description, lat, lon }
- estop: {}
- nws_alert: { event, severity, headline }
- wildlife: { species, observed_on, lat, lon }
- local_stopwork: { distance_m, flash_ts_us, bang_ts_us }

Rules (same on backend and Pi)
- stopwork: strike.distance_m < 16093 opens or extends a stopwork alert, expires = now + 1800 s. After expiry the alert is awaiting_clear until a supervisor clears it.
- flood_warning: site.river and (precip_24h > 50 mm or discharge > 2.5 x 90 day mean). flood_confirmed when beacon water_depth_mm > 0.
- heat_warning: heat_index_f >= 103. heat_danger: >= 115, sends REST 900 to the beacon.
- beacon_unsafe: tilt 1 until tilt 0.
- zone_clear: during stopwork, presence count 0 for 10 s.
```

### `contracts/serial.md`

```
# Serial protocols

Pod (RP2040-Zero) to Pi, USB CDC, 115200 baud, one line every 100 ms:
P:1,D:182,S:41,M:12,T:33.1,H:78,W:0,TILT:0
  P presence 0/1, D detection distance cm, S still energy 0..100, M moving energy 0..100,
  T temperature C, H humidity %, W water level 0..100, TILT 0 upright 1 tipped
Immediate lines:
FLASH:<microsecond timestamp>      a light spike on the photoresistor
IR:<key>                           remote key, 0..9, OK, UP, DOWN, LEFT, RIGHT

Pi to UNO, USB, 115200 baud, newline terminated:
STOPWORK:<seconds>                  start or restart countdown, strobe red, LCD "LOCKED OUT"
CLEAR                               end stop work, green, LCD "RIG 1  RUNNING|BEACON LINK OK"
INDEX:<0..10>                       servo needle and color band
LCD:<line1>|<line2>                 write the equipment LCD (16 chars per line)
MUSTER:<n>                          crew count
REST:<seconds>                      rest break countdown

UNO to Pi:
COUNT:<seconds>                     once per second while a countdown runs
OK                                  after any command

Equipment LCD lines the gateway sends:
LCD:RIG 1  RUNNING|BEACON LINK OK
LCD:LOCKED OUT|LIGHTNING 8MI 27:41       (the UNO keeps the time updated)
LCD:LOCKED OUT|NEEDS SUPERVISOR
LCD:RELEASED BY <NAME>|<HH:MM MON DD>
LCD:E-STOP PRESSED|RESET AT BEACON
LCD:LOCKED OUT|HEAT REST BREAK 12:00
LCD:BEACON OFFLINE|LOCAL RULES ACTIVE

Pi GPIO: 18 = L293D EN1 (high runs the motor, low is the interlock), 23 = e-stop button to GND with pull up.
```

### `contracts/gateway-ws.md`

```
# Gateway websocket (Pi to backend)

URL: wss://PUBLIC/ws/gateway/{site_id}?token=GATEWAY_TOKEN
Ping every 15 s. JSON per message. The Pi queues messages while disconnected and replays them with their original ts on reconnect.

Up (Pi to backend)
{"kind":"pod","ts":"...","P":1,"D":182,"S":41,"M":12,"T":33.1,"H":78,"W":0,"TILT":0}
{"kind":"flash","ts_us":1729170131045123}
{"kind":"local_stopwork","ts":"...","distance_m":1030,"flash_ts_us":...,"bang_ts_us":...}
{"kind":"count","seconds":1793}
{"kind":"checkin","crew_number":7,"action":"in","via":"remote"}         (remote fallback; kiosk check ins go through the backend API directly)
{"kind":"estop","ts":"..."}
{"kind":"pin","value":"1234"}
{"kind":"state","led":"strobe","countdown":1793,"index":7,"interlock":"locked","presence":true,"online":true,"lcd":["LOCKED OUT","LIGHTNING 8MI 29:53"]}

Down (backend to Pi)
{"cmd":"STOPWORK","seconds":1800,"distance_m":12874,"source":"sim"}
{"cmd":"CLEAR","by":"J. Smith"}
{"cmd":"INDEX","value":7,"reason":"Heat index 108"}
{"cmd":"REST","seconds":900}
{"cmd":"MUSTER","in":["Alice","Bob"],"out":[]}
{"cmd":"BRIEFING","english":"...","spanish":"..."}
{"cmd":"BANG","ts_us":...}            relayed from the laptop mic listener so the Pi can pair it with its FLASH
{"cmd":"DEMO_SCALE","value":60}

The backend exposes the last "state" message at GET /sites/{id}/device for pollers (Roblox, dashboard).
```

### `contracts/api.md`

```
# HTTP and websocket API

Auth: Bearer Auth0 JWT for humans (role claim https://planit-beacon/role = supervisor | crew). Static tokens for machines: X-Token: GATEWAY_TOKEN or SIM_TOKEN.

GET  /health                                   any         fetcher health, last success per feed
GET  /sites                                    any         all sites with index, alert summary, last conditions, crew_on_site
GET  /sites/{id}                               any         detail: conditions 48h, alerts, reports, briefing, index with top_features
GET  /sites/{id}/conditions?hours=48           any         from site_hourly, both sources
GET  /sites/{id}/device                        any         last device state from the gateway (for Roblox polling and the dashboard)
GET  /sites/{id}/muster                        any         crew in, out, zone_clear
POST /checkin                                  crew/sup    {site_id, action, lat, lon, via}
POST /reports                                  crew/sup    multipart: photo, site_id, lat, lon, note  -> {report_id, tag, description, confidence}
POST /alerts/{id}/clear                        supervisor  {pin}
POST /briefings/{site_id}/run                  supervisor  generate now
POST /sim/strike                               SIM_TOKEN   {site_id, bearing, miles} or {site_id, lat, lon}
POST /sim/weather                              SIM_TOKEN   {site_id, temp_c, humidity, precip_mm, gust}
POST /sim/water                                SIM_TOKEN   {site_id, depth_mm}
POST /sim/presence                             SIM_TOKEN   {site_id, count, users: ["name"]}
POST /sim/bang                                 SIM_TOKEN   {site_id, ts_us}      from the mic listener page
GET  /sim/scenario/{site_id}                   SIM_TOKEN   optional: the backend can hold the "current scenario" so the dashboard shows what Roblox is playing
WS   /ws/site/{id}?token=                      any         pushes alerts, conditions, muster, reports, count, device state
WS   /ws/gateway/{site_id}?token=              gateway     see gateway-ws.md
```

### `contracts/intel-interface.md`

```
# core <-> intel

Tables core creates and intel writes:
- hazard_index (site_id, for_date, probability, index, top_features jsonb)
- briefings (site_id, for_date, generated, english, spanish, payload jsonb, source)
- reports.tag, reports.description, reports.confidence (columns on core's reports table)

Functions intel exposes (backend/app/intel/__init__.py):
- async def score_all() -> None                      scores every site for tomorrow, writes hazard_index, pushes INDEX to the beacon site
- async def run_briefing(site_id: int) -> dict        builds the payload from core's tables, calls Gemini with the number guard, writes briefings, returns {english, spanish, source}
- async def tag_photo(image_bytes: bytes, mime: str, site_name: str) -> dict   returns {tag, description, confidence}
- router: APIRouter with GET /sites/{id}/index/explain and POST /briefings/{site_id}/run

How core uses them:
- scheduler: intel.score_all() daily at 05:00 UTC; intel.run_briefing(site_id) at 18:00 local per site
- POST /reports handler calls intel.tag_photo before inserting
- main.py: app.include_router(intel.router)

Nothing else crosses the boundary. If intel needs data, it reads core's tables directly through the shared asyncpg pool (backend/app/core/db.py exposes get_pool()).
```

### `contracts/roblox-bridge.md`

```
# Roblox bridge

The Roblox experience is a client of the backend. It uses HttpService from server scripts only. The backend must be public (HttpService cannot reach localhost). All requests send header X-Token: SIM_TOKEN.

Roblox to backend
POST /sim/strike      {site_id, bearing, miles}       on every scenario or free play strike, after the in world bolt and flash have fired
POST /sim/weather     {site_id, temp_c, humidity, precip_mm, gust}   on scenario weather events
POST /sim/water       {site_id, depth_mm}
POST /sim/presence    {site_id, count, users}         whenever the set of players inside the ZonePart changes, and every 5 s while nonzero

Backend to Roblox (polled)
GET /sites/{site_id}/device   once per second. Returns the last gateway state:
  {led, countdown, index, interlock, presence, online, lcd}
  led drives the in world beacon light (green, yellow, red, strobe). countdown drives the in world display. presence true spawns the NPC worker in the zone. interlock "locked" stops the excavator animation.
GET /sites/{site_id}          every 10 s for the index and active alerts to show on an in world billboard.

Physical path (no HTTP)
- The flash is a full screen white ScreenGui Frame on every client for about 50 ms (3 render frames). The pod's photoresistor is aimed at the demo laptop's screen.
- Thunder is a Sound from the Roblox library played with delay = miles * 4.69 s (sound at 343 m/s). The laptop's speakers play it, the mic listener page hears it and posts /sim/bang.

Scenario format (Luau table, mirrors the JSON in the simulator guide)
{ name = "Storm from the west", clockStart = "13:00", speed = 60,
  events = {
    { t = 0,    type = "weather", clouds = 0.2, rain = 0, temp_c = 33, humidity = 70, gust = 15 },
    { t = 900,  type = "strike",  bearing = 270, miles = 15 },
    { t = 1200, type = "strike",  bearing = 265, miles = 11 },
    { t = 1500, type = "strike",  bearing = 260, miles = 8 },
    { t = 1800, type = "strike",  bearing = 250, miles = 6 },
  } }
t is simulated seconds from clockStart. Bearing 270 is west.

Inside Roblox (World <-> Bridge)

ReplicatedStorage.SimEvents, a Folder of BindableEvents. The World fires, the Bridge listens.
  Strike(bearing: number, miles: number)
  Weather(t: {temp_c, humidity, precip_mm, gust})
  Water(depth_mm: number)
  PresenceChanged(count: number, users: {string})

workspace.Beacon attributes. The Bridge writes, the World reads with GetAttributeChangedSignal.
  Led: "green" | "yellow" | "red" | "strobe"
  Countdown: number (seconds, 0 when none)
  Index: number 0..10
  Interlock: "running" | "locked"
  Presence: boolean
  Online: boolean (false when the backend is unreachable)
  Lcd1, Lcd2: string (16 chars)
  Alerts: string (JSON array of active alert types)

Bridge script attributes, set in Studio: BACKEND_URL, SIM_TOKEN, SITE_ID.

Flash and thunder stay on the World side (ReplicatedStorage.FlashEvent, a RemoteEvent the Lightning script fires with miles, handled by a LocalScript in StarterPlayerScripts). The Bridge never touches the screen or audio.
```

### `contracts/env.md`

```
# Environment variables

Copy .env.example to .env where needed. Who sets what:

Backend (.env in repo root, read by docker compose and by uvicorn)
  DATABASE_URL            Viet (from Tiger Cloud)
  AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_CLIENT_ID   Viet (from the Auth0 tenant)
  GEMINI_API_KEY, GEMINI_MODEL                    Chris
  GATEWAY_TOKEN, SIM_TOKEN                        Chris (generate with openssl rand -hex 24), shared with Slavik
  UPLOAD_DIR, PUBLIC_URL, BEACON_SITE_ID, DEMO_COUNTDOWN_SCALE   Chris

Web (web/.env)
  VITE_API_URL, VITE_AUTH0_*, VITE_MAPTILER_KEY, VITE_MODE     Cam (MapTiler key from Cam's account or Chris's)

Gateway (firmware/gateway/.env on the Pi)
  BACKEND_URL, GATEWAY_TOKEN, SITE_ID, POD_PORT, UNO_PORT, SUPERVISOR_PIN, DEMO_COUNTDOWN_SCALE   Slavik

Roblox (attributes on the Bridge script in Studio)
  BACKEND_URL, SIM_TOKEN, SITE_ID   Slavik
```

---

## 6. Git steps

Run these in order from the repo root.

```
git checkout -b main 2>/dev/null || git checkout main
git add -A
git commit -m "chore: repository skeleton, contracts, and CLAUDE.md framework"
git push -u origin main
git checkout -b dev
git push -u origin dev
gh repo edit --default-branch dev
```

Optional, if the human wants main protected (recommended, it costs nothing):

```
gh api -X PUT repos/{owner}/beacon/branches/main/protection \
  -f required_pull_request_reviews.required_approving_review_count=0 \
  -F enforce_admins=false -F required_status_checks=null -F restrictions=null \
  -f allow_force_pushes=false -f allow_deletions=false
```

If that call errors on the JSON shape, skip it and tell the human. Convention is enough this weekend.

---

## 7. Verification checklist

Print each line with PASS or FAIL.

- `git branch -a` shows main and dev, both on origin.
- `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` prints dev.
- Every folder in section 1 exists, with .gitkeep where needed.
- CLAUDE.md exists at the root and in backend, ml, web, sim, firmware.
- contracts/ has eight files.
- .env.example exists and .env is ignored (`git check-ignore .env` prints .env).
- CODEOWNERS has real usernames, no placeholders.
- scripts/dev.sh is executable.

Then tell the human: "Repo is ready. Everyone clones with `git clone <url>` and lands on dev. Next, Chris drops the four guides into docs/ as markdown and the area CLAUDE.md files point at them."
```
