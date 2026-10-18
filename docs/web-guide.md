# OmniRisk

## Web Build Guide

*OmniRisk, SwampHacks XII*

Version 1, October 2026. Split out of the Platform guide for the repo. Covers the supervisor dashboard and the crew phone page.

This guide is for Cam, who owns web/. It is one Vite React app with two faces. The supervisor dashboard (/dashboard and /site/:id) is the first thing the PlanIT judges see, and the beacon site's page is on the room display during the demo. The crew phone page (/crew) is what a judge uses on their own phone to check in and file a hazard photo. Where this guide and a file in contracts/ disagree, the contract wins.

# 1. Read this first

## 1.1 What the judges see

| **Judge** | **Screen** | **What has to be true** |
|---|---|---|
| PlanIT Control | Dashboard | 50 real sites on a map ranked by hazard index, the beacon site jumps to the top when the Roblox storm hits, every alert type visible as a chip, the briefing panel shows tomorrow's text in English and Spanish |
| PlanIT Control | Crew phone page | A judge signs in, checks in, takes a photo of a printed alligator, sees the tag come back, sees the pin on the dashboard |
| Hardware track | Site page | On the beacon site, the full screen red alarm state with the countdown matching the beacon's four digit display, and the device card mirroring the beacon live |
| Easy On The Eyes | All three | One coherent dark theme, large type hierarchy, consistent hazard colors, real loading and empty states, no default browser widgets showing |
| Roblox | Site page | A small panel showing the scenario Roblox is playing and the live device state, so the room can see the loop close on a screen |

## 1.2 What is fixed and what is yours

Fixed. The routes. The API and websocket messages in contracts/api.md. The site page alarm state in section 7 and the rule that it cannot be dismissed by a click. The hazard color meaning (one color per hazard type, used identically on every screen).

Yours. Everything about how it looks. Layout, type, spacing, motion, the exact palette, the component library. The suggested stack below is a suggestion, and section 2 is the conversation to have before choosing.

# 2. Before building, the Figma conversation

Cam has been designing in Figma. Before writing any component, work through these with him in the first fifteen minutes, write the answers at the bottom of web/CLAUDE.md under Decisions, and then build.

1. Which screens exist in Figma today, and at what fidelity. Dashboard, site page, crew page.

2. Is there a token set (colors, type scale, spacing, radius) in Figma, or are the values only in the frames.

3. Which Figma plan. Dev Mode is what makes the MCP server useful. If the plan does not include it, the answer to question 4 is screenshots.

4. The handoff path. Three options.

Screenshots plus a tokens file. Cam exports each frame as a PNG at 2x into web/design/, writes the tokens into web/src/tokens.ts, and the screens are built from the image and the tokens. Works on any plan, needs no setup, and it is how most hackathon teams actually ship. This is the default if nothing else is decided in five minutes.

Figma MCP server. Dev Mode gives exact spacing and type and lets Claude Code read frames directly. Set it up only if it connects in the first fifteen minutes, otherwise fall back to screenshots.

Figma to code plugins. Usually produce markup that takes longer to clean than to write. Not recommended this weekend.

5. Which face Cam wants to design in Figma first and which can be built straight from the tokens. The site page with its alarm state is the recommended answer for Figma first, because it is on the room display and the most photographed.

6. Whether Cam prefers Tailwind, or plain CSS modules. Both are fine. Tailwind with shadcn/ui is faster to a finished look. CSS modules give pixel control that matches Figma more exactly. Pick one and do not mix.

# 3. Setup

1. `npm create vite@latest . -- --template react-ts` inside web/, then `npm i maplibre-gl @auth0/auth0-react recharts react-router-dom zustand qrcode.react` and, if Tailwind was chosen, `npm i -D tailwindcss @tailwindcss/vite` plus shadcn/ui init.

2. Routes. /dashboard (map and ranked list), /site/:id (detail), /crew (phone page). Redirect / to /dashboard.

3. Environment, web/.env, copied from the keys in contracts/env.md. VITE_API_URL, VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE, VITE_MAPTILER_KEY.

