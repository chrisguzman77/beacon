--!nocheck
-- Builds the main Roblox place, sim/place/PlanITSwamp.rbxl.
--   lune run sim/test/make_place.luau                  scenery from sim/place/BoardwalkScene.rbxl (the boardwalk swamp)
--   lune run sim/test/make_place.luau "<scene.rbxl>"   refresh BoardwalkScene.rbxl from a newer copy of that scene first
-- Installs our two World bundles, Viet's Bridge exactly as committed in sim/src/Bridge (not FakeBridge), and the
-- Bridge attributes BACKEND_URL and SITE_ID. SIM_TOKEN is never written to a file in git; set it in Studio.
local roblox = require("@lune/roblox")
local fs = require("@lune/fs")
local process = require("@lune/process")
local Instance = roblox.Instance

local BACKEND_URL = "https://api.omnirisking-it-all-at-swamphacks.us"
local SITE_ID = 12
local SCENE = "sim/place/BoardwalkScene.rbxl"

local function strip(game)
	local rs, sss, ws = game:GetService("ReplicatedStorage"), game:GetService("ServerScriptService"), game:GetService("Workspace")
	-- the old sim's scripts talk to the Pi directly, outside the contract, and their names collide with ours
	for _, x in ipairs({ rs:FindFirstChild("PlanIT"), ws:FindFirstChild("Script") }) do
		if x then print("removed " .. x:GetFullName()) x:Destroy() end
	end
	for _, d in ipairs(game:GetDescendants()) do
		if d:IsA("LuaSourceContainer") then print("removed " .. d:GetFullName()) d:Destroy() end
	end
end

if process.args[1] then
	local fresh = roblox.deserializePlace(fs.readFile(process.args[1]))
	strip(fresh)
	fs.writeFile(SCENE, roblox.serializePlace(fresh))
	print("refreshed " .. SCENE)
end

local game = roblox.deserializePlace(fs.readFile(SCENE))
strip(game)
local sss = game:GetService("ServerScriptService")

local server = Instance.new("Script")
server.Name, server.Source = "PlanITServer", fs.readFile("sim/place/PlanITServer.server.lua")
server.Parent = sss

local sps = game:GetService("StarterPlayer"):FindFirstChildOfClass("StarterPlayerScripts")
if not sps then
	sps = Instance.new("StarterPlayerScripts")
	sps.Parent = game:GetService("StarterPlayer")
end
local client = Instance.new("LocalScript")
client.Name, client.Source = "PlanITClient", fs.readFile("sim/place/PlanITClient.client.lua")
client.Parent = sps

-- Viet's Bridge, verbatim
local bridgeFolder = Instance.new("Folder")
bridgeFolder.Name = "Bridge"
bridgeFolder.Parent = sss
local http = Instance.new("ModuleScript")
http.Name, http.Source = "Http", fs.readFile("sim/src/Bridge/Http.lua")
http.Parent = bridgeFolder
local bridge = Instance.new("Script")
bridge.Name, bridge.Source = "Bridge", fs.readFile("sim/src/Bridge/Bridge.server.lua")
bridge:SetAttribute("BACKEND_URL", BACKEND_URL)
bridge:SetAttribute("SITE_ID", SITE_ID)
bridge:SetAttribute("SIM_TOKEN", "")
bridge.Parent = bridgeFolder

game:GetService("HttpService").HttpEnabled = true
-- settings scripts may not change at runtime: Future lighting and animated grass, saved into the place itself
local okTech, errTech = pcall(function() game:GetService("Lighting").Technology = roblox.Enum.Technology.Future end)
local terrain = game:GetService("Workspace"):FindFirstChildOfClass("Terrain")
local okDeco, errDeco = pcall(function() if terrain then terrain.Decoration = true end end)
print(("Lighting.Technology Future: %s, Terrain.Decoration: %s"):format(okTech and "set" or tostring(errTech), okDeco and "set" or tostring(errDeco)))

fs.writeFile("sim/place/PlanITSwamp.rbxl", roblox.serializePlace(game))
print("wrote sim/place/PlanITSwamp.rbxl")
