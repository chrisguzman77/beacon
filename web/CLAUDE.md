# web

Owner: Cam. One Vite React app with three faces: the supervisor dashboard (/dashboard, /site/:id), the crew phone page (/crew), and the beacon kiosk (/beacon, built with VITE_MODE=beacon and served from the Pi by the gateway, talks to the gateway's local websocket so it works offline).

Cam has been designing in Figma. Before building anything, ask Cam what is done in Figma (which screens, is there a token set, does the plan include Dev Mode), and then agree on the handoff path together. The options, with tradeoffs:
- Screenshots plus a tokens file. Cam exports frames as PNG, writes colors, type scale, spacing, radius, and the hazard color scale into src/tokens.ts, and you build each screen from the image and the tokens. Works on any plan, reliable, fast. Default if nothing else is decided in five minutes.
- Figma MCP server (Dev Mode). More precise spacing and type, needs setup and a plan that includes Dev Mode. Only if it works in the first fifteen minutes.
- Figma to code plugins. Usually more cleanup than they save for a weekend. Not recommended.

Suggested stack, discuss if Cam prefers otherwise: React with Tailwind and shadcn/ui (fastest path to a finished look), MapLibre GL with MapTiler tiles for the map, Recharts for charts, Auth0 React SDK, zustand for the websocket store. Alternatives: plain CSS modules if Cam dislikes Tailwind; Mapbox GL if a token exists.

Fixed: the routes above, the API and websocket contracts in contracts/api.md, the kiosk websocket in contracts/kiosk-ws.md, the kiosk's seven screens (status, crew, stop work, supervisor PIN, briefing, report, health) described in docs/web-guide.md section 9, and that the stop work screen cannot be dismissed by touch.

Guide: docs/web-guide.md. Section 2 is the Figma conversation to have first.

Polish matters here (the Easy On The Eyes prize). One dark theme shared by dashboard and kiosk, one accent per hazard type used identically everywhere, large type hierarchy, real loading and empty states, 20 mm tap targets on the kiosk. Design the kiosk screens first, judges look at them longest.

Run: scripts/dev.sh web. Kiosk in dev: `npm run dev:beacon` opens the kiosk against the fake gateway (`?fake=1`, add `&t=12` to jump to second 12 of src/kiosk/fake-snapshots.json).

## Decisions

- Figma screens: none exist yet for any face (dashboard, site, crew, kiosk).
- Figma tokens: none; tokens are defined in code (web/src/tokens.ts and the Tailwind theme).
- Figma plan: Starter, View seat, no Dev Mode, MCP calls heavily rate limited, so no MCP handoff.
- Handoff: tokens first, built directly in code, reviewed by Cam from browser screenshots at 800x480.
- Design first: the kiosk; dashboard and crew page reuse its tokens and components.
- Styling: Tailwind with shadcn/ui, no CSS modules.
- Stack as of setup: Vite 8, React 19, TypeScript 6 (no baseUrl, it is deprecated; paths alone), Tailwind 4, shadcn radix-nova preset, Node 24 LTS.
- Tokens: src/tokens.ts is the single source; applyTokens() writes CSS variables that index.css maps into Tailwind (bg-surface, text-hz-heat, text-countdown, h-tap...).
- Typeface: Geist Variable via @fontsource (bundled, works offline), tabular figures on by default.
- Countdown size: the guide's 80 mm digits cannot fit (the whole 480 px screen is about 86 mm tall); the countdown is 240 px, the largest thing on the device.
- Beacon mode: VITE_MODE=beacon or `vite --mode beacon` renders only the kiosk; `?fake=1` swaps the gateway socket for the fake replay. Root .gitignore ignores .env.*, so no committed .env.beacon.