4. One websocket client in a zustand store. It subscribes to WS /ws/site/{id} for the open site and feeds every component. Components never open sockets themselves.

5. Auth0 with @auth0/auth0-react. Supervisor pages require the role claim https://planit-beacon/role to equal supervisor. The crew page accepts crew or supervisor.

6. TEST. `scripts/dev.sh web` serves the app, the Auth0 login button appears, and an empty map renders with terrain.

# 4. Design system

Decide these once with Cam, put them in tokens.ts or the Tailwind theme, and never type a raw color again.

1. Theme. One dark theme shared by the dashboard, site page and crew page. Suggested, deep navy background (around #0B1220), raised surfaces two steps lighter, near white text, a muted text color for labels. A dim venue reads better dark, and the red alarm state is more startling against it.

2. Hazard colors, one each, used everywhere a hazard appears (map markers, chips, alarm state, charts). Lightning and stop work red. Heat amber. Flood blue. Wildlife green. Beacon unsafe (tilt, e-stop) purple. The hazard index scale runs green through yellow to red and is the only gradient in the app.

3. Type. Three sizes do most of the work. A display size for the index number and the countdown, a heading size, a body size. One typeface, variable weight, bundled locally. Numbers in tabular figures so the countdown does not jitter.

4. States. Every list and panel has a loading skeleton, an empty message in a full sentence, and an error line with a retry. Judges will open the dashboard while a fetcher is still running, and a skeleton looks finished where a blank looks broken.

5. Motion. One easing, 200 milliseconds, for chips and panels. The alarm state takeover on the site page is the one exception, it snaps.

6. The LIVE BEACON badge. The beacon site is marked everywhere it appears with a small pulsing dot, and its device state (section 7) is shown live.

TEST. Open the dashboard and the beacon site page side by side. A stranger should be able to say they are the same product.

# 5. Map

1. Create a MapLibre style with two sources from MapTiler, satellite raster tiles and terrain RGB, then enable terrain and sky. Code below.

2. Add the sites from GET /sites as a GeoJSON source with a circle layer colored by index (green up to 3, yellow up to 6, red above) and a larger ring when crew_on_site is above zero. An active stopwork alert adds a pulsing red halo.

3. Click a site, fly the camera to it at pitch 60 and zoom 15, and open the site panel.

4. TEST. Zooming into any site shows real terrain and imagery with the marker standing on it.

```
const key = import.meta.env.VITE_MAPTILER_KEY;
const map = new maplibregl.Map({ container: 'map', center: [-82.3, 29.6], zoom: 6, pitch: 0,
  style: { version: 8, sources: {
    sat: { type: 'raster', tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${key}`], tileSize: 256, attribution: '© MapTiler © OpenStreetMap' },
    terrain: { type: 'raster-dem', tiles: [`https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`], tileSize: 256, encoding: 'mapbox' } },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }] } });
