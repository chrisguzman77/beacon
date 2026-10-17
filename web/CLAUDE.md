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
