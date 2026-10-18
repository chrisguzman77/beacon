-- BeaconVisuals (Script in ServerScriptService/World)
-- Animates the in world beacon. Each hazard has its own light color, flash pattern, label, and alarm, so a crew can
-- tell from across the site what the beacon is warning about. With no hazard the light follows the 0 to 10 index.
--   STOP WORK      lightning inside 10 mi   red strobe 4 Hz       3 bursts of fast high beeps, again on every reset
--   E-STOP         emergency stop           red fast flash        rapid beeps
--   BEACON TIPPED  pod knocked over         purple fast flash     two tone warble
--   FLOOD          water on the pad         blue wave             rising sweep
--   HEAT DANGER    heat index 115 F+        red orange slow pulse slow two tone, three times
--   HEAT WARNING   heat index 103 F+        orange slow pulse     slow two tone, twice
--   GATOR ON SITE  wildlife report          yellow double blink   chirp chirp, pause, chirp chirp
--   all clear when the last hazard ends: a rising three note chime
--   index 0-3 green steady, 4-6 yellow slow pulse, 7-8 orange fast pulse, 9-10 red rapid pulse, chirps as it rises
-- Hazards come from the backend (Alerts, Led, Countdown, which the Bridge writes) and from the sim's own picture
-- (Conditions writes SimStopWork, HeatIndexF, SimFloodMm, SimWildlife). The worse of the two wins, so the twin
-- never looks safer than the real beacon and still reacts when the backend is unreachable.
-- Every alarm is short, high beeps on purpose: the mic listener hears thunder as a sustained rumble near 120 Hz,
-- so a low horn out of the demo laptop's speakers could be heard as thunder and fake a flash to bang distance.
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")
local TweenService = game:GetService("TweenService")

local beacon = workspace:WaitForChild("Beacon")
local light = beacon:WaitForChild("Light")
local glow = light:FindFirstChildOfClass("PointLight")
local tag = light:FindFirstChild("LevelTag")
local countdownLabel = beacon:WaitForChild("Display"):WaitForChild("SurfaceGui"):WaitForChild("Countdown")
local needle = beacon:WaitForChild("Needle")
local hub = beacon:FindFirstChild("NeedleHub")
local lcdGui = beacon:WaitForChild("Lcd"):WaitForChild("SurfaceGui")
local lcd1, lcd2 = lcdGui:WaitForChild("Line1"), lcdGui:WaitForChild("Line2")
local billboardPart = workspace:WaitForChild("SiteBillboard")
local billboard = billboardPart:WaitForChild("SurfaceGui"):WaitForChild("Status")
local zone = workspace:WaitForChild("ZonePart")
local zoneFloor = zone:FindFirstChild("ZoneFloor")
local excavator = workspace:FindFirstChild("Excavator")
-- the river crossing's beacon light shows exactly what this one shows
local mirror = workspace:FindFirstChild("RiverBeacon")
local mirrorLight = mirror and mirror:FindFirstChild("Light")
local mirrorGlow = mirrorLight and mirrorLight:FindFirstChildOfClass("PointLight")
local mirrorTag = mirrorLight and mirrorLight:FindFirstChild("LevelTag")

local OFF = Color3.fromRGB(25, 25, 28)
local DIM_RED = Color3.fromRGB(70, 22, 22)
local RED = Color3.fromRGB(235, 40, 40)

-- alarm patterns: { pitch, seconds until the next beep }
local function rep(n, seq)
	local out = {}
	for _ = 1, n do
		for _, b in ipairs(seq) do table.insert(out, b) end
	end
	return out
