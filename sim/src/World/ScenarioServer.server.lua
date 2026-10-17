-- ScenarioServer (Script in ServerScriptService/World)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Engine = require(script.Parent.ScenarioEngine)
local Lightning = require(script.Parent.Lightning)
local Scenarios = require(script.Parent.Scenarios)

-- Demo mode plays the challenge day as a guided timeline: the DemoDirector on operator screens cuts the camera to
-- each moment and captions it, and the day loops a few seconds after the 6 PM briefing.
local DEMO_SCENARIO, DEMO_SPEED, DEMO_PAUSE = "everglades_day", 300, 8
local function lastEventT(key)
	local last = 0
	for _, e in ipairs(Scenarios[key].events) do last = math.max(last, e.t) end
	return last
end
local function startDemo()
	Engine.load(DEMO_SCENARIO)
	Engine.setSpeed(DEMO_SPEED)
	workspace:SetAttribute("DemoMode", true)
	Engine.play()
end

local control = ReplicatedStorage:WaitForChild("ScenarioControl")
local stateEvent = ReplicatedStorage:WaitForChild("ScenarioState")
local strikeHere = ReplicatedStorage:WaitForChild("StrikeHere")

-- Roblox usernames allowed to drive the sim. Everyone else is crew. In Studio, everyone is an operator.
local OPERATORS = { ["SlavikUsername"] = true, ["VietUsername"] = true }

local function isOperator(p) return OPERATORS[p.Name] == true or RunService:IsStudio() end

Players.PlayerAdded:Connect(function(p)
	p:SetAttribute("Operator", isOperator(p))
	stateEvent:FireClient(p, Engine.snapshot())
end)

control.OnServerEvent:Connect(function(p, action, arg)
	if not isOperator(p) then return end
	if action == "demo" then startDemo() return end
	if action == "load" then workspace:SetAttribute("DemoMode", false) end
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
	if workspace:GetAttribute("DemoMode") and snapshot.key == DEMO_SCENARIO and not looping
		and snapshot.simTime > lastEventT(DEMO_SCENARIO) + 600 then
		looping = true
		task.delay(DEMO_PAUSE, function()
			looping = false
			if workspace:GetAttribute("DemoMode") then startDemo() end
		end)
	end
end)
