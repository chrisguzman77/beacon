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
- Palette (Cam): dark navy #0A1A3A background with bright saturated accents for visibility in all weather; flood is cyan #00D4FF because blue vanishes on navy; cards carry a 2 px border for definition in glare.
- Kiosk controls (Cam): one KioskButton for every kiosk tap target, industrial/HUD style: chamfered corners, 2 px edge, safety yellow hazard stripe foot, mono panel code tag, instant 2 px press. Safety yellow #FFD600 is for controls only, never a hazard meaning.
- Palette v2 (Cam, supersedes the navy palette): technical safety, near-black #040806 with green-tinted panels, signal green #00FF88 for UI chrome (edges, control stripes, pressed state, label markers). Wildlife moves to magenta #FF5FD2 because green now means the UI and "safe". Safety yellow token replaced by signal.
- Shape (Cam): every panel, window, badge and control is chamfered (top left and bottom right) via components/Panel.tsx; no rounded corners anywhere.
- No touchscreen (Cam, 2026-10-17): the beacon screen is now a desktop platform (mouse and keyboard, full browser window, not 800x480). Conflicts with root definition of done #5, demo steps 4-5, contracts/kiosk-ws.md and the hardware guide; Cam to announce, Chris to update contracts. Web still consumes the kiosk-ws snapshot unchanged.
- Status screen is a factor web (Cam): hazard index node in the center, every factor the snapshot can determine linked to it, nodes draggable with the mouse, layout kept in localStorage with a Reset button. Node and link color by condition: green OK, hazard color caution, strong fill plus pulsing tag and flowing dashed link for danger, dim for info. Thresholds in src/kiosk/factors.ts (heat index 91 caution / 103 danger, water >0 / 30%, tilt 5 / 15 deg). Wind, rain and river are not in the snapshot, so not shown.
- Idle caution screen (Cam): after 30 s with no mouse or key input, a full screen CAUTION card listing current hazards flashes for 3 s every 10 s; with no hazards a steady NO HAZARDS card holds until activity. Never shown over the stop work takeover. `?idle=5` shortens the idle time for testing.