map.on('load', () => {
  map.setTerrain({ source: 'terrain', exaggeration: 1.2 });
  map.setSky({ 'sky-color': '#9ec4e8', 'horizon-color': '#dfe9f3', 'fog-color': '#ffffff', 'sky-horizon-blend': 0.6 });
});
```

# 6. Dashboard

- Left, the ranked list. Index, site name, state, active alerts as colored chips, crew on site count, last update. Sorted by index then by crew count. Clicking a row flies the map. The row re-sorts live when an alert arrives on the websocket, which is the moment the room watches during the Roblox storm.

- Right, the map. A legend. A filter row for hazard types.

- Top, a status bar from GET /health. Sites with stop work, sites with heat danger, feeds healthy or not, beacon connected or not, time of the next briefing run.

- The beacon site has the LIVE BEACON badge, and its row shows measured heat index beside the forecast.

TEST. Post a sim strike with curl (platform guide section 3.10) and watch the beacon site's row turn red and move to the top without a reload.

# 7. Site page

- Header. Name, index as a big colored number with the three reasons as chips (from GET /sites/{id}/index/explain), active alerts with live countdowns.

- Device card, beacon site only. The live state from GET /sites/{id}/device and the site websocket. Light color, countdown, interlock, zone presence, online or offline, the two LCD lines rendered in a monospace block exactly as the beacon's LCD1602 shows them, and the crew count from the beacon's one digit display. When the beacon goes offline the card says LOCAL RULES ACTIVE instead of going blank.

- Alarm state, beacon site only. When the site has an active stop work, the page is taken over full screen: red background, the countdown in the largest digits on the page matching the beacon's four digit display (from the site websocket, never a local timer), the reason (LIGHTNING 8 MI), zone status from the radar (ZONE OCCUPIED or ZONE CLEAR), and the crew not yet checked out. It cannot be dismissed by a click and leaves only when the alert clears (supervisor PIN on the beacon's IR remote, or the dashboard clear). It snaps in, no animation.

- Scenario panel, beacon site only. What Roblox is playing (GET /sim/scenario/{id} if the backend keeps it, otherwise the last sim event), and the join link or QR code for the Roblox experience so judges can get in from their phones.

- Conditions chart. 48 hours from GET /sites/{id}/conditions, heat index, precipitation, gust, with the beacon's measured line overlaid on the beacon site. Recharts, two lines, the hazard colors.

- Muster panel. Crew checked in, checked out, zone status from the radar. Roblox players show with a small controller icon beside the name.

- Reports. Pins on the map and a list with photo, tag, description, time.

- Briefing panel. Tomorrow's text in both languages, the payload numbers beside it, Run now (POST /briefings/{id}/run, supervisor) and Play buttons. Play uses the browser's speech synthesis in the chosen language, the beacon speaks through its own speaker.

- Compliance log. Every stop work with start, strikes that reset it, expiry, who cleared it and when. Built from the alerts list, no new endpoint.

TEST. Open the beacon site. Run the storm scenario in Roblox. The alarm state takes over with the countdown in step with the beacon's four digit display, the device card goes red, the muster shows the judge who walked into the zone.

# 8. Crew phone page

1. Auth0 passwordless login with SMS or email. After login, the crew member picks their site from a short list, which is remembered in localStorage.

2. Big buttons. I'M ON SITE and I'M LEAVING, which call POST /checkin with the phone's GPS position and via phone. Disabled with a spinner while the request is in flight.

3. REPORT HAZARD. Opens the camera with an input element of type file and capture environment, lets the user add a note, and posts to /reports with GPS. The response shows the Gemini tag and description for confirmation. Compress the image to 1600 pixels on the long side before upload so a 12 megapixel phone photo does not take ten seconds on hotspot Wi-Fi.

4. A status strip at the top mirrors the site's alerts from the websocket, so a crew member sees STOP WORK on their phone too.

5. Camera and GPS need a secure context, so this page must be reached over HTTPS (the tunnel address if Vultr has no domain, see platform guide section 5).

6. TEST. On a real phone over the hotspot, log in, check in, take a photo, and see the pin appear on the dashboard within two seconds.

# 9. Order of work and cut list

Everything done by 3 AM Sunday. In this order.

| **Block** | **Build** | **Done when** |
|---|---|---|
| First | The Figma conversation, tokens, Vite setup, dashboard map with sites from the public backend, ranked list with live re-sort | The map shows 50 sites and a curl strike moves the beacon site to the top without a reload |
| Second | Site page header, alarm state (repurposed from the Stop work screen), device card, muster, alerts | A curl strike turns the beacon site page into the full screen alarm state and the device card turns red |
| Third | Crew phone page with Auth0, check in, photo report | A photo from a phone appears as a pin |
| Fourth | Briefing panel, conditions chart, reports list, scenario panel | Every judge row in section 1.1 is demonstrable |
| Fifth | Compliance log, polish pass on states and motion, mobile check of the dashboard | Easy On The Eyes submission screenshots taken |

Cut in this order if behind. Compliance log. Conditions chart (show the numbers as text). Scenario panel. Never cut the ranked list with live re-sort, the site page alarm state, the device card, or the crew phone page.
