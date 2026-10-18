-- ScenarioServer (Script in ServerScriptService/World)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Engine = require(script.Parent.ScenarioEngine)
local Lightning = require(script.Parent.Lightning)
local Scenarios = require(script.Parent.Scenarios)
local WeatherFx = require(script.Parent.WeatherFx)

-- two settings: the Everglades jobsite (the contract's site 12) and the Mississippi crossing. Switching moves the
-- operators there, the rain, and the point lightning is measured from. Judges stay at the main site and its zone.
local function siteOrigin(site)
	local river = workspace:FindFirstChild("RiverBeacon")
	if site == "river" and river then return river:GetPivot().Position end
	return workspace.Beacon:GetPivot().Position
end
local function siteSpawn(site)
	if site == "river" then
		local r = workspace:FindFirstChild("Site") and workspace.Site:FindFirstChild("RiverSite")
		local sp = r and r:FindFirstChild("RiverSpawn")
		return sp and sp.CFrame
	end
	local scene = workspace:FindFirstChild("PlanITSite")
	local sp = (scene and scene:FindFirstChildOfClass("SpawnLocation")) or workspace:FindFirstChildOfClass("SpawnLocation")
	return sp and sp.CFrame
end
local operatorList -- set below, once isOperator exists
local function setSite(site, who)
	if site ~= "river" then site = "everglades" end
	local moved = workspace:GetAttribute("ActiveSite") ~= site
	workspace:SetAttribute("ActiveSite", site)
	WeatherFx.moveRain(siteOrigin(site))
	if not moved then return end
	local cf = siteSpawn(site)
	for _, p in ipairs(who or operatorList()) do
		local character = p.Character
		if character and cf then character:PivotTo(cf + Vector3.new(0, 4, 0)) end
	end
end

-- Demo mode plays the challenge day as a guided timeline: the DemoDirector on operator screens cuts the camera to
-- each moment and captions it, and the day loops a few seconds after the 6 PM briefing.
local DEMO_SCENARIO, DEMO_SPEED, DEMO_PAUSE = "everglades_day", 600, 6
-- the demo runs the quiet hours fast and slows for the moments that matter: about 75 seconds for the whole day
local DEMO_PACE = {
	{ upTo = 2600,  speed = 900 }, -- dawn
	{ upTo = 3000,  speed = 150 }, -- the gator report
	{ upTo = 18800, speed = 1200 }, -- the morning heats up
	{ upTo = 19400, speed = 200 }, -- noon heat, the crew to the tent
	{ upTo = 25800, speed = 1200 }, -- the storm builds west
	{ upTo = 29500, speed = 120 }, -- the strikes, stop work, the reset
	{ upTo = 33000, speed = 300 }, -- the downpour and the flood
	{ upTo = math.huge, speed = 1200 }, -- to the 6 PM briefing
}
local function demoSpeed(t)
	for _, p in ipairs(DEMO_PACE) do
		if t < p.upTo then return p.speed end
	end
	return DEMO_SPEED
end
local function lastEventT(key)
	local last = 0
	for _, e in ipairs(Scenarios[key].events) do last = math.max(last, e.t) end
	return last
end
local function startDemo()
	setSite("everglades")
	Engine.load(DEMO_SCENARIO)
	Engine.setSpeed(demoSpeed(0))
	workspace:SetAttribute("DemoMode", true)
	Engine.play()
end

-- Instant buttons: each fires its events once, now, through the engine, so the Bridge posts them like any scenario
local CALM = { type = "weather", clouds = 0.3, rain = 0, temp_c = 29, humidity = 70, gust = 8 }
local INSTANT = {
	strike8 = { { type = "strike", bearing = 270, miles = 8 } },
	strike6 = { { type = "strike", bearing = 255, miles = 6 } },
	strike15 = { { type = "strike", bearing = 270, miles = 15 } },
	heat = { { type = "weather", clouds = 0.2, rain = 0, temp_c = 36, humidity = 62, gust = 10 } },
	flood = { { type = "weather", clouds = 0.95, rain = 55, temp_c = 27, humidity = 95, gust = 30 }, { type = "water", depth_mm = 60 } },
	wind = { { type = "weather", clouds = 0.8, rain = 10, temp_c = 30, humidity = 80, gust = 45 } },
	gator = { { type = "wildlife", species = "American alligator" } },
	calm = { CALM, { type = "water", depth_mm = 0 } },
}

local control = ReplicatedStorage:WaitForChild("ScenarioControl")
local stateEvent = ReplicatedStorage:WaitForChild("ScenarioState")
local strikeHere = ReplicatedStorage:WaitForChild("StrikeHere")

-- Roblox usernames allowed to drive the sim. Everyone else is crew. In Studio, everyone is an operator.
local OPERATORS = { ["SlavikUsername"] = true, ["VietUsername"] = true }

local function isOperator(p) return OPERATORS[p.Name] == true or RunService:IsStudio() end
operatorList = function()
	local list = {}
	for _, p in ipairs(Players:GetPlayers()) do
		if isOperator(p) then table.insert(list, p) end
	end
	return list
end

Players.PlayerAdded:Connect(function(p)
	p:SetAttribute("Operator", isOperator(p))
	stateEvent:FireClient(p, Engine.snapshot())
end)

control.OnServerEvent:Connect(function(p, action, arg)
	if not isOperator(p) then return end
	if action == "demo" then startDemo() return end
	if action == "site" then setSite(arg, { p }) return end
	if action == "instant" then
		local events = INSTANT[arg]
		if not events then return end
		-- make sure a clock is running so a stop work can count down to its all clear
		if not Engine.loadedKey() then
			workspace:SetAttribute("DemoMode", false)
			Engine.load("instant")
		end
		if not Engine.isPlaying() then Engine.play() end
		for _, e in ipairs(events) do
			Engine.fire(e)
		end
		print(("[Instant] %s by %s"):format(arg, p.Name))
		return
	end
	if action == "load" then workspace:SetAttribute("DemoMode", false) end
	if action == "load" and Scenarios[arg] then setSite(Scenarios[arg].site or "everglades") end
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

local looping = false
Engine.Changed.Event:Connect(function(snapshot)
	stateEvent:FireAllClients(snapshot)
	if workspace:GetAttribute("DemoMode") and snapshot.key == DEMO_SCENARIO and snapshot.speed ~= demoSpeed(snapshot.simTime) then
		Engine.setSpeed(demoSpeed(snapshot.simTime))
	end
	if workspace:GetAttribute("DemoMode") and snapshot.key == DEMO_SCENARIO and not looping
		and snapshot.simTime > lastEventT(DEMO_SCENARIO) + 600 then
		looping = true
		task.delay(DEMO_PAUSE, function()
			looping = false
			if workspace:GetAttribute("DemoMode") then startDemo() end
		end)
	end
end)
