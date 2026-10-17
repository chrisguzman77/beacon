# PlanIT Beacon, Simulator Build Guide (Roblox)

Version 2, October 2026. Replaces the Three.js and MapLibre simulator entirely. The simulator is now a Roblox experience built in Roblox Studio with its core logic in Luau.

This guide is for Slavik (owns `sim/src/World` and `sim/place`) and Viet (owns `sim/src/Bridge`), working with Claude Code beside Roblox Studio. Every step ends with a TEST line. Follow the order in section 7 if you are short on time. Everything here must agree with `contracts/roblox-bridge.md`, `contracts/api.md`, and `contracts/events.md`. If this guide and a contract disagree, the contract wins and this guide has a bug.

## 1. Read this first

### 1.1 What the experience is

The Roblox experience is the digital twin of the beacon's jobsite. A flat utility site on the edge of a swamp, a work zone marked on the ground, a utility truck, an excavator, power poles, and in the middle of the zone a model of the real beacon with a light, a countdown display, a gauge needle, and the equipment lockout LCD. A control panel lets an operator play scenarios (a storm from the west, a heat day, a flash flood, a gator sighting, a tipped pod) or click anywhere on the ground to fire a bolt there. Judges join from their phones, spawn outside the zone as crew, and walk in.

Three chains connect the experience to the real device on the table.

1. The data path. A Luau scenario fires a strike. The Bridge posts it to `POST /sim/strike` on the public backend. The backend's lightning rule opens a stop work alert, sends `STOPWORK` down the Pi's websocket, the gateway drops GPIO 18, the fan stops, the countdown starts, the beacon speaks.
2. The physical path. The same strike flashes every client's screen white for three frames and plays thunder after the distance delay. The pod's photoresistor is aimed at the demo laptop's screen and catches the flash. The mic listener page (section 5) hears the thunder through the laptop's own microphone and posts `BANG`. The Pi pairs its `FLASH` with the `BANG`, computes distance from the gap, and declares its own local stop work before the cloud answers. Flash first, thunder later, exactly like a real storm.
3. Mirror and reverse. The Bridge polls `GET /sites/{id}/device` once a second and writes the real device's state onto the in world beacon as attributes. The in world beacon turns red, counts down, and moves its needle because the real one did. Players inside the zone are posted as presence, so a judge walking into the zone appears on the real beacon's muster list. When the real radar sees a person, the in world zone spawns an NPC worker.

### 1.2 Two owners and the boundary

Slavik owns the World. Scenario tables, the scenario engine, lightning with flash and thunder, zone detection, the beacon visuals, the control panel, terrain and scene, and the mic listener page.

Viet owns the Bridge. The HTTP module, the Bridge script that posts events and polls device state, and the FakeBridge stub that stands in for the backend until it is public.

They meet in two places and nowhere else, both defined in the "Inside Roblox" section of `contracts/roblox-bridge.md`.

- `ReplicatedStorage.SimEvents`, a Folder of four BindableEvents. The World fires `Strike(bearing, miles)`, `Weather(t)`, `Water(depth_mm)`, and `PresenceChanged(count, users)`. The Bridge listens.
- Attributes on `workspace.Beacon`. The Bridge writes `Led`, `Countdown`, `Index`, `Interlock`, `Presence`, `Online`, `Lcd1`, `Lcd2`, and `Alerts`. The World reads them with `GetAttributeChangedSignal`.

Neither owner edits the other's scripts. If you need something the other side does not provide, ask, and if it changes the contract, Chris commits it with a message starting `contract:`.

### 1.3 The Roblox Studio challenge

The prize requires the core logic to be written in Luau. Everything that makes this experience work is Luau. The scenario engine, the lightning geometry, the flash and thunder timing, zone detection, the beacon state machine, and the HTTP bridge. Studio's visual tools are used for terrain and placing Toolbox models, which is scenery, not logic. In the Devpost write up say exactly that, list the scripts by name, and point to `sim/src/` in the repo where every script is committed as text.

### 1.4 HttpService constraints

- HttpService works only from server Scripts and ModuleScripts required by them. A LocalScript cannot call it.
- It cannot reach `localhost` or private addresses. The backend must be public before the real Bridge can run. Until then the World team works against the FakeBridge (section 4.2).
- The budget is 500 requests per minute per game server. Our load is about 60 device polls, 6 site polls, and a handful of event posts per minute. Do not add a second fast poll.
- It is off by default. Turn it on in Game Settings, Security, "Allow HTTP Requests".

### 1.5 The demo laptop

The demo runs the published experience in the Roblox client (not Studio Play mode) on Slavik's laptop. That laptop's screen is the flash source, brightness at maximum, auto brightness off, with the pod's photoresistor aimed at it. Its speakers are the thunder source. The mic listener page runs in a browser tab on the same laptop. Judges join the same experience from their phones. The dashboard runs on Cam's laptop.

## 2. Studio setup

### 2.1 Place, Team Create, HTTP

1. Open Roblox Studio on Slavik's account, create a new Baseplate, and save it to Roblox as `PlanIT Beacon Site` (File, Publish to Roblox As). This creates the experience the judges will join.
2. Turn on Team Create (View tab, Team Create, Turn On). In the Team Create panel add Viet by username with Edit permission. Both of you now edit the same place live, scripts included, with no file merging.
3. Game Settings, Security, turn on "Allow HTTP Requests". Save.
4. Game Settings, Permissions, set the experience to Public so phones can join without an invite. Do this now, not on Sunday, because the first publish of a public place can take a few minutes to appear in search.
5. Delete the default Baseplate part later, once the terrain exists. Keep it for now so you have ground.

TEST. Both laptops have the place open in Studio at the same time, a part moved on one appears on the other, and in a server Script `print(game:GetService("HttpService").HttpEnabled)` prints `true` in the Output window when you press Play.

### 2.2 Explorer layout

Create these containers and instances before writing any code. Names matter, the scripts look them up by name.

```
Workspace
  Beacon                      Model, PrimaryPart = Base
    Base                      Part, the post, anchored
    Light                     Part, Neon, the status light on top
    Display                   Part with SurfaceGui
      SurfaceGui
        Countdown             TextLabel, text "----"
    Needle                    Part, thin, the gauge needle
    Lcd                       Part with SurfaceGui, the equipment lockout tag
      SurfaceGui
        Line1                 TextLabel
        Line2                 TextLabel
  ZonePart                    Part, anchored, CanCollide false, Transparency 0.7, the work zone
  SiteBillboard               Part with SurfaceGui
    SurfaceGui
      Status                  TextLabel
  Excavator                   Model placeholder, contains a Part named Bucket
  RainEmitter                 Part high above the site, transparent, with a ParticleEmitter (Enabled false)
  GatorSpot                   Part, invisible, where the gator spawns, beside the slough
  SpawnLocation               outside the zone so judges walk in
ReplicatedStorage
  SimEvents                   Folder
    Strike                    BindableEvent
    Weather                   BindableEvent
    Water                     BindableEvent
    PresenceChanged           BindableEvent
  FlashEvent                  RemoteEvent
  ScenarioControl             RemoteEvent      (World internal, not in the contract)
  ScenarioState               RemoteEvent      (World internal)
  StrikeHere                  RemoteEvent      (World internal)
  Thunder                     Sound, SoundId from a Toolbox thunder clip
ServerStorage
  NpcWorker                   Model, an R15 rig from the Rig Builder plugin
  Gator                       Model from the Toolbox
ServerScriptService
  World                       Folder (Slavik)
    Scenarios                 ModuleScript
    ScenarioEngine            ModuleScript
    Lightning                 ModuleScript
    WeatherFx                 ModuleScript
    ScenarioServer            Script
    Zone                      Script
    BeaconVisuals             Script
  Bridge                      Folder (Viet)
    Http                      ModuleScript
    Bridge                    Script, attributes BACKEND_URL, SIM_TOKEN, SITE_ID
    FakeBridge                Script
StarterPlayer
  StarterPlayerScripts
    FlashClient               LocalScript
    ScenarioUI                LocalScript
```

