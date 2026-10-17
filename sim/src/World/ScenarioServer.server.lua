-- ScenarioServer (Script in ServerScriptService/World)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Engine = require(script.Parent.ScenarioEngine)
local Lightning = require(script.Parent.Lightning)

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
