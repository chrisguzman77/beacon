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