Set the Beacon model's attributes once by hand in the Properties panel so the World scripts have defaults before any Bridge runs. `Led` string `green`, `Countdown` number `0`, `Index` number `0`, `Interlock` string `running`, `Presence` boolean `false`, `Online` boolean `false`, `Lcd1` string `RIG 1  RUNNING`, `Lcd2` string `BEACON LINK OK`, `Alerts` string `[]`.

TEST. Select `workspace.Beacon` and see all nine attributes in the Properties panel. Select `ReplicatedStorage.SimEvents` and see four BindableEvents.

### 2.3 World scale

One mile is 400 studs. The farthest scenario strike is 15 miles, which is 6000 studs from the beacon, inside the range where Roblox still renders parts reliably. The terrain does not need to reach that far. A bolt that lands beyond the terrain edge is still visible because it starts at cloud height and the camera sees the sky. The beacon sits at the world origin area, and all bearings are measured from the Beacon model's pivot. Bearing 0 is north, which is negative Z in Roblox. Bearing 90 is east, positive X.

### 2.4 Getting scripts into git

Studio is the source of truth for the place. Git holds the scripts as text so they can be reviewed and so Claude Code can write the next version. After each working session, open each script you changed, select all, copy, and paste into a file under `sim/src/World/` or `sim/src/Bridge/`. Name files by what Studio calls them plus the script type, so `ScenarioEngine.module.lua`, `Lightning.module.lua`, `ScenarioServer.server.lua`, `Zone.server.lua`, `FlashClient.client.lua`. Commit on your feature branch and merge to `dev` like everyone else. Save the place file to `sim/place/PlanITBeaconSite.rbxl` (File, Save to File As) at the end of each day as a backup, it is a binary and will not merge, so only one person commits it.

Rojo alternative. If either of you has used Rojo before, `sim/src/` can be the source of truth with a `default.project.json` mapping folders to services, and one person runs `rojo serve` while the Studio plugin syncs files in live. Otherwise do not learn it this weekend.

TEST. `sim/src/World/` and `sim/src/Bridge/` each contain at least one `.lua` file after your first session and `git status` shows them committed.

## 3. The World (Slavik)

### 3.1 Scenario tables

A scenario is a Luau table. `t` is simulated seconds from `clockStart`. `speed` is the default multiplier. Event types are `strike`, `weather`, `water`, `wildlife`, and `note`. The engine maps `weather.rain` to the contract's `precip_mm`.

```lua
-- Scenarios (ModuleScript)
local Scenarios = {}

Scenarios.order = { "storm_west", "heat_day", "flash_flood", "gator", "tipped" }

Scenarios.storm_west = {
	name = "Storm from the west", clockStart = "13:00", speed = 60,
	events = {
		{ t = 0,    type = "weather", clouds = 0.2, rain = 0, temp_c = 33, humidity = 70, gust = 15 },
		{ t = 600,  type = "weather", clouds = 0.7, rain = 0, temp_c = 31, humidity = 78, gust = 35 },
		{ t = 900,  type = "strike",  bearing = 270, miles = 15 },
		{ t = 1200, type = "strike",  bearing = 265, miles = 11 },
		{ t = 1500, type = "strike",  bearing = 260, miles = 8 },
		{ t = 1800, type = "strike",  bearing = 250, miles = 6 },
		{ t = 2100, type = "weather", clouds = 0.8, rain = 12, temp_c = 28, humidity = 90, gust = 40 },
	},
}

-- Heat index at 70 percent humidity. 33 C is about 104 F (heat_warning at 103),
-- 36 C is about 117 F (heat_danger at 115), 39 C is well past both.
Scenarios.heat_day = {
	name = "Heat day", clockStart = "10:00", speed = 120,
	events = {
		{ t = 0,    type = "weather", clouds = 0.1, rain = 0, temp_c = 31, humidity = 70, gust = 5 },
		{ t = 3600, type = "weather", clouds = 0.1, rain = 0, temp_c = 33, humidity = 70, gust = 5 },
		{ t = 7200, type = "weather", clouds = 0.1, rain = 0, temp_c = 36, humidity = 70, gust = 5 },
		{ t = 10800, type = "weather", clouds = 0.1, rain = 0, temp_c = 39, humidity = 70, gust = 5 },
	},
}

Scenarios.flash_flood = {
	name = "Flash flood", clockStart = "14:00", speed = 60,
	events = {
		{ t = 0,    type = "weather", clouds = 0.8, rain = 10, temp_c = 27, humidity = 92, gust = 20 },
		{ t = 600,  type = "weather", clouds = 0.9, rain = 30, temp_c = 26, humidity = 95, gust = 25 },
		{ t = 900,  type = "water",   depth_mm = 0 },
		{ t = 1200, type = "weather", clouds = 0.9, rain = 60, temp_c = 25, humidity = 97, gust = 30 },
		{ t = 1500, type = "water",   depth_mm = 20 },
		{ t = 2100, type = "water",   depth_mm = 60 },
	},
}

-- Wildlife is visual only. The dashboard's wildlife layer comes from iNaturalist,
-- there is no /sim/wildlife route, so this scenario just spawns the gator by the slough.
Scenarios.gator = {
	name = "Gator sighting", clockStart = "08:00", speed = 30,
	events = {
		{ t = 0,   type = "weather",  clouds = 0.3, rain = 0, temp_c = 29, humidity = 80, gust = 8 },
		{ t = 300, type = "wildlife", species = "American alligator" },
		{ t = 310, type = "note",     text = "Gator at the slough. Crew reports it from the phone page, the tag appears on the site map." },
	},
}

-- The tilt switch is demonstrated by hand on the real pod. The sim only explains it.
Scenarios.tipped = {
	name = "Tipped pod", clockStart = "09:00", speed = 1,
	events = {
		{ t = 0, type = "note", text = "Tip the real sensor pod by hand. TILT goes to 1, the beacon reports beacon_unsafe, the dashboard shows it. Set it upright to clear." },
	},
}

return Scenarios
```

TEST. In the Command Bar run `print(require(game.ServerScriptService.World.Scenarios).storm_west.events[3].miles)` and see `15`.

### 3.2 ScenarioEngine

