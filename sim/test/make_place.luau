--!nocheck
-- Writes sim/place/PlanITSwamp.rbxl: an empty place with the two World bundles installed and a Thunder sound.
-- Open it in Roblox Studio and press Play. The swamp builds itself.   lune run sim/test/make_place.luau
local roblox = require("@lune/roblox")
local fs = require("@lune/fs")
local Instance = roblox.Instance

local game = Instance.new("DataModel")
local ws = game:GetService("Workspace")
local spawn = Instance.new("SpawnLocation")
spawn.Name, spawn.Anchored = "SpawnLocation", true
spawn.Size, spawn.CFrame = roblox.Vector3.new(12, 1, 12), roblox.CFrame.new(0, 0, 100)
spawn.Parent = ws

local server = Instance.new("Script")
server.Name = "PlanITServer"
server.Source = fs.readFile("sim/place/PlanITServer.server.lua")
server.Parent = game:GetService("ServerScriptService")

local sps = Instance.new("StarterPlayerScripts")
sps.Parent = game:GetService("StarterPlayer")
local client = Instance.new("LocalScript")
client.Name = "PlanITClient"
client.Source = fs.readFile("sim/place/PlanITClient.client.lua")
client.Parent = sps

local thunder = Instance.new("Sound")
thunder.Name, thunder.SoundId, thunder.Volume = "Thunder", "", 1
thunder.Parent = game:GetService("ReplicatedStorage")

fs.writeFile("sim/place/PlanITSwamp.rbxl", roblox.serializePlace(game))
print("wrote sim/place/PlanITSwamp.rbxl")
