# web

Owner: Cam. One Vite React app with two faces: the supervisor dashboard (/dashboard, /site/:id) and the crew phone page (/crew).

Cam has been designing in Figma. Before building anything, ask Cam what is done in Figma (which screens, is there a token set, does the plan include Dev Mode), and then agree on the handoff path together. The options, with tradeoffs:
- Screenshots plus a tokens file. Cam exports frames as PNG, writes colors, type scale, spacing, radius, and the hazard color scale into src/tokens.ts, and you build each screen from the image and the tokens. Works on any plan, reliable, fast. Default if nothing else is decided in five minutes.
- Figma MCP server (Dev Mode). More precise spacing and type, needs setup and a plan that includes Dev Mode. Only if it works in the first fifteen minutes.
- Figma to code plugins. Usually more cleanup than they save for a weekend. Not recommended.

Suggested stack, discuss if Cam prefers otherwise: React with Tailwind and shadcn/ui (fastest path to a finished look), MapLibre GL with MapTiler tiles for the map, Recharts for charts, Auth0 React SDK, zustand for the websocket store. Alternatives: plain CSS modules if Cam dislikes Tailwind; Mapbox GL if a token exists.

Fixed: the routes above, the API and websocket contracts in contracts/api.md, and the site page alarm state: on the beacon site, an active stop work takes over the site page full screen (it is on the room display during the demo) and cannot be dismissed by a click; it leaves only when the alert clears.

Guide: docs/web-guide.md. Section 2 is the Figma conversation to have first.

Polish matters here (the Easy On The Eyes prize). One dark theme shared by the dashboard, site page and crew page, one accent per hazard type used identically everywhere, large type hierarchy, real loading and empty states, big tap targets on the crew phone page.

Order of work: dashboard map and ranked list with live re-sort, site page with the alarm state and device card, crew phone page, briefing panel, polish.