```lua
-- ScenarioEngine (ModuleScript)
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Scenarios = require(script.Parent.Scenarios)
local Lightning = require(script.Parent.Lightning)
local WeatherFx = require(script.Parent.WeatherFx)
local events = ReplicatedStorage:WaitForChild("SimEvents")

local Engine = {}
Engine.Changed = Instance.new("BindableEvent")

local state = {
	scenario = nil, key = nil, name = "", clockStart = "13:00",
	simTime = 0, speed = 60, playing = false, fired = {}, note = "",
}

function Engine.snapshot()
	return {
		key = state.key, name = state.name, clockStart = state.clockStart,
		simTime = state.simTime, speed = state.speed, playing = state.playing, note = state.note,
	}
end

local function emit()
	Engine.Changed:Fire(Engine.snapshot())
end

function Engine.load(key)
	local sc = Scenarios[key]
	if not sc then warn("[Engine] unknown scenario " .. tostring(key)) return end
	state.scenario, state.key, state.name = sc, key, sc.name
	state.clockStart = sc.clockStart or "13:00"
	state.simTime, state.speed, state.playing = 0, sc.speed or 60, false
	state.fired, state.note = {}, ""
	WeatherFx.reset()
	emit()
end

function Engine.play()
	if state.scenario then state.playing = true emit() end
end

function Engine.pause()
	state.playing = false
	emit()
end

function Engine.setSpeed(s)
	state.speed = math.clamp(s, 1, 600)
	emit()
end

local function dispatch(e)
	if e.type == "strike" then
		Lightning.strike(e.bearing, e.miles)
	elseif e.type == "weather" then
		WeatherFx.apply(e)
		events.Weather:Fire({ temp_c = e.temp_c, humidity = e.humidity, precip_mm = e.rain or 0, gust = e.gust })
	elseif e.type == "water" then
		WeatherFx.setWater(e.depth_mm)
		events.Water:Fire(e.depth_mm)
	elseif e.type == "wildlife" then
		WeatherFx.spawnGator()
	elseif e.type == "note" then
		state.note = e.text
		emit()
	end
	print(("[Engine] t=%d %s"):format(e.t, e.type))
end

local acc = 0
RunService.Heartbeat:Connect(function(dt)
	if not state.playing or not state.scenario then return end
	state.simTime += dt * state.speed
	for i, e in ipairs(state.scenario.events) do
		if not state.fired[i] and e.t <= state.simTime then
			state.fired[i] = true
			dispatch(e)
		end
	end
	acc += dt
	if acc >= 0.5 then
		acc = 0
		emit()
	end
end)

return Engine
```

Each event fires exactly once because `fired[i]` is set before dispatch. Loading a scenario again resets the table. Events are dispatched inside Heartbeat, so `Lightning.strike` must not yield, and it does not.

TEST. After section 3.7 is in, load `storm_west`, press Play at 60x, and watch the Output print `[Engine] t=900 strike` about 15 seconds after Play.

### 3.3 Lightning

```lua
-- Lightning (ModuleScript)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local events = ReplicatedStorage:WaitForChild("SimEvents")
local flashEvent = ReplicatedStorage:WaitForChild("FlashEvent")

local Lightning = {}
Lightning.STUDS_PER_MILE = 400
local CLOUD_HEIGHT = 900
local BOLT_SECONDS = 0.12

local function origin()
	return workspace.Beacon:GetPivot().Position
end

-- bearing 0 is north (negative Z), 90 is east (positive X)
function Lightning.groundPoint(bearing, miles)
	local o = origin()
	local r = miles * Lightning.STUDS_PER_MILE
	local x = o.X + math.sin(math.rad(bearing)) * r
	local z = o.Z - math.cos(math.rad(bearing)) * r
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { workspace.Beacon }
	local hit = workspace:Raycast(Vector3.new(x, 2000, z), Vector3.new(0, -4000, 0), params)
	return hit and hit.Position or Vector3.new(x, 0, z)
end

function Lightning.fromPosition(pos)
	local o = origin()
	local dx, dz = pos.X - o.X, pos.Z - o.Z
	local miles = math.sqrt(dx * dx + dz * dz) / Lightning.STUDS_PER_MILE
	local bearing = (math.deg(math.atan(dx, -dz)) + 360) % 360
	return bearing, miles
end

local function segment(a, b, width)
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.Neon
	p.Color = Color3.fromRGB(230, 240, 255)
	p.Size = Vector3.new(width, width, (b - a).Magnitude)
	p.CFrame = CFrame.lookAt((a + b) / 2, b)
	p.Name = "Bolt"
	p.Parent = workspace
	return p
end

function Lightning.strike(bearing, miles)
	local ground = Lightning.groundPoint(bearing, miles)
	local top = Vector3.new(ground.X, CLOUD_HEIGHT, ground.Z)
	local n = math.random(6, 8)
	local width = math.max(3, miles * 0.8)

	local points = { top }
	for i = 1, n - 1 do
		local base = top:Lerp(ground, i / n)
		table.insert(points, base + Vector3.new(math.random(-60, 60), 0, math.random(-60, 60)))
	end
	table.insert(points, ground)

	-- 1. draw the bolt
	local parts = {}
	for i = 1, #points - 1 do
		table.insert(parts, segment(points[i], points[i + 1], width))
	end
	local light = Instance.new("PointLight")
	light.Brightness, light.Range, light.Color = 20, 60, Color3.fromRGB(200, 220, 255)
	light.Parent = parts[#parts]
	local exposure = Lighting.ExposureCompensation
	Lighting.ExposureCompensation = exposure + 1.5

	-- 2. physical path: every client flashes white and schedules thunder
	flashEvent:FireAllClients(miles)

	-- 3. data path: the Bridge posts the strike
	events.Strike:Fire(bearing, miles)

	task.delay(BOLT_SECONDS, function()
		Lighting.ExposureCompensation = exposure
		for _, p in ipairs(parts) do p:Destroy() end
	end)
	print(("[Lightning] strike bearing %d miles %.1f"):format(bearing, miles))
end

return Lightning
```

The order inside `strike` is deliberate. Draw the bolt, fire the flash to every client, then fire the Strike event. The physical path and the data path start on the same frame, which is what makes the real beacon's local stop work and the cloud's stop work arrive close together in the demo.

TEST. In the Command Bar, with Play running, `require(game.ServerScriptService.World.Lightning).strike(270, 8)` draws a jagged bolt to the west, the world brightens for a tenth of a second, and the Output shows the strike line.

### 3.4 FlashClient