end
local HAZARDS = {
	estop = { rank = 7, label = "E-STOP", sub = "PIN TO RESET", color = RED, pattern = "fast",
		alarm = rep(8, { { 1.3, 0.12 } }) },
	stopwork = { rank = 6, label = "STOP WORK", sub = "LIGHTNING INSIDE 10 MI", color = RED, pattern = "strobe",
		alarm = rep(3, { { 1.5, 0.1 }, { 1.5, 0.1 }, { 1.5, 0.4 } }) },
	beacon_unsafe = { rank = 5, label = "BEACON TIPPED", sub = "SENSORS UNRELIABLE", color = Color3.fromRGB(170, 90, 255), pattern = "fast",
		alarm = rep(3, { { 1.15, 0.22 }, { 0.95, 0.22 } }) },
	flood = { rank = 4, label = "FLOOD", sub = "WATER ON THE PAD", color = Color3.fromRGB(60, 140, 255), pattern = "wave",
		alarm = rep(2, { { 0.9, 0.16 }, { 1.05, 0.16 }, { 1.2, 0.16 }, { 1.35, 0.16 }, { 1.5, 0.5 } }) },
	wind = { rank = 3.5, label = "HIGH WIND", sub = "AERIAL LIFTS GROUNDED, 28 MPH+", color = Color3.fromRGB(0, 200, 200), pattern = "pulse",
		alarm = rep(2, { { 1.2, 0.14 }, { 1.0, 0.14 }, { 1.2, 0.45 } }) },
	heat_danger = { rank = 3, label = "HEAT DANGER", sub = "REST BREAKS, WATER", color = Color3.fromRGB(255, 90, 40), pattern = "slow",
		alarm = rep(3, { { 1.0, 0.45 }, { 1.25, 0.45 } }) },
	heat_warning = { rank = 2, label = "HEAT WARNING", sub = "HYDRATE, WATCH THE CREW", color = Color3.fromRGB(255, 150, 30), pattern = "slow",
		alarm = rep(2, { { 1.0, 0.45 }, { 1.25, 0.45 } }) },
	wildlife = { rank = 1, label = "GATOR ON SITE", sub = "KEEP 30 FT, CHECK THE MAP", color = Color3.fromRGB(255, 210, 0), pattern = "double",
		alarm = rep(2, { { 1.8, 0.09 }, { 1.8, 0.45 } }) },
}
local ALL_CLEAR = { { 1.0, 0.2 }, { 1.26, 0.2 }, { 1.5, 0.6 } }
-- backend alert types (contracts/events.md) mapped onto the beacon's hazards
local ALERT_HAZARD = {
	stopwork = "stopwork", estop = "estop", beacon_unsafe = "beacon_unsafe",
	flood_warning = "flood", flood_confirmed = "flood", heat_danger = "heat_danger", heat_warning = "heat_warning",
	wildlife = "wildlife",
}
local LEVELS = {
	[0] = { name = "ALL CLEAR", color = Color3.fromRGB(40, 210, 100), pattern = "steady", chirps = 0 },
	[1] = { name = "CAUTION", color = Color3.fromRGB(255, 200, 0), pattern = "slow", chirps = 1 },
	[2] = { name = "WARNING", color = Color3.fromRGB(255, 130, 30), pattern = "pulse", chirps = 2 },
	[3] = { name = "DANGER", color = RED, pattern = "rapid", chirps = 3 },
}
local LED_LEVEL = { green = 0, yellow = 1, red = 3 }

local function attr(name, default)
	local v = beacon:GetAttribute(name)
	if v == nil then return default end
	return v
end

