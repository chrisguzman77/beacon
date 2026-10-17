--!nocheck
-- Writes a ready to open Roblox place with the two World bundles installed.
--   lune run sim/test/make_place.luau                         -> sim/place/PlanITSwamp.rbxl, empty place, the World builds its own swamp
--   lune run sim/test/make_place.luau "<scene.rbxl>"          -> sim/place/PlanITSwampMerged.rbxl, that place's scenery kept,
--                                                                its own scripts removed, our World fitted into it
local roblox = require("@lune/roblox")
local fs = require("@lune/fs")
local process = require("@lune/process")
local Instance = roblox.Instance

local source = process.args[1]
local game, out
if source then
	game = roblox.deserializePlace(fs.readFile(source))
	out = "sim/place/PlanITSwampMerged.rbxl"
	local rs, sss, ws = game:GetService("ReplicatedStorage"), game:GetService("ServerScriptService"), game:GetService("Workspace")
	-- retire the old sim's scripts: they talk to the Pi directly, outside the contract, and their names collide with ours
	for _, x in ipairs({ rs:FindFirstChild("PlanIT"), sss:FindFirstChild("PlanITServer"), ws:FindFirstChild("Script") }) do
		if x then print("removed " .. x:GetFullName()) x:Destroy() end
	end
	for _, sps in ipairs(game:GetService("StarterPlayer"):GetChildren()) do
		local c = sps:FindFirstChild("PlanITClient")
		if c then print("removed " .. c:GetFullName()) c:Destroy() end
	end
else
	game = Instance.new("DataModel")
	out = "sim/place/PlanITSwamp.rbxl"
	local spawn = Instance.new("SpawnLocation")
	spawn.Name, spawn.Anchored = "SpawnLocation", true
	spawn.Size, spawn.CFrame = roblox.Vector3.new(12, 1, 12), roblox.CFrame.new(0, 0, 100)
	spawn.Parent = game:GetService("Workspace")
end

local server = Instance.new("Script")
server.Name = "PlanITServer"
server.Source = fs.readFile("sim/place/PlanITServer.server.lua")
server.Parent = game:GetService("ServerScriptService")

local sps = game:GetService("StarterPlayer"):FindFirstChildOfClass("StarterPlayerScripts")
if not sps then
	sps = Instance.new("StarterPlayerScripts")
	sps.Parent = game:GetService("StarterPlayer")
end
local client = Instance.new("LocalScript")
client.Name = "PlanITClient"
client.Source = fs.readFile("sim/place/PlanITClient.client.lua")
client.Parent = sps

local rs = game:GetService("ReplicatedStorage")
if not rs:FindFirstChild("Thunder") then
	local thunder = Instance.new("Sound")
	thunder.Name, thunder.SoundId, thunder.Volume = "Thunder", "", 1
	thunder.Parent = rs
end

fs.writeFile(out, roblox.serializePlace(game))
print("wrote " .. out)