```lua
-- FlashClient (LocalScript in StarterPlayerScripts)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")

local SECONDS_PER_MILE = 4.69
local FLASH_FRAMES = 3

local player = Players.LocalPlayer
local flashEvent = ReplicatedStorage:WaitForChild("FlashEvent")
local thunderTemplate = ReplicatedStorage:WaitForChild("Thunder")

local gui = Instance.new("ScreenGui")
gui.Name = "FlashGui"
gui.IgnoreGuiInset = true
gui.DisplayOrder = 1000
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.fromScale(1, 1)
frame.BackgroundColor3 = Color3.new(1, 1, 1)
frame.BorderSizePixel = 0
frame.ZIndex = 1000
frame.Visible = false
frame.Parent = gui

local function flash()
	frame.Visible = true
	for _ = 1, FLASH_FRAMES do
		RunService.RenderStepped:Wait()
	end
	frame.Visible = false
end

local function thunder(miles)
	local s = thunderTemplate:Clone()
	s.Volume = math.clamp(1.3 - miles * 0.04, 0.6, 1)
	s.Parent = SoundService
	s.Ended:Connect(function() s:Destroy() end)
	s:Play()
end

flashEvent.OnClientEvent:Connect(function(miles)
	task.spawn(flash)
	task.delay(miles * SECONDS_PER_MILE, thunder, miles)
	print(("[Flash] flash now, thunder in %.1f s"):format(miles * SECONDS_PER_MILE))
end)
```

Pick the thunder clip in the Toolbox (Audio tab, search "thunder", choose one longer than two seconds with a deep rumble, not a crack), insert it, copy its `SoundId` into `ReplicatedStorage.Thunder`, and delete the inserted copy. Library audio does not need moderation.

TEST. Fire a strike at 8 miles from the Command Bar. The whole screen goes white for a few frames, and 37.5 seconds later thunder plays. Fire one at 1 mile and thunder follows in under five seconds.

### 3.5 Zone

```lua
-- Zone (Script in ServerScriptService/World)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local zone = workspace:WaitForChild("ZonePart")
local events = ReplicatedStorage:WaitForChild("SimEvents")

local params = OverlapParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude
params.FilterDescendantsInstances = { zone }

local function playerOf(part)
	local node = part
	while node and node ~= workspace do
		if node:IsA("Model") and node:FindFirstChildOfClass("Humanoid") then
			return Players:GetPlayerFromCharacter(node)
		end
		node = node.Parent
	end
	return nil
end

local last = ""
while true do
	local set = {}
	for _, part in ipairs(workspace:GetPartBoundsInBox(zone.CFrame, zone.Size, params)) do
		local plr = playerOf(part)
		if plr then set[plr.Name] = true end
	end
	local users = {}
	for name in pairs(set) do table.insert(users, name) end
	table.sort(users)
	local key = table.concat(users, ",")
	if key ~= last then
		last = key
		events.PresenceChanged:Fire(#users, users)
		print(("[Zone] %d in zone (%s)"):format(#users, key))
	end
	task.wait(0.5)
end
```

The World fires `PresenceChanged` only when the set of usernames changes. The contract also asks for a repeat every 5 seconds while the count is nonzero, and that repeat lives on the Bridge side (section 4.3), because it is about keeping the backend's view fresh, not about anything that happened in the world. The NPC worker is not a player, so it never counts.

TEST. Press Play, walk your character into the ZonePart, see `[Zone] 1 in zone (YourName)`, walk out, see `[Zone] 0 in zone ()`.

### 3.6 BeaconVisuals

```lua
-- BeaconVisuals (Script in ServerScriptService/World)
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")

local beacon = workspace:WaitForChild("Beacon")
local light = beacon:WaitForChild("Light")
local countdownLabel = beacon:WaitForChild("Display"):WaitForChild("SurfaceGui"):WaitForChild("Countdown")
local needle = beacon:WaitForChild("Needle")
local lcdGui = beacon:WaitForChild("Lcd"):WaitForChild("SurfaceGui")
local lcd1, lcd2 = lcdGui:WaitForChild("Line1"), lcdGui:WaitForChild("Line2")
local billboard = workspace:WaitForChild("SiteBillboard"):WaitForChild("SurfaceGui"):WaitForChild("Status")
local zone = workspace:WaitForChild("ZonePart")
local excavator = workspace:FindFirstChild("Excavator")

local COLORS = {
	green = Color3.fromRGB(0, 200, 80),
	yellow = Color3.fromRGB(255, 190, 0),
	red = Color3.fromRGB(220, 30, 30),
	off = Color3.fromRGB(20, 20, 20),
}
local needleBase = needle.CFrame

local function attr(name, default)
	local v = beacon:GetAttribute(name)
	if v == nil then return default end
	return v
end

local function fmt(seconds)
	seconds = math.max(0, math.floor(seconds))
	return ("%02d:%02d"):format(seconds // 60, seconds % 60)
end

local function applyLed()
	local led = attr("Led", "green")
	light.Material = Enum.Material.Neon
	if led ~= "strobe" then
		light.Color = COLORS[led] or COLORS.green
	end
end

local function applyCountdown()
	local s = attr("Countdown", 0)
	countdownLabel.Text = s > 0 and fmt(s) or "----"
end

local function applyIndex()
	local idx = math.clamp(attr("Index", 0), 0, 10)
	-- 0 is -90 degrees, 10 is +90 degrees. If the needle sweeps the wrong axis, change the Angles argument.
	needle.CFrame = needleBase * CFrame.Angles(0, 0, math.rad(-90 + idx * 18))
end

local function applyLcd()
	lcd1.Text = attr("Lcd1", "")
	lcd2.Text = attr("Lcd2", "")
end

local function applyBillboard()
	if attr("Online", false) ~= true then
		billboard.Text = "BEACON OFFLINE"
		return
	end
	billboard.Text = ("SITE %s   HAZARD INDEX %d\n%s"):format(tostring(attr("SiteName", "1")), attr("Index", 0), attr("Alerts", "[]"))
end

local npc
local function applyPresence()
	local present = attr("Presence", false) == true
	if present and not npc then
		local template = ServerStorage:FindFirstChild("NpcWorker")
		if template then
			npc = template:Clone()
			npc:PivotTo(CFrame.new(zone.Position + Vector3.new(3, 3, 0)))
			npc.Parent = workspace
		end
	elseif not present and npc then
		npc:Destroy()
		npc = nil
	end
end

-- strobe: alternate red and dark at 4 Hz while Led is "strobe"
task.spawn(function()
	local on = false
	while true do
		if attr("Led", "green") == "strobe" then
			on = not on
			light.Color = on and COLORS.red or COLORS.off
		end
		task.wait(0.125)
	end
end)

-- interlock: the excavator bucket turns while the equipment is running
if excavator and excavator:FindFirstChild("Bucket") then
	local bucket = excavator.Bucket
	RunService.Heartbeat:Connect(function(dt)
		if attr("Interlock", "running") ~= "locked" then
			bucket.CFrame = bucket.CFrame * CFrame.Angles(0, math.rad(60) * dt, 0)
		end
	end)
end

local handlers = {
	Led = applyLed, Countdown = applyCountdown, Index = { applyIndex, applyBillboard },
	Lcd1 = applyLcd, Lcd2 = applyLcd, Online = applyBillboard, Alerts = applyBillboard, Presence = applyPresence,
}
for name, h in pairs(handlers) do
	local fns = typeof(h) == "table" and h or { h }
	beacon:GetAttributeChangedSignal(name):Connect(function()
		for _, f in ipairs(fns) do f() end
	end)
end

applyLed() applyCountdown() applyIndex() applyLcd() applyBillboard() applyPresence()
```

