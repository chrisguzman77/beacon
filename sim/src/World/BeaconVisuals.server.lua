-- BeaconVisuals (Script in ServerScriptService/World)
-- Reads the workspace.Beacon attributes the Bridge writes and animates the in world beacon.
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")
local TweenService = game:GetService("TweenService")

local beacon = workspace:WaitForChild("Beacon")
local light = beacon:WaitForChild("Light")
local glow = light:FindFirstChildOfClass("PointLight")
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

local COLORS = {
	green = Color3.fromRGB(40, 210, 100),
	yellow = Color3.fromRGB(255, 190, 0),
	red = Color3.fromRGB(235, 40, 40),
	off = Color3.fromRGB(25, 25, 28),
	dimRed = Color3.fromRGB(70, 22, 22),
}

local function attr(name, default)
	local v = beacon:GetAttribute(name)
	if v == nil then return default end
	return v
end

local function fmt(seconds)
	seconds = math.max(0, math.floor(seconds))
	return ("%02d:%02d"):format(seconds // 60, seconds % 60)
end

-- the light, its glow, and the zone floor tint always share one color
local function setLight(color, on)
	light.Color = on and color or COLORS.off
	if glow then
		glow.Color, glow.Enabled = color, on
	end
	if zoneFloor then zoneFloor.Color = color end
end

local function applyLed()
	local led = attr("Led", "green")
	if led ~= "strobe" then
		setLight(COLORS[led] or COLORS.green, true)
	end
end

local function applyCountdown()
	local s = attr("Countdown", 0)
	countdownLabel.Text = s > 0 and fmt(s) or "--:--"
	countdownLabel.TextColor3 = s > 0 and COLORS.red or COLORS.dimRed
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
	local site = billboardPart:GetAttribute("SiteName") or "SITE 1"
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
	billboard.Text = ("%s\nHAZARD INDEX %d / 10\n%s"):format(
		site, attr("Index", 0), #names > 0 and table.concat(names, "  ·  ") or "NO ACTIVE ALERTS")
end

-- NPC worker: ServerStorage.NpcWorker if someone built one, otherwise a hi-vis R15 made in code
local function makeWorker()
	local template = ServerStorage:FindFirstChild("NpcWorker")
	if template then return template:Clone() end
	local d = Instance.new("HumanoidDescription")
	d.HeadColor = Color3.fromRGB(204, 142, 105)
	d.TorsoColor, d.LeftArmColor, d.RightArmColor = Color3.fromRGB(255, 120, 20), Color3.fromRGB(255, 120, 20), Color3.fromRGB(255, 120, 20)
	d.LeftLegColor, d.RightLegColor = Color3.fromRGB(40, 55, 90), Color3.fromRGB(40, 55, 90)
	local m = Players:CreateHumanoidModelFromDescription(d, Enum.HumanoidRigType.R15)
	m.Name = "NpcWorker"
	local head = m:FindFirstChild("Head")
	if head then
		local hat = Instance.new("Part")
		hat.Name, hat.Color, hat.Material = "HardHat", COLORS.yellow, Enum.Material.SmoothPlastic
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
		local floorY = zone.Position.Y - zone.Size.Y / 2
		local pos = Vector3.new(zone.Position.X + 8, floorY + 3, zone.Position.Z + 6)
		m:PivotTo(CFrame.lookAt(pos, Vector3.new(beacon:GetPivot().X, pos.Y, beacon:GetPivot().Z)))
		if m:FindFirstChild("HumanoidRootPart") then m.HumanoidRootPart.Anchored = true end
		m.Parent = workspace
		npc = m
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
			setLight(COLORS.red, on)
		end
		task.wait(0.125)
	end
end)

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
