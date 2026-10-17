# Handoff: Slavik's Roblox World and firmware, as of Oct 17 09:30

For whoever picks up Slavik's work (Chris's session). Slavik owns sim/src/World, sim/place, sim/listener, and
firmware/ (pod, controlbox). Viet owns sim/src/Bridge; nothing here edits it. Everything below is on `dev`.

## Done recently

**Roblox World (branch feature/sim-world, all merged to dev, current build version 1017-0909)**
- Main place: `sim/place/PlanITSwamp.rbxl`. Built by `sim/test/make_place.luau` from the boardwalk swamp scenery
  in `sim/place/BoardwalkScene.rbxl` (a teammate's hand built scene, its own scripts stripped) plus our two World
  bundles and Viet's Bridge copied verbatim from `sim/src/Bridge` (Http + Bridge, not FakeBridge). Bridge attributes
  set: BACKEND_URL `https://api.omnirisking-it-all-at-swamphacks.us`, SITE_ID 12. SIM_TOKEN is blank on purpose,
  never committed; set it in Studio.
- Source of truth is `sim/src/World/*.lua`. `make_bundle.py` turns them into `sim/place/PlanITServer.server.lua`
  (one Script) and `PlanITClient.client.lua` (one LocalScript); the server builds the scene at Play. Studio auto
  starts the guided demo. `make_installer.py` makes the older one paste WorldInstaller (still works, rarely needed).
- What the World does: storm / lightning cell / hurricane / flash flood / Mississippi river flood / heat / gator /
  tipped pod scenarios and the Everglades challenge day; lightning with the 3 frame white flash (FlashEvent) and
  licensed thunder (rbxassetid 9120021540) after miles x 4.69 s; zone presence; per hazard beacon light and alarms;
  conditions board with the go/no-go call; crew that tailboards, rotates heat breaks, shelters on stop work
  (headcount); shift log; lightning radar; judge zone HUD; second setting (Mississippi crossing, site switch);
  ANSI signs and jobsite equipment; realism pass (Future lighting saved in the place, materials, animated crew).
- Contract boundary kept: World fires ReplicatedStorage.SimEvents (Strike, Weather, Water, PresenceChanged) and
  reads workspace.Beacon attributes. World internal remotes added: StrikeRadar, ScenarioControl actions demo/site.
  Sim side picture is published as workspace attributes (SimStopWork, SimCountdown, HeatIndexF, GoNoGo, ShiftLog...).
  The in world beacon shows the worse of backend state and the sim's own state.
- Mic listener: `sim/listener/index.html`, prefilled with the backend URL and site 12. Serve with
  `python -m http.server 8090` inside sim/listener. (It was running; Claude Code stopped it for low memory.)

**Contract change (with Chris's authorization):** touchscreen and kiosk removed (`5f1f4e2`): serial.md beacon LCD
lines and IR keys, gateway-ws checkin by crew_number via remote, kiosk-ws.md deleted, hardware guide updated.

**Firmware:** only notes so far. `firmware/CLAUDE.md` Decisions has the gateway BACKEND_URL line
(`wss://api.omnirisking-it-all-at-swamphacks.us/ws/gateway/12`, token appended), matching Chris's gateway.
`firmware/pod` and `firmware/controlbox` are still empty.

## How to verify (no Roblox needed)
Tools live outside the repo: Lune 0.11 (github.com/lune-org/lune) and luau-lsp with Roblox type definitions.
```
python sim/src/World/make_bundle.py            # rebuild the bundles after editing sim/src/World
lune run sim/test/make_place.luau              # rebuild sim/place/PlanITSwamp.rbxl
lune run sim/test/harness.luau sim/place/PlanITSwamp.rbxl   # main place, about 4 min, expect ALL CHECKS PASSED
lune run sim/test/harness.luau                 # the World's own fallback swamp
LIVE=1 lune run sim/test/harness.luau sim/place/PlanITSwamp.rbxl   # Bridge against the real backend (403 on posts without SIM_TOKEN)
```
The harness runs the real scripts with Lune's Roblox types and property checks, stubs only the engine (signals,
terrain, tweens, HTTP), and plays every scenario frame by frame. Gotchas: Lune has no default for Part.Position
(read CFrame.Position) or Sound.SoundId; harness timing checks are in sim seconds at the scenario's speed.
Slavik's workflow: overwrite `C:\Users\kulyn\OneDrive\Desktop\PlanITSwamp.rbxl`, he closes the Studio tab with
Don't Save and reopens it. Studio does not reload a changed file.

## In progress / open
- SIM_TOKEN: paste into ServerScriptService.Bridge.Bridge attribute in Studio, and into the listener page. Until
  then /sim/* posts get 403 (routes verified live).
- OPERATORS in `sim/src/World/ScenarioServer.server.lua` still has placeholder names (`SlavikUsername`,
  `VietUsername`). Needs the real Roblox usernames before publishing; in Studio everyone is an operator.
- Publish the place public with HTTP on (File > Publish to Roblox As) so judges can join from phones.
- Not in the sim: a wildfire/smoke scenario (the brief lists wildfire). Optional.
- Look and feel is untested by eye; Slavik is checking in Studio.

## Next for Slavik
Hardware, in hardware guide order: Step 1 RP2040-Zero LED test (not yet reported), Step 2 sensor pod wiring with
MicroPython written into `firmware/pod/` (radar, photoresistor FLASH, water, DHT11, tilt, IR codes, streaming the
`P:..,D:..` line every 100 ms per contracts/serial.md), then Step 3 the UNO sketch in `firmware/controlbox/`
(4 digit countdown, 1 digit crew count on A0, RGB, servo, beacon LCD, COUNT echo). Chris's gateway on dev
(`firmware/gateway`, with `devsim.py`) is what these talk to. Each step: Slavik flashes and wires, reports the
TEST result, then the next step.