Build the NPC with the Rig Builder (Avatar tab, Rig Builder, R15, Block Rig), rename it `NpcWorker`, give it a hard hat from the Toolbox if you like, and move it into ServerStorage. Nothing is uploaded.

TEST. With the FakeBridge running (section 4.2), the light goes green, then strobes red while the display counts down from 00:30 and the LCD reads LOCKED OUT, an NPC appears in the zone, and after the countdown the light holds steady red with NEEDS SUPERVISOR on the LCD.

### 3.7 ScenarioUI and free play

Server side first. This script is the only thing that may call `Engine` and `Lightning` on behalf of a player, and only operators may do so.

```lua
-- ScenarioServer (Script in ServerScriptService/World)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Engine = require(script.Parent.ScenarioEngine)
local Lightning = require(script.Parent.Lightning)

local control = ReplicatedStorage:WaitForChild("ScenarioControl")
local stateEvent = ReplicatedStorage:WaitForChild("ScenarioState")
local strikeHere = ReplicatedStorage:WaitForChild("StrikeHere")

-- Roblox usernames allowed to drive the sim. Everyone else is crew.
local OPERATORS = { ["SlavikUsername"] = true, ["VietUsername"] = true }

local function isOperator(p) return OPERATORS[p.Name] == true end

Players.PlayerAdded:Connect(function(p)
	p:SetAttribute("Operator", isOperator(p))
	stateEvent:FireClient(p, Engine.snapshot())
end)

control.OnServerEvent:Connect(function(p, action, arg)
	if not isOperator(p) then return end
	if action == "load" then Engine.load(arg)
	elseif action == "play" then Engine.play()
	elseif action == "pause" then Engine.pause()
	elseif action == "speed" then Engine.setSpeed(tonumber(arg) or 60)
	end
end)

strikeHere.OnServerEvent:Connect(function(p, pos)
	if not isOperator(p) or typeof(pos) ~= "Vector3" then return end
	local bearing, miles = Lightning.fromPosition(pos)
	Lightning.strike(bearing, miles)
end)

Engine.Changed.Event:Connect(function(snapshot)
	stateEvent:FireAllClients(snapshot)
end)
```

Client side. The panel is built in code so there is nothing to click together in Studio.

```lua
-- ScenarioUI (LocalScript in StarterPlayerScripts)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local control = ReplicatedStorage:WaitForChild("ScenarioControl")
local stateEvent = ReplicatedStorage:WaitForChild("ScenarioState")
local strikeHere = ReplicatedStorage:WaitForChild("StrikeHere")

local gui = Instance.new("ScreenGui")
gui.Name, gui.ResetOnSpawn = "ScenarioUI", false
gui.Parent = player:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.fromOffset(320, 250)
panel.Position = UDim2.new(0, 16, 1, -266)
panel.BackgroundColor3 = Color3.fromRGB(18, 20, 26)
panel.BackgroundTransparency = 0.15
panel.BorderSizePixel = 0
panel.Parent = gui
local list = Instance.new("UIListLayout") list.Padding = UDim.new(0, 6) list.Parent = panel
local pad = Instance.new("UIPadding") pad.PaddingLeft, pad.PaddingTop = UDim.new(0, 8), UDim.new(0, 8) pad.Parent = panel

local function row()
	local f = Instance.new("Frame")
	f.Size, f.BackgroundTransparency, f.Parent = UDim2.new(1, -16, 0, 28), 1, panel
	local l = Instance.new("UIListLayout")
	l.FillDirection, l.Padding, l.Parent = Enum.FillDirection.Horizontal, UDim.new(0, 6), f
	return f
end

local function button(parent, text, width, onClick)
	local b = Instance.new("TextButton")
	b.Size, b.Text, b.Font, b.TextSize = UDim2.fromOffset(width, 28), text, Enum.Font.GothamBold, 13
	b.TextColor3, b.BackgroundColor3, b.BorderSizePixel = Color3.new(1, 1, 1), Color3.fromRGB(45, 50, 62), 0
	b.Parent = parent
	b.MouseButton1Click:Connect(onClick)
	return b
end

local function label(text, height)
	local t = Instance.new("TextLabel")
	t.Size, t.Text, t.Font, t.TextSize = UDim2.new(1, -16, 0, height), text, Enum.Font.Gotham, 14
	t.TextColor3, t.BackgroundTransparency = Color3.fromRGB(230, 230, 235), 1
	t.TextXAlignment, t.TextWrapped, t.Parent = Enum.TextXAlignment.Left, true, panel
	return t
end

local clock = label("No scenario loaded", 22)
local r1 = row()
for _, key in ipairs({ "storm_west", "heat_day", "flash_flood" }) do
	button(r1, key, 96, function() control:FireServer("load", key) end)
end
local r2 = row()
for _, key in ipairs({ "gator", "tipped" }) do
	button(r2, key, 96, function() control:FireServer("load", key) end)
end
local r3 = row()
button(r3, "Play", 60, function() control:FireServer("play") end)
button(r3, "Pause", 60, function() control:FireServer("pause") end)
for _, s in ipairs({ 1, 10, 60 }) do
	button(r3, s .. "x", 46, function() control:FireServer("speed", s) end)
end
local freePlay = false
local r4 = row()
local fp
fp = button(r4, "Free play: off", 150, function()
	freePlay = not freePlay
	fp.Text = "Free play: " .. (freePlay and "on, click the ground" or "off")
end)
local note = label("", 70)

local function clockText(st)
	local h, m = st.clockStart:match("(%d+):(%d+)")
	local minutes = tonumber(h) * 60 + tonumber(m) + st.simTime / 60
	return ("%s   %02d:%02d   %s   %dx"):format(
		st.name, math.floor(minutes / 60) % 24, math.floor(minutes % 60), st.playing and "playing" or "paused", st.speed)
end

stateEvent.OnClientEvent:Connect(function(st)
	if st.name and st.name ~= "" then clock.Text = clockText(st) end
	note.Text = st.note or ""
end)

local mouse = player:GetMouse()
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or not freePlay then return end
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		if mouse.Target then strikeHere:FireServer(mouse.Hit.Position) end
	end
end)

local function refresh() panel.Visible = player:GetAttribute("Operator") == true end
player:GetAttributeChangedSignal("Operator"):Connect(refresh)
refresh()
```

Put the real Roblox usernames into `OPERATORS` before publishing. Judges who join see no panel, only the world, which is what you want.

TEST. Press Play as an operator, click `storm_west`, click `Play`, the clock reads 13:00 and advances a minute per second at 60x. Turn on free play, click the ground 2000 studs away, and a bolt lands there with thunder about 23 seconds later (5 miles).

### 3.8 WeatherFx and the scene

