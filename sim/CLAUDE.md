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