local function fmt(seconds)
	seconds = math.max(0, math.floor(seconds))
	return ("%02d:%02d"):format(seconds // 60, seconds % 60)
end

local function fmtIndex(i)
	return i % 1 == 0 and ("%d"):format(i) or ("%.1f"):format(i)
end

-- the countdown to show: the real beacon's when it runs one, otherwise the sim's own 30 minute rule
local function countdown()
	local real = attr("Countdown", 0)
	if real > 0 then return real end
	return workspace:GetAttribute("SimCountdown") or 0
end

local function activeHazards()
	local set = {}
	local ok, alerts = pcall(HttpService.JSONDecode, HttpService, attr("Alerts", "[]"))
	if ok and typeof(alerts) == "table" then
		for _, a in ipairs(alerts) do
			local h = ALERT_HAZARD[tostring(a)]
			if h then set[h] = true end
		end
	end
	if attr("Led", "green") == "strobe" or attr("Countdown", 0) > 0 or workspace:GetAttribute("SimStopWork") == true then
		set.stopwork = true
	end
	local hi = workspace:GetAttribute("HeatIndexF") or 0
	if hi >= 115 then set.heat_danger = true elseif hi >= 103 then set.heat_warning = true end
	if set.heat_danger then set.heat_warning = nil end
	if (workspace:GetAttribute("SimFloodMm") or 0) > 0 then set.flood = true end
	if workspace:GetAttribute("SimWildlife") == true then set.wildlife = true end
	if (workspace:GetAttribute("SimGustMph") or 0) >= 28 then set.wind = true end
	return set
end

local function topOf(set)
	local top
	for key in pairs(set) do
		if not top or HAZARDS[key].rank > HAZARDS[top].rank then top = key end
	end
	return top
end

local function indexLevel()
	local i = attr("Index", 0)
	local band = i >= 9 and 3 or i >= 7 and 2 or i >= 4 and 1 or 0
	return math.max(band, LED_LEVEL[attr("Led", "green")] or 0)
end

---------------------------------------------------------------- alarm

local alarm = light:FindFirstChild("Alarm")
if not alarm then
	alarm = Instance.new("Sound")
	alarm.Name = "Alarm"
	alarm.Parent = light
end
-- Built in client sound so it works with nothing uploaded. Set Beacon attribute AlarmSoundId to override.
alarm.SoundId = attr("AlarmSoundId", "rbxasset://sounds/electronicpingshort.wav")
alarm.Volume, alarm.RollOffMaxDistance = 1, 400

local queue = {}
local function sound(name, pattern)
	light:SetAttribute("LastAlarm", name)
	table.insert(queue, pattern)
end
task.spawn(function()
	while true do
		local pattern = table.remove(queue, 1)
		if pattern then
			for _, b in ipairs(pattern) do
				alarm.PlaybackSpeed = b[1]
				alarm:Play()
				task.wait(b[2])
			end
			task.wait(0.3)
		else
			task.wait(0.1)
		end
	end
end)

---------------------------------------------------------------- state: hazards first, then the index

local active, top, level = {}, nil, indexLevel()
local function look()
	if top then return HAZARDS[top] end
	return LEVELS[level]
end

local function update()
	local set = activeHazards()
	for key in pairs(set) do
		if not active[key] then sound(key, HAZARDS[key].alarm) end -- each new hazard announces itself
	end
	local newTop = topOf(set)
	if top and not newTop then sound("all_clear", ALL_CLEAR) end
	local newLevel = indexLevel()
	if not newTop and newLevel > level then
		sound("index", rep(LEVELS[newLevel].chirps, { { 1.0, 0.3 } }))
	end
	active, top, level = set, newTop, newLevel
end

local clock = 0
RunService.Heartbeat:Connect(function(dt) clock += dt end)
local PERIOD = { wave = 1.2, slow = 2.2, pulse = 0.7, rapid = 0.35 }
local function brightness(pattern)
	if pattern == "strobe" then return (clock * 8) % 2 < 1 and 1 or 0 end
	if pattern == "fast" then return (clock * 5) % 2 < 1 and 1 or 0.1 end
	if pattern == "double" then
		local p = clock % 1.4
		return ((p < 0.15) or (p > 0.3 and p < 0.45)) and 1 or 0.1
	end
	local period = PERIOD[pattern]
	if period then return 0.55 + 0.45 * math.sin(clock * 2 * math.pi / period) end
	return 1
end
task.spawn(function()
	while true do
		local lk = look()
		local k = brightness(lk.pattern)
		light.Color = lk.color:Lerp(OFF, (1 - k) * 0.85)
		if glow then
			glow.Color, glow.Brightness = lk.color, 0.4 + 3.6 * k
		end
		if zoneFloor then zoneFloor.Color = lk.color end
		if mirrorLight then
			mirrorLight.Color = light.Color
			if mirrorGlow then mirrorGlow.Color, mirrorGlow.Brightness = lk.color, 0.4 + 3.6 * k end
		end
		task.wait(0.05)
	end
end)

-- Live risk for the 0 to 10 meter: the model's next day Index, raised to the floor of the worst hazard active now,
-- so a stop work reads 10 instead of the 1 the model forecast. The text keeps the model's Index for the dashboard.
local RISK_FLOOR = { estop = 10, stopwork = 10, beacon_unsafe = 9, heat_danger = 9, heat_warning = 7, wind = 7, wildlife = 5 }
local function floodFloor()
	-- confirmed (backend flood_confirmed, the river over its levee, or 30 mm on the pad) is 9; a warning or watch is 6
	local ok, alerts = pcall(HttpService.JSONDecode, HttpService, attr("Alerts", "[]"))
	local warned = false
	if ok and typeof(alerts) == "table" then
		for _, a in ipairs(alerts) do
			if a == "flood_confirmed" then return 9 end
			if a == "flood_warning" then warned = true end
		end
	end
	if workspace:GetAttribute("RiverOvertop") == true or (workspace:GetAttribute("SimFloodMm") or 0) >= 30 then return 9 end
	if warned or (workspace:GetAttribute("SimFloodMm") or 0) > 0 then return 6 end
	return 0
end
local function liveRisk()
	local risk = 0
	for key in pairs(active) do
		risk = math.max(risk, key == "flood" and floodFloor() or RISK_FLOOR[key] or 0)
	end
	return math.max(math.clamp(attr("Index", 0), 0, 10), risk)
end

local function applyTag()
	if not tag then return end
	local lk = look()
	local s = countdown()
	tag.Level.Text = top == "stopwork" and s > 0 and ("%s  %s"):format(lk.label, fmt(s)) or (lk.label or lk.name)
	tag.Level.TextColor3 = lk.color
	local others = 0
	for key in pairs(active) do
		if key ~= top then others += 1 end
	end
	local risk = liveRisk()
	local sub = (top and (HAZARDS[top].sub .. "  ·  ") or "") .. "HAZARD INDEX " .. fmtIndex(attr("Index", 0))
		.. (risk > attr("Index", 0) and ("  ·  LIVE RISK " .. fmtIndex(risk)) or "")
	tag.Sub.Text = others > 0 and ("%s  ·  +%d MORE"):format(sub, others) or sub
	if mirrorTag then
		mirrorTag.Level.Text, mirrorTag.Level.TextColor3, mirrorTag.Sub.Text = tag.Level.Text, tag.Level.TextColor3, tag.Sub.Text
	end
end

---------------------------------------------------------------- displays

local lastCountdown = countdown()
local function applyCountdown()
	local s = countdown()
	countdownLabel.Text = s > 0 and fmt(s) or "--:--"
	countdownLabel.TextColor3 = s > 0 and RED or DIM_RED
	-- a new strike restarts the countdown, so a jump upward is a reset: sound the stop work alarm again
	if top == "stopwork" and s > lastCountdown + 5 then sound("stopwork", HAZARDS.stopwork.alarm) end
	lastCountdown = s
end

-- index 0 points left, 5 straight up, 10 right, swinging about the hub
local pivot = hub and hub.CFrame or needle.CFrame
local function applyIndex()
	local idx = liveRisk() -- the needle shows live risk; it eases back to the model's Index when hazards clear
	if beacon:GetAttribute("LiveRisk") ~= idx then beacon:SetAttribute("LiveRisk", idx) end
	local turn = CFrame.Angles(0, 0, math.rad(70 - idx * 14)) -- +-70 degrees so 0 and 10 stand clear of the gauge edge
	local goal = hub and pivot * turn * CFrame.new(0, needle.Size.Y / 2, 0) or pivot * turn
	TweenService:Create(needle, TweenInfo.new(1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut), { CFrame = goal }):Play()
end

-- The equipment LCD mirrors the real beacon's lines while the Bridge is online. Offline, it shows the sim's own
-- state using the beacon LCD lines from contracts/serial.md, 16 characters a line.
local function cut(text) return text:sub(1, 16) end
local function simLcd()
	local hi = workspace:GetAttribute("HeatIndexF") or 0
	if top == "stopwork" then
		local miles = workspace:GetAttribute("SimStrikeMiles") or 0
		return ("STOP WORK  %s"):format(fmt(countdown())), miles > 0 and ("LIGHTNING %d MI"):format(math.floor(miles + 0.5)) or "LIGHTNING"
	elseif top == "flood" then
		return "STANDING WATER", ("WATER %d MM"):format(math.floor((workspace:GetAttribute("SimFloodMm") or 0) + 0.5))
	elseif top == "heat_danger" then
		return "HEAT REST BREAK", ("HEAT INDEX %dF"):format(hi)
	elseif top == "heat_warning" then
		return "HEAT WARNING", ("HEAT INDEX %dF"):format(hi)
	elseif top == "wildlife" then
		return "GATOR ON SITE", "KEEP 30 FT"
	elseif top == "wind" then
		return "HIGH WIND", "AERIAL LIFTS DOWN"
	end
	return "ALL CLEAR  IDX " .. fmtIndex(attr("Index", 0)), "LOCAL RULES ON"
end
local function applyLcd()
	if attr("Online", false) == true then
		lcd1.Text, lcd2.Text = cut(attr("Lcd1", "")), cut(attr("Lcd2", ""))
	else
		local a, b = simLcd()
		lcd1.Text, lcd2.Text = cut(a), cut(b)
	end
end

local function applyBillboard()
	-- the Bridge writes the backend's site name onto the Beacon, the scene's own label is the fallback
	local site = (attr("SiteName", nil) or billboardPart:GetAttribute("SiteName") or "SITE 1"):upper()
	if attr("Online", false) ~= true then
		billboard.Text = site .. "\nBEACON OFFLINE"
		return
	end
	local names = {}
	local ok, alerts = pcall(HttpService.JSONDecode, HttpService, attr("Alerts", "[]"))
	if ok and typeof(alerts) == "table" then
		for _, a in ipairs(alerts) do
			table.insert(names, (tostring(a):gsub("_", " ")):upper())
		end
	end
	billboard.Text = ("%s\nHAZARD INDEX %s / 10  ·  %s\n%s"):format(
		site, fmtIndex(attr("Index", 0)), look().label or look().name, #names > 0 and table.concat(names, "  ·  ") or "NO ACTIVE ALERTS")
end

---------------------------------------------------------------- NPC worker

-- ServerStorage.NpcWorker if someone built one, otherwise a hi-vis R15 made in code
local function makeWorker()
	local template = ServerStorage:FindFirstChild("NpcWorker")
	if template then return template:Clone() end
	local d = Instance.new("HumanoidDescription")
	local vest, pants = Color3.fromRGB(255, 120, 20), Color3.fromRGB(40, 55, 90)
	d.HeadColor = Color3.fromRGB(204, 142, 105)
	d.TorsoColor, d.LeftArmColor, d.RightArmColor = vest, vest, vest
	d.LeftLegColor, d.RightLegColor = pants, pants
	local m = Players:CreateHumanoidModelFromDescription(d, Enum.HumanoidRigType.R15)
	m.Name = "NpcWorker"
	local head = m:FindFirstChild("Head")
	if head then
		local hat = Instance.new("Part")
		hat.Name, hat.Color, hat.Material = "HardHat", LEVELS[1].color, Enum.Material.SmoothPlastic
		hat.Size, hat.CanCollide, hat.Massless = Vector3.new(1.4, 0.45, 1.4), false, true
		hat.CFrame = head.CFrame * CFrame.new(0, 0.6, 0)
		local weld = Instance.new("WeldConstraint")
		weld.Part0, weld.Part1, weld.Parent = head, hat, hat
		hat.Parent = m
	end
	return m
end

local npc, spawning = nil, false
local function applyPresence()
	local present = attr("Presence", false) == true
	if present and not npc and not spawning then
		spawning = true
		local ok, m = pcall(makeWorker)
		spawning = false
		if not ok then warn("[BeaconVisuals] NPC worker failed: " .. tostring(m)) return end
		if attr("Presence", false) ~= true then m:Destroy() return end
		local hum = m:FindFirstChildOfClass("Humanoid")
		if hum then hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None end
		local floorY = zone.CFrame.Position.Y - zone.Size.Y / 2
		local pos = Vector3.new(zone.CFrame.Position.X + 8, floorY + 3, zone.CFrame.Position.Z + 6)
		m:PivotTo(CFrame.lookAt(pos, Vector3.new(beacon:GetPivot().X, pos.Y, beacon:GetPivot().Z)))
		if m:FindFirstChild("HumanoidRootPart") then m.HumanoidRootPart.Anchored = true end
		m.Parent = workspace
		npc = m
	elseif not present and npc then
		npc:Destroy()
		npc = nil
	end
end

-- interlock: the excavator's upper works swing while the equipment is running and freeze when locked
local upper = excavator and excavator:FindFirstChild("Upper")
if upper and upper.PrimaryPart then
	local rest = upper:GetPivot()
	local t = 0
	RunService.Heartbeat:Connect(function(dt)
		if attr("Interlock", "running") == "locked" then return end
		t += dt
		upper:PivotTo(rest * CFrame.Angles(0, math.rad(35) * math.sin(t * 0.7), 0))
	end)
end

---------------------------------------------------------------- wiring

local function refresh() update() applyTag() applyLcd() applyIndex() end
local handlers = {
	Led = { refresh, applyBillboard },
	Countdown = { refresh, applyCountdown },
	Index = { refresh, applyIndex, applyBillboard },
	Alerts = { refresh, applyBillboard },
	Lcd1 = { applyLcd }, Lcd2 = { applyLcd },
	Online = { applyBillboard, applyLcd }, SiteName = { applyBillboard },
	Presence = { applyPresence },
	AlarmSoundId = { function() alarm.SoundId = attr("AlarmSoundId", alarm.SoundId) end },
}
for name, fns in pairs(handlers) do
	beacon:GetAttributeChangedSignal(name):Connect(function()
		for _, f in ipairs(fns) do f() end
	end)
end
for _, name in ipairs({ "SimStopWork", "HeatIndexF", "SimFloodMm", "SimWildlife", "SimGustMph" }) do
	workspace:GetAttributeChangedSignal(name):Connect(refresh)
end
workspace:GetAttributeChangedSignal("SimCountdown"):Connect(function() applyCountdown() applyTag() applyLcd() end)

update()
applyCountdown() applyIndex() applyLcd() applyTag() applyBillboard() applyPresence()