```lua
-- WeatherFx (ModuleScript)
local Lighting = game:GetService("Lighting")
local ServerStorage = game:GetService("ServerStorage")

local WeatherFx = {}

local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
if not atmosphere then
	atmosphere = Instance.new("Atmosphere")
	atmosphere.Parent = Lighting
end
local CLEAR_COLOR = Color3.fromRGB(199, 170, 107)
local STORM_COLOR = Color3.fromRGB(90, 90, 100)

local function emitter()
	local part = workspace:FindFirstChild("RainEmitter")
	return part and part:FindFirstChildOfClass("ParticleEmitter")
end

function WeatherFx.reset()
	Lighting.ClockTime = 15
	atmosphere.Density, atmosphere.Color = 0.4, CLEAR_COLOR
	local e = emitter()
	if e then e.Enabled = false end
	local water = workspace:FindFirstChild("FloodWater")
	if water then water.Transparency = 1 end
	local gator = workspace:FindFirstChild("Gator")
	if gator then gator:Destroy() end
end

function WeatherFx.apply(e)
	local stormy = (e.clouds or 0) > 0.6
	atmosphere.Density = stormy and 0.7 or 0.4
	atmosphere.Color = stormy and STORM_COLOR or CLEAR_COLOR
	Lighting.ClockTime = stormy and 17.5 or 15
	local rain = emitter()
	if rain then
		rain.Enabled = (e.rain or 0) > 0
		rain.Rate = math.clamp((e.rain or 0) * 8, 0, 500)
	end
end

-- FloodWater is an optional flat translucent blue part across the low side of the site
function WeatherFx.setWater(depth_mm)
	local water = workspace:FindFirstChild("FloodWater")
	if water then water.Transparency = depth_mm > 0 and 0.4 or 1 end
end

function WeatherFx.spawnGator()
	if workspace:FindFirstChild("Gator") then return end
	local template = ServerStorage:FindFirstChild("Gator")
	local spot = workspace:FindFirstChild("GatorSpot")
	if template and spot then
		local g = template:Clone()
		g:PivotTo(spot.CFrame)
		g.Parent = workspace
	end
end

return WeatherFx
```

The scene, in order of payoff.

1. Terrain. Home tab, Editor (Terrain Editor), Generate a flat region about 2000 by 2000 studs with Grass, then Paint a strip of Mud for the access road, and use Subtract plus the Sea Level tool on one side to make a slough with Water. Keep the site itself flat so the ZonePart sits on the ground.
2. Toolbox models (View, Toolbox, Models). Search terms that find usable free models quickly: `power line pole`, `utility truck`, `bucket truck`, `excavator`, `alligator`, `construction barrier`, `portable generator`, `hard hat`. Insert, scale, place. Rename the alligator `Gator` and move it to ServerStorage. Put a part named `Bucket` inside the excavator model (or rename its real bucket part) so BeaconVisuals can turn it.
3. Lighting. In the Lighting service set ClockTime 15, Brightness 2, add an Atmosphere (Density 0.4) if there is none, and a Sky from the Toolbox is optional. The storm preset in WeatherFx darkens it when a scenario's clouds pass 0.6.
4. Rain. A transparent Part named `RainEmitter` 150 studs above the site, 400 by 400 studs, with a ParticleEmitter (Texture any raindrop from the Toolbox or the default, Rate 0, Speed 60 to 80, Lifetime 3, Enabled false). WeatherFx turns it on.
5. SiteBillboard. A tall sign near the spawn with the SurfaceGui Status label, so judges arriving on phones see the site name, index, and alerts first.

Nothing is uploaded from disk. Uploaded images and sounds wait on moderation and can vanish mid demo. Toolbox models, library audio, and default textures only.

TEST. Load `storm_west` and play at 60x. At 13:10 the sky darkens and the light turns amber, at 13:35 rain falls. Load `gator` and the alligator appears at the slough after ten seconds at 30x.

## 4. The Bridge (Viet)

### 4.1 Http

```lua
-- Http (ModuleScript in ServerScriptService/Bridge)
local HttpService = game:GetService("HttpService")

local Http = {}
Http.online = false
Http.OnlineChanged = Instance.new("BindableEvent")

local cfg = nil

function Http.configure(source)
	cfg = {
		url = tostring(source:GetAttribute("BACKEND_URL") or ""):gsub("/$", ""),
		token = tostring(source:GetAttribute("SIM_TOKEN") or ""),
		site = tonumber(source:GetAttribute("SITE_ID")) or 1,
	}
	assert(cfg.url ~= "", "Bridge script needs a BACKEND_URL attribute")
	assert(cfg.token ~= "", "Bridge script needs a SIM_TOKEN attribute")
end

function Http.siteId() return cfg.site end

local function setOnline(v)
	if v ~= Http.online then
		Http.online = v
		Http.OnlineChanged:Fire(v)
		print("[Http] online =", v)
	end
end

local function request(method, path, body)
	local req = {
		Url = cfg.url .. path,
		Method = method,
		Headers = { ["X-Token"] = cfg.token, ["Content-Type"] = "application/json" },
	}
	if body then req.Body = HttpService:JSONEncode(body) end
	for attempt = 1, 2 do
		local ok, res = pcall(HttpService.RequestAsync, HttpService, req)
		if ok and res.Success then
			setOnline(true)
			if res.Body and #res.Body > 0 then
				local decoded, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
				return decoded and data or {}
			end
			return {}
		end
		if ok then
			warn(("[Http] %s %s -> %d %s"):format(method, path, res.StatusCode, res.StatusMessage))
		else
			warn(("[Http] %s %s failed: %s"):format(method, path, tostring(res)))
		end
		if attempt == 1 then task.wait(0.5) end
	end
	setOnline(false)
	return nil
end

function Http.post(path, body)
	body.site_id = cfg.site
	return request("POST", path, body)
end

function Http.get(path)
	return request("GET", path)
end

return Http
```

TEST. In a temporary server Script run `local H = require(script.Parent.Http) H.configure(script.Parent.Bridge) print(H.get("/health"))` and see a table and `[Http] online = true` in Output. If you see 403, the `X-Token` does not match `SIM_TOKEN` in the backend's `.env`.

### 4.2 FakeBridge

Commit this first, on Friday night, before anything else in the Bridge folder. It is what lets Slavik build and test every visual before the backend exists. Set `Disabled = true` on it once the real Bridge runs.

```lua
-- FakeBridge (Script in ServerScriptService/Bridge)
local beacon = workspace:WaitForChild("Beacon")
local function set(t) for k, v in pairs(t) do beacon:SetAttribute(k, v) end end

while true do
	set({ Led = "green", Countdown = 0, Index = 3, Interlock = "running", Presence = false, Online = true,
		Lcd1 = "RIG 1  RUNNING", Lcd2 = "BEACON LINK OK", Alerts = "[]" })
	task.wait(8)
	set({ Led = "strobe", Interlock = "locked", Index = 8, Presence = true, Lcd1 = "LOCKED OUT", Alerts = '["stopwork"]' })
	for s = 30, 0, -1 do
		set({ Countdown = s, Lcd2 = ("LIGHTNING 8MI %02d:%02d"):format(s // 60, s % 60) })
		task.wait(1)
	end
	set({ Led = "red", Presence = false, Lcd2 = "NEEDS SUPERVISOR" })
	task.wait(5)
	set({ Led = "green", Interlock = "running", Index = 3, Lcd1 = "RELEASED BY SMITH", Lcd2 = "14:02 SAT OCT 18", Alerts = "[]" })
	task.wait(4)
end
```