Sweet treats (Cam's rule for web): any feature that is not in Chris's roadmap (the order of work above and docs/web-guide.md) and does not change what is on screen (logic, hooks, data helpers, simulators, timers) goes in web/src/sweet-treats/. Off-roadmap visual work (components, styling) stays with the screen it belongs to. Roadmap code never depends on sweet-treats for its core behavior beyond what is already wired.

Run: scripts/dev.sh web.

## Decisions

- Figma screens: none exist yet for any face.
- Figma tokens: none; tokens are defined in code (web/src/tokens.ts and the Tailwind theme).
- Figma plan: Starter, View seat, no Dev Mode, MCP calls heavily rate limited, so no MCP handoff.
- Handoff: tokens first, built directly in code, reviewed by Cam from browser screenshots.
- Styling: Tailwind with shadcn/ui, no CSS modules.
- Stack as of setup: Vite 8, React 19, TypeScript 6 (no baseUrl, it is deprecated; paths alone), Tailwind 4, shadcn radix-nova preset, Node 24 LTS.
- Tokens: src/tokens.ts is the single source; applyTokens() writes CSS variables that index.css maps into Tailwind (bg-surface, text-hz-heat, text-countdown, h-tap...).
- Typeface: Geist Variable via @fontsource (bundled locally), tabular figures on by default.
- Palette (Cam): technical safety, near-black #040806 with green-tinted panels, signal green #00FF88 for UI chrome (edges, control stripes, pressed state, label markers), never a hazard meaning. Hazards: stop work red #FF3B30, heat amber #FFB300, flood cyan #00D4FF, wildlife magenta #FF5FD2 (green is taken by the UI and "safe"), beacon unsafe violet #C77DFF. Index scale green, yellow, red.
- Shape (Cam): every panel, window, badge and control is chamfered (top left and bottom right) via components/Panel.tsx; no rounded corners anywhere.
- Controls (Cam): one chamfered button style: 2 px edge, signal green stripe foot, mono code tag, instant 2 px press.
- Depth (Cam): panels and buttons have drop shadows on an unclipped wrapper, a lit top face, colored glow on caution/danger elements, pressed buttons sink.
- Factor web (Cam): a fixed web of every determinable factor in five clusters (weather, water, wildlife, equipment, site) around the hazard index; nodes, hubs and links color by condition (green OK, hazard color caution, strong fill plus pulse and flowing link for danger, dim info); drag to pan, wheel to zoom, Recenter fits. Thresholds in factors.ts (heat index 91 caution / 103 danger, water >0 / 30%, tilt 5 / 15 deg). Wildlife comes from hazard photo reports tagged with an animal in the last 2 h; alligator, snake, bear, wasp, hornet, bees are danger. Kept as a component for the site page.
- Idle caution screen (Cam): after 30 s with no input, a full screen CAUTION card of current hazards flashes 3 s every 10 s, or a steady NO HAZARDS card; while idle the factor web glides to the worst hazard. A fake hazard showcase cycles every hazard display while idle for demos. Kept as components for the site page.
- Touchscreen removed, kiosk work repurposed as site page alarm state (Chris, 2026-10-17): no /beacon route, no VITE_MODE=beacon, no kiosk websocket. The Stop work screen becomes the site page's full screen alarm state on the beacon site, fed by the site websocket.
- Ranking (Cam): active stop work first, then hazard index, then crew on site, so the beacon site jumps to the top the moment a strike lands. Rows slide to their new place (FLIP, 600 ms).
- Dashboard data: GET /sites every 15 s plus the beacon site's websocket for instant alerts and muster. `?fake=1` uses the real 50 sites from sites.csv (copied to src/dashboard/fake-sites.json) with made up indexes and a strike on the beacon site every 30 s.
- Map: MapTiler satellite and terrain when VITE_MAPTILER_KEY is set, otherwise CARTO dark-matter (free, no key). MapLibre 6 needs its worker bundled by Vite: `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'` then `setWorkerUrl` (the guide's snippet predates this).
- WEB section (Cam): the last kiosk iteration lives on as its own page, /web (and /web/:id), reached from the DASHBOARD / WEB tabs (components/AppNav.tsx). It holds the factor web, idle caution screen, hazard showcase and alarm state. /site/:id shows the same page until the real site page is built. Cam keeps developing WEB before the map.
- WEB detail (Cam): clicking a node (a press that moves under 5 px; a drag still pans) opens a side panel with value, status, a limit band (OK / caution / danger on 0..max), a live trend of readings kept once a second for 3 minutes since the page opened (single 2 px line, shaded limit zones, hover readout), and what it means for the crew. The view glides the node into view beside the panel. Escape or X closes. `?node=heat` opens one directly.
- WEB site picker (Cam): searchable list of all sites ranked like the dashboard, in the WEB header; navigates to /web/:id. In fake mode each site starts on its own showcase step.
- More factors (Cam): wind gust (25 / 35 mph), rain 24 h (1 / 3 in), soil saturation (70 / 90%), river stage (flood stage -1 ft / flood stage), FEMA flood zone (A or V zones caution), and a Crew cluster with one node per member (danger if still checked in during stop work). Feed factors are optional in the view model and only render when present.
- Sweet treats (Cam, 2026-10-17): off-roadmap non-visual features live in web/src/sweet-treats/ (kebab case, no space, so imports stay clean). Moved there: useIdle (idle detection), showcase (hazard showcase scenarios), useFactorHistory (trend history recorder, pulled out of the WEB page).
- Field View and HUB (Cam, 2026-10-17): the WEB version as of commit e337889 is stored as Field View, a frozen self-contained copy in web/src/sweet-treats/field-view/ (its own store, fake feed and hooks; imports stay inside the folder), reachable at /field-view but not in the tabs. WEB is renamed HUB (/hub, /hub/:id, tab 02 HUB) and is the site page: /site/:id renders HUB, and roadmap work (alarm state, device card, muster, briefing) continues in src/site and pages/Hub.tsx. /web redirects to /hub.
- HUB drafts in progress (Cam, walking through it step by step; all subject to change, nothing final): layout web + right column of collapsible panels (components/Fold.tsx; device card open by default, muster and briefing fold to one line with their key number, open state remembered per browser) with tabs underneath (conditions, reports, scenario, compliance log; placeholders). Device card as a hardware replica (LED, LED digits, LCD1602 lines). Muster as headcount + roster (Roblox players get a controller icon via an optional roblox flag). Briefing with an EN / ES toggle, Play via browser speech, Run now disabled until supervisor login. live.ts connects HUB to GET /sites/{id}, /muster and the site websocket when ?fake is absent.
