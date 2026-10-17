-- BeaconVisuals (Script in ServerScriptService/World)
-- Reads the workspace.Beacon attributes the Bridge writes and animates the in world beacon.
-- The light's color, flash pattern, and alarm follow the 0 to 10 hazard index, and a stop work overrides them:
--   index 0-3  ALL CLEAR  green   steady
--   index 4-6  CAUTION    yellow  slow pulse   one chirp when it rises here
--   index 7-8  WARNING    orange  fast pulse   two chirps
--   index 9-10 DANGER     red     rapid pulse  three chirps
--   stop work  STOP WORK  red     4 Hz strobe  horn x3, again on every countdown reset, a chime when it ends
-- Led from the real device still wins when it is more severe than the index band, so the twin never looks safer than the beacon.
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

local OFF = Color3.fromRGB(25, 25, 28)
local DIM_RED = Color3.fromRGB(70, 22, 22)
local LEVELS = {
	[0] = { name = "ALL CLEAR", color = Color3.fromRGB(40, 210, 100), period = 0, chirps = 0 },
	[1] = { name = "CAUTION", color = Color3.fromRGB(255, 200, 0), period = 2.2, chirps = 1 },
	[2] = { name = "WARNING", color = Color3.fromRGB(255, 130, 30), period = 0.7, chirps = 2 },
	[3] = { name = "DANGER", color = Color3.fromRGB(235, 40, 40), period = 0.35, chirps = 3 },
	[4] = { name = "STOP WORK", color = Color3.fromRGB(235, 40, 40), period = 0, chirps = 0 },
}
local LED_LEVEL = { green = 0, yellow = 1, red = 3, strobe = 4 }

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

local function stopWork()
	return attr("Led", "green") == "strobe" or attr("Countdown", 0) > 0
end

local function level()
	if stopWork() then return 4 end
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
-- Built in client sound so it works with nothing uploaded. Set Beacon attribute AlarmSoundId to a Toolbox siren to override.
alarm.SoundId = attr("AlarmSoundId", "rbxasset://sounds/electronicpingshort.wav")
alarm.Volume, alarm.RollOffMaxDistance = 1, 400

local alarmBusy = false
local function beep(times, pitch, gap)
	if alarmBusy then return end
	alarmBusy = true
	task.spawn(function()
		for _ = 1, times do
			alarm.PlaybackSpeed = pitch
			alarm:Play()
			task.wait(gap)
		end
		alarmBusy = false
	end)
end
local function horn() beep(3, 0.45, 0.7) end
local function chime() beep(2, 1.6, 0.25) end

---------------------------------------------------------------- light, tag, zone floor

local current = level()
local function onLevel()
	local new = level()
	if new == current then return end
	if new == 4 then horn()
	elseif current == 4 then chime()
	elseif new > current then beep(LEVELS[new].chirps, 1, 0.3)
	end
	current = new
end

local clock = 0
RunService.Heartbeat:Connect(function(dt) clock += dt end)
task.spawn(function()
	while true do
		local lv = LEVELS[current]
		local k = 1
		if current == 4 then
			k = (clock * 8) % 2 < 1 and 1 or 0
		elseif lv.period > 0 then
			k = 0.55 + 0.45 * math.sin(clock * 2 * math.pi / lv.period)
		end
		light.Color = lv.color:Lerp(OFF, (1 - k) * 0.85)
		if glow then
			glow.Color, glow.Brightness = lv.color, 0.4 + 3.6 * k
		end
		if zoneFloor then zoneFloor.Color = lv.color end
		task.wait(0.05)
	end
end)

local function applyTag()
	if not tag then return end
	local lv = LEVELS[current]
	local s = attr("Countdown", 0)
	tag.Level.Text = current == 4 and s > 0 and ("%s  %s"):format(lv.name, fmt(s)) or lv.name
	tag.Level.TextColor3 = lv.color
	tag.Sub.Text = "HAZARD INDEX " .. fmtIndex(attr("Index", 0))
end

---------------------------------------------------------------- displays

local lastCountdown = attr("Countdown", 0)
local function applyCountdown()
	local s = attr("Countdown", 0)
	countdownLabel.Text = s > 0 and fmt(s) or "--:--"
	countdownLabel.TextColor3 = s > 0 and LEVELS[4].color or DIM_RED
	-- a new strike restarts the countdown, so a jump upward is a reset
	if current == 4 and s > lastCountdown + 5 then horn() end
	lastCountdown = s
end

-- index 0 points left, 5 straight up, 10 right, swinging about the hub
local pivot = hub and hub.CFrame or needle.CFrame
local function applyIndex()
	local idx = math.clamp(attr("Index", 0), 0, 10)
	local turn = CFrame.Angles(0, 0, math.rad(90 - idx * 18))
	local goal = hub and pivot * turn * CFrame.new(0, needle.Size.Y / 2, 0) or pivot * turn
	TweenService:Create(needle, TweenInfo.new(0.6, Enum.EasingStyle.Back), { CFrame = goal }):Play()
end

local function applyLcd()
	lcd1.Text = attr("Lcd1", "")
	lcd2.Text = attr("Lcd2", "")
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
		site, fmtIndex(attr("Index", 0)), LEVELS[current].name, #names > 0 and table.concat(names, "  ·  ") or "NO ACTIVE ALERTS")
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

local handlers = {
	Led = { onLevel, applyTag, applyBillboard },
	Countdown = { onLevel, applyCountdown, applyTag },
	Index = { onLevel, applyIndex, applyTag, applyBillboard },
	Lcd1 = { applyLcd }, Lcd2 = { applyLcd },
	Online = { applyBillboard }, Alerts = { applyBillboard }, SiteName = { applyBillboard },
	Presence = { applyPresence },
	AlarmSoundId = { function() alarm.SoundId = attr("AlarmSoundId", alarm.SoundId) end },
}
for name, fns in pairs(handlers) do
	beacon:GetAttributeChangedSignal(name):Connect(function()
		for _, f in ipairs(fns) do f() end
	end)
end

applyCountdown() applyIndex() applyLcd() applyTag() applyBillboard() applyPresence()