TEST. Press Play with no World scripts yet. Select `workspace.Beacon` and watch its attributes change in the Properties panel every second.

### 4.3 Bridge

```lua
-- Bridge (Script in ServerScriptService/Bridge)
-- Attributes on this script: BACKEND_URL (string), SIM_TOKEN (string), SITE_ID (number)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")

local Http = require(script.Parent.Http)
Http.configure(script)

local beacon = workspace:WaitForChild("Beacon")
local events = ReplicatedStorage:WaitForChild("SimEvents")
local SITE = Http.siteId()

-- World -> backend
events.Strike.Event:Connect(function(bearing, miles)
	Http.post("/sim/strike", { bearing = bearing, miles = miles })
end)

events.Weather.Event:Connect(function(w)
	Http.post("/sim/weather", { temp_c = w.temp_c, humidity = w.humidity, precip_mm = w.precip_mm, gust = w.gust })
end)

events.Water.Event:Connect(function(depth_mm)
	Http.post("/sim/water", { depth_mm = depth_mm })
end)

local lastUsers = {}
local function postPresence()
	Http.post("/sim/presence", { count = #lastUsers, users = lastUsers })
end
events.PresenceChanged.Event:Connect(function(count, users)
	lastUsers = users or {}
	postPresence()
end)
task.spawn(function()
	while true do
		task.wait(5)
		if #lastUsers > 0 then postPresence() end
	end
end)

-- backend -> Beacon attributes
local function applyDevice(d)
	beacon:SetAttribute("Led", d.led or "green")
	beacon:SetAttribute("Countdown", d.countdown or 0)
	beacon:SetAttribute("Index", d.index or 0)
	beacon:SetAttribute("Interlock", d.interlock or "running")
	beacon:SetAttribute("Presence", d.presence == true)
	-- Online means the whole chain is up: Roblox can reach the backend and the backend can see the Pi
	beacon:SetAttribute("Online", Http.online and d.online == true)
	local lcd = d.lcd or {}
	beacon:SetAttribute("Lcd1", lcd[1] or "")
	beacon:SetAttribute("Lcd2", lcd[2] or "")
end

task.spawn(function()
	while true do
		local d = Http.get("/sites/" .. SITE .. "/device")
		if d then
			applyDevice(d)
		else
			beacon:SetAttribute("Online", false)
		end
		task.wait(1)
	end
end)

task.spawn(function()
	while true do
		local s = Http.get("/sites/" .. SITE)
		if s then
			local types = {}
			for _, a in ipairs(s.alerts or {}) do
				table.insert(types, a.type)
			end
			beacon:SetAttribute("Alerts", HttpService:JSONEncode(types))
			if s.name then beacon:SetAttribute("SiteName", s.name) end
		end
		task.wait(10)
	end
end)

Http.OnlineChanged.Event:Connect(function(online)
	if not online then beacon:SetAttribute("Online", false) end
end)

print("[Bridge] running against " .. tostring(script:GetAttribute("BACKEND_URL")))
```

The `/sites/{id}` response's `alerts` array is assumed to hold objects with a `type` field (`stopwork`, `flood_warning`, `heat_warning`, `heat_danger`, `beacon_unsafe`). Viet writes both ends, so make the backend match this or change this line, and `SiteName` is a convenience attribute the billboard shows, not part of the contract.

### 4.4 Testing the Bridge

From any laptop, confirm the routes exist before touching Studio. Replace the URL and token.

```
export B=https://your.public.address T=your-sim-token
curl -s $B/health
curl -s -H "X-Token: $T" -H "Content-Type: application/json" -d '{"site_id":1,"bearing":270,"miles":8}' $B/sim/strike
curl -s -H "X-Token: $T" -H "Content-Type: application/json" -d '{"site_id":1,"count":1,"users":["judge1"]}' $B/sim/presence
curl -s $B/sites/1/device
curl -s $B/sites/1 | head -c 600
```

The strike should create a stop work alert, and the device endpoint should show the gateway's last state once the Pi is connected (or an empty default before that).

Then in Studio.

1. Set the three attributes on the Bridge script. `BACKEND_URL` as a string without a trailing slash, `SIM_TOKEN` as a string, `SITE_ID` as a number.
2. Set `FakeBridge.Disabled = true`.
3. Press Play. Output shows `[Bridge] running against ...` then `[Http] online = true`.
4. Fire a strike from the Command Bar or the panel. The backend log shows `POST /sim/strike 200`, and within a second the Beacon's `Led` attribute changes to `strobe` because the Pi's state came back through the device poll.
5. Walk into the ZonePart. The backend log shows `POST /sim/presence` with your username, and again every five seconds while you stand there.

Team Create and Play. Pressing Play in Team Create runs a local test session for you only, with the live copy of all scripts. The other person's Studio does not enter Play. HttpService works in these sessions as long as it is enabled in Game Settings. Use Play (F5) rather than Run so a character exists for the zone test.

TEST. All five numbered checks above pass with the public backend, and the real beacon on the table stops its fan when you fire a strike at 8 miles from the Roblox panel.

## 5. The mic listener page

Why it exists. The physical path needs the Pi to hear the thunder, and the Pi has no microphone. The Roblox client plays thunder out of the demo laptop's speakers. This page, running in a browser tab on the same laptop, listens through the laptop's microphone, detects the thunder, and posts `BANG` with a timestamp to `POST /sim/bang`. The backend relays it to the Pi as `{"cmd":"BANG"}` (see `contracts/gateway-ws.md`), the Pi pairs it with the `FLASH` its photoresistor saw, and the gap in seconds times 343 meters per second is the distance. Slavik owns this file. It lives at `sim/listener/index.html`.

Serve it from the demo laptop with `python3 -m http.server 8090` run inside `sim/listener`, then open `http://localhost:8090`. It must be `localhost` or `https`, a `file://` page is not allowed to use the microphone in every browser. The backend must allow cross origin requests from this page (`Access-Control-Allow-Origin: *` on `/sim/bang` is fine), which is one line in Viet's CORS middleware.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beacon thunder listener</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f1218; color: #e6e8ee; margin: 0; padding: 24px; }
  label { display: block; margin: 10px 0 2px; font-size: 13px; color: #9aa3b5; }
  input { width: 100%; max-width: 480px; padding: 8px; background: #1a1f2a; color: #fff; border: 1px solid #2c3444; border-radius: 6px; }
  button { margin-top: 16px; padding: 12px 20px; font-size: 16px; border: 0; border-radius: 8px; background: #2d6cdf; color: #fff; }
  #meter { height: 24px; background: #1a1f2a; border-radius: 6px; margin-top: 16px; max-width: 480px; overflow: hidden; }
  #bar { height: 100%; width: 0; background: #39c26d; transition: width 60ms linear; }
  #bar.hot { background: #e0483e; }
  #stats, #log { margin-top: 10px; font-family: ui-monospace, monospace; font-size: 13px; color: #9aa3b5; white-space: pre-wrap; max-width: 640px; }
</style>
</head>
<body>
<h2>Thunder listener</h2>
<label>Backend URL</label><input id="url" placeholder="https://your.public.address">
<label>SIM_TOKEN</label><input id="token">
<label>Site id</label><input id="site" value="1">
<button id="start">Start listening</button>
<div id="meter"><div id="bar"></div></div>
<div id="stats">rms 0.0000  baseline 0.0000  ratio 0.0</div>
<div id="log"></div>
<script>
const $ = id => document.getElementById(id);
for (const k of ["url", "token", "site"]) {
  try { $(k).value = localStorage.getItem("listener_" + k) || $(k).value; } catch (e) {}
}
function log(msg) {
  const t = new Date().toLocaleTimeString();
  $("log").textContent = `${t}  ${msg}\n` + $("log").textContent.slice(0, 4000);
}

const RATIO = 4;            // trigger when rms exceeds this many times the baseline
const SUSTAIN_MS = 300;     // for at least this long
const REFRACTORY_MS = 3000; // then ignore for this long
const FLOOR = 0.004;        // never trigger below this absolute rms
const EMA = 0.005;          // baseline follows quiet sound slowly

let analyser, buf, baseline = 0.01, hotSince = 0, lastFire = 0;

async function start() {
  for (const k of ["url", "token", "site"]) {
    try { localStorage.setItem("listener_" + k, $(k).value); } catch (e) {}
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  });
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass"; band.frequency.value = 120; band.Q.value = 1;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(band);
  band.connect(analyser);
  buf = new Float32Array(analyser.fftSize);
  $("start").disabled = true;
  $("start").textContent = "Listening";
  log(`listening, bandpass 120 Hz, trigger at ${RATIO}x baseline for ${SUSTAIN_MS} ms`);
  requestAnimationFrame(tick);
}

function tick(now) {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  const hot = rms > FLOOR && rms > RATIO * baseline;
  if (!hot) {
    baseline += EMA * (rms - baseline);
    hotSince = 0;
  } else if (!hotSince) {
    hotSince = now;
  }
  const inRefractory = now - lastFire < REFRACTORY_MS;
  if (hot && hotSince && now - hotSince >= SUSTAIN_MS && !inRefractory) {
    lastFire = now;
    hotSince = 0;
    fire(rms, baseline);
  }
  $("bar").style.width = Math.min(100, rms * 800) + "%";
  $("bar").className = hot ? "hot" : "";
  $("stats").textContent = `rms ${rms.toFixed(4)}  baseline ${baseline.toFixed(4)}  ratio ${(rms / Math.max(baseline, 1e-6)).toFixed(1)}`;
  requestAnimationFrame(tick);
}

async function fire(rms, base) {
  const ts_us = Math.round(Date.now() * 1000);
  const body = { site_id: Number($("site").value), ts_us };
  log(`BANG  rms ${rms.toFixed(4)} (${(rms / base).toFixed(1)}x baseline)  posting /sim/bang`);
  try {
    const r = await fetch($("url").value.replace(/\/$/, "") + "/sim/bang", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Token": $("token").value },
      body: JSON.stringify(body),
    });
    log(r.ok ? "backend accepted BANG" : "backend returned " + r.status);
  } catch (e) {
    log("POST failed: " + e.message);
  }
}

$("start").addEventListener("click", () => start().catch(e => log("mic error: " + e.message)));
</script>
</body>
</html>
```

`ts_us` is the laptop's wall clock in microseconds. The Pi's firmware uses the arrival time of the `BANG` command on its own clock for the flash to bang gap unless both clocks are NTP synced, which is the gateway's concern, not this page's.

TEST. Start the page, say a few words at normal volume, the bar stays green and nothing fires. Play the thunder clip from Roblox at demo volume, the bar turns red, `BANG ... posting /sim/bang` appears, and `backend accepted BANG` follows. Clap once, nothing fires (a clap is too short for the 300 ms sustain).

## 6. Calibration at the venue

1. Set the demo laptop's screen brightness to maximum and turn off auto brightness and any night mode. Put the Roblox client in full screen (F11) so the white flash fills the panel.
2. Clamp the sensor pod so the photoresistor faces the screen from 10 to 20 cm, centered on the lower third of the display where the ScenarioUI panel is not. Shade it from the ceiling lights with a cardboard hood.
3. Open the kiosk's Health screen on the touchscreen and press TEST FLASH to confirm the pod sees a flash from its own screen, then fire a free play strike in Roblox and confirm the pod prints `FLASH:` for that too. If it misses, move the pod closer or raise the flash threshold in the pod firmware's calibration constant, see the hardware guide.
4. Start the mic listener page. Set the laptop volume so a Roblox thunder at 8 miles makes the bar go red every time, and a person talking at the table does not. Start at 70 percent volume and adjust. If the room is loud, raise `RATIO` to 5.
5. Set `DEMO_COUNTDOWN_SCALE` to 60 in the gateway's `.env` and the backend's `.env` so the 30 minute countdown runs in 30 seconds during the pitch. Set it back to 1 if a judge asks to see real time.
6. Put the Roblox usernames of Slavik and Viet in `OPERATORS` and publish (File, Publish to Roblox). Join from a phone to confirm the experience is public and the panel is hidden for a non operator.
7. Dry run the full demo script from the root CLAUDE.md twice, end to end, with the fan spinning, before the judges arrive.

TEST. From a cold start, `storm_west` at 60x produces four bolts, the fan stops on the 8 mile strike within two seconds of the flash, the touchscreen and the in world beacon show the same countdown, a phone player entering the zone appears on the muster list, and the supervisor PIN releases the equipment with the release line on both LCDs.

## 7. Build order, cut list, credits

### 7.1 Build order

Friday night. Slavik creates the place, turns on Team Create, enables HTTP, builds the Explorer layout from section 2.2, sets the Beacon attributes by hand. Viet commits FakeBridge and Http. Slavik's firmware work takes priority after this, the World scripts fit into gaps.

Saturday morning. Slavik writes Scenarios, ScenarioEngine, Lightning, FlashClient against the FakeBridge. Viet is on backend core, in the order the backend CLAUDE.md gives, until the backend is public.

Saturday afternoon. Viet writes Bridge and tests it against the public backend with the curl checks, disables FakeBridge, and goes back to backend core. Slavik writes Zone, BeaconVisuals, ScenarioUI, WeatherFx, and the mic listener page. Whoever is free (Cam after the kiosk screens) does the terrain and Toolbox scene.

Saturday evening. Full chain test with the real beacon on the table. Calibration section 6. Everything working by 3 AM Sunday.

### 7.2 Cut list

If you are behind, drop in this order. Gator scenario and model. Rain particles and the storm atmosphere. The NPC worker spawn. Free play clicking. The excavator and its bucket. The SiteBillboard.

Never cut these, they are the demo. The flash on every client. The thunder with the distance delay. The strike POST. The device poll writing the Beacon attributes. Zone presence. The storm_west scenario. The mic listener page.

### 7.3 Credits

Everything visual that is not terrain or a plain part came from the Roblox Toolbox and the audio library, which is allowed by the challenge and needs no moderation wait. Keep a list as you insert models (creator name and model name) and put it in the Devpost under Credits, along with the thunder clip's name. State plainly that the scripts in `sim/src/` are the team's own Luau and that no models or sounds were uploaded.
