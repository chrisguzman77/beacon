--!nocheck
-- Runs the real PlanIT World bundles outside Roblox with Lune (https://lune-org.github.io).
-- Lune supplies Roblox's real data types and its reflection database, so a wrong property name or a bad value type
-- fails here the way it fails in Studio. The engine pieces Lune does not have (the frame clock, signals, terrain
-- fills, tweens, raycasts) are small stand-ins below. Then it builds the swamp, plays scenarios frame by frame,
-- and checks what the demo needs.
--   lune run sim/test/harness.luau                               the bundles in an empty place, World builds its own swamp
--   lune run sim/test/harness.luau sim/place/PlanITSwampMerged.rbxl  the scripts saved inside that place, run against its scenery
local roblox = require("@lune/roblox")
local luau = require("@lune/luau")
local fs = require("@lune/fs")
local task = require("@lune/task")
local process = require("@lune/process")

local Instance, Vector3, CFrame, Color3 = roblox.Instance, roblox.Vector3, roblox.CFrame, roblox.Color3

---------------------------------------------------------------- stand ins for the engine

local Signal = {}
Signal.__index = Signal
function Signal.new() return setmetatable({ fns = {} }, Signal) end
function Signal:Connect(fn)
	table.insert(self.fns, fn)
	return { Disconnect = function() end }
end
function Signal:Fire(...)
	for _, fn in ipairs(table.clone(self.fns)) do fn(...) end
end
function Signal:Wait() return task.wait() end

local perInstance = {}
local function signalOf(inst, key)
	perInstance[inst] = perInstance[inst] or {}
	perInstance[inst][key] = perInstance[inst][key] or Signal.new()
	return perInstance[inst][key]
end

-- WaitForChild waits up to 5 s in real time for something another script creates
local function waitForChild(self, name)
	for _ = 1, 500 do
		local c = self:FindFirstChild(name)
		if c then return c end
		task.wait(0.01)
	end
	error("WaitForChild timed out: " .. self:GetFullName() .. "." .. name)
end
local CLASSES = { "Instance", "DataModel", "Workspace", "StarterPlayer", "StarterPlayerScripts", "ReplicatedStorage", "ServerStorage",
	"ServerScriptService", "Players", "Player", "PlayerGui", "Model", "Part", "Folder", "SurfaceGui", "BillboardGui", "Terrain", "Lighting" }
for _, class in ipairs(CLASSES) do
	roblox.implementMethod(class, "WaitForChild", waitForChild)
end

local heartbeat, renderStepped = Signal.new(), Signal.new()
roblox.implementProperty("RunService", "Heartbeat", function() return heartbeat end)
roblox.implementProperty("RunService", "RenderStepped", function() return renderStepped end)
roblox.implementMethod("RunService", "IsStudio", function() return true end)

local fired = { strike = {}, weather = {}, water = {}, presence = {}, flash = {} }
roblox.implementProperty("BindableEvent", "Event", function(self) return signalOf(self, "Event") end)
roblox.implementMethod("BindableEvent", "Fire", function(self, ...)
	local list = fired[string.lower(self.Name == "PresenceChanged" and "presence" or self.Name)]
	if list then table.insert(list, { ... }) end
	signalOf(self, "Event"):Fire(...)
end)
roblox.implementProperty("RemoteEvent", "OnServerEvent", function(self) return signalOf(self, "OnServerEvent") end)
roblox.implementProperty("RemoteEvent", "OnClientEvent", function(self) return signalOf(self, "OnClientEvent") end)
roblox.implementMethod("RemoteEvent", "FireAllClients", function(self, ...)
	if self.Name == "FlashEvent" then table.insert(fired.flash, { ... }) end
	signalOf(self, "OnClientEvent"):Fire(...)
end)
roblox.implementMethod("RemoteEvent", "FireClient", function(self, _player, ...) signalOf(self, "OnClientEvent"):Fire(...) end)
roblox.implementMethod("RemoteEvent", "FireServer", function(self, ...) signalOf(self, "OnServerEvent"):Fire(LOCAL_PLAYER, ...) end)

for _, class in ipairs({ "Workspace", "Model", "Part", "SpawnLocation", "Folder", "Instance" }) do
	roblox.implementMethod(class, "GetAttributeChangedSignal", function(self, name) return signalOf(self, "attr:" .. name) end)
end

local terrainOps = { FillBlock = 0, FillCylinder = 0 }
roblox.implementMethod("Terrain", "FillBlock", function(_, cf, size, mat)
	assert(typeof(cf) == "CFrame" and typeof(size) == "Vector3" and typeof(mat) == "EnumItem", "FillBlock args")
	terrainOps.FillBlock += 1
end)
roblox.implementMethod("Terrain", "FillCylinder", function(_, cf, h, r, mat)
	assert(typeof(cf) == "CFrame" and type(h) == "number" and type(r) == "number" and typeof(mat) == "EnumItem", "FillCylinder args")
	terrainOps.FillCylinder += 1
end)
roblox.implementMethod("Terrain", "Clear", function() end)
roblox.implementMethod("Terrain", "SetMaterialColor", function(_, mat, color)
	assert(typeof(mat) == "EnumItem" and typeof(color) == "Color3", "SetMaterialColor args")
end)
roblox.implementMethod("Workspace", "Raycast", function() return nil end)
roblox.implementMethod("Workspace", "GetPartBoundsInBox", function() return {} end)

local function isPart(x) return x:IsA("BasePart") end
local function modelPivot(m)
	if m.PrimaryPart then return m.PrimaryPart.CFrame end
	for _, d in ipairs(m:GetDescendants()) do if isPart(d) then return d.CFrame end end
	return CFrame.new()
end
for _, class in ipairs({ "Model", "Workspace" }) do
	roblox.implementMethod(class, "GetPivot", modelPivot)
	roblox.implementMethod(class, "PivotTo", function(m, cf)
		local delta = cf * modelPivot(m):Inverse()
		for _, d in ipairs(m:GetDescendants()) do
			if isPart(d) then d.CFrame = delta * d.CFrame end
		end
	end)
end
for _, class in ipairs({ "Part", "SpawnLocation" }) do
	roblox.implementMethod(class, "GetPivot", function(p) return p.CFrame end)
	roblox.implementMethod(class, "PivotTo", function(p, cf) p.CFrame = cf end)
end

roblox.implementMethod("TweenService", "Create", function(_, inst, _info, goal)
	return { Play = function() for k, v in pairs(goal) do inst[k] = v end end }
end)
roblox.implementMethod("Debris", "AddItem", function(_, inst, t) task.delay(t, function() inst:Destroy() end) end)
roblox.implementMethod("Sound", "Play", function() end)

roblox.implementProperty("Sound", "Ended", function(self) return signalOf(self, "Ended") end)

roblox.implementMethod("Players", "GetPlayers", function() return {} end)
roblox.implementProperty("Players", "PlayerAdded", function(self) return signalOf(self, "PlayerAdded") end)
roblox.implementMethod("Players", "GetPlayerFromCharacter", function() return nil end)
roblox.implementMethod("Players", "CreateHumanoidModelFromDescription", function()
	local m = Instance.new("Model")
	local root = Instance.new("Part"); root.Name = "HumanoidRootPart"; root.Parent = m
	local head = Instance.new("Part"); head.Name = "Head"; head.Parent = m
	Instance.new("Humanoid").Parent = m
	m.PrimaryPart = root
	return m
end)
roblox.implementProperty("Player", "Character", function() return nil end)
roblox.implementMethod("Player", "GetMouse", function() return { Target = nil } end)
roblox.implementProperty("TextButton", "MouseButton1Click", function(self) return signalOf(self, "click") end)
roblox.implementProperty("UserInputService", "InputBegan", function(self) return signalOf(self, "InputBegan") end)

local TweenInfo = { new = function() return {} end }
local RaycastParams = { new = function() return {} end }
local OverlapParams = { new = function() return {} end }
local Random = {
	new = function(seed)
		local state = (seed or 1) % 2147483647
		local function nxt()
			state = (state * 48271) % 2147483647
			return state / 2147483647
		end
		return {
			NextNumber = function(_, a, b) a, b = a or 0, b or 1 return a + (b - a) * nxt() end,
			NextInteger = function(_, a, b) return a + math.floor(nxt() * (b - a + 1)) end,
		}
	end,
}

---------------------------------------------------------------- the place

local PLACE = process.args[1]
local game = PLACE and roblox.deserializePlace(fs.readFile(PLACE)) or Instance.new("DataModel")
local workspace = game:GetService("Workspace")
if not PLACE then
	local terrain = Instance.new("Terrain"); terrain.Name = "Terrain"; terrain.Parent = workspace
	local baseplate = Instance.new("Part"); baseplate.Name = "Baseplate"; baseplate.Parent = workspace
end
local MERGED = workspace:FindFirstChild("PlanITSite") ~= nil
-- Lune has no default for Sound.SoundId, so the Thunder sound starts with one, as it does once set in Studio
local thunder = game:GetService("ReplicatedStorage"):FindFirstChild("Thunder")
if not thunder then
	thunder = Instance.new("Sound"); thunder.Name = "Thunder"; thunder.Parent = game:GetService("ReplicatedStorage")
end
thunder.SoundId = "rbxassetid://0"
if not game:GetService("StarterPlayer"):FindFirstChildOfClass("StarterPlayerScripts") then
	Instance.new("StarterPlayerScripts").Parent = game:GetService("StarterPlayer")
end
LOCAL_PLAYER = Instance.new("Player"); LOCAL_PLAYER.Name = "Slavik"
local playerGui = Instance.new("PlayerGui"); playerGui.Parent = LOCAL_PLAYER
LOCAL_PLAYER.Parent = game:GetService("Players")
roblox.implementProperty("Players", "LocalPlayer", function() return LOCAL_PLAYER end)

local env = {
	game = game, workspace = workspace, Instance = Instance, Vector3 = Vector3, Vector2 = roblox.Vector2,
	CFrame = CFrame, Color3 = Color3, UDim2 = roblox.UDim2, UDim = roblox.UDim, Enum = roblox.Enum,
	ColorSequence = roblox.ColorSequence, ColorSequenceKeypoint = roblox.ColorSequenceKeypoint,
	NumberSequence = roblox.NumberSequence, NumberRange = roblox.NumberRange,
	TweenInfo = TweenInfo, RaycastParams = RaycastParams, OverlapParams = OverlapParams, Random = Random,
	LOCAL_PLAYER = LOCAL_PLAYER, task = task, typeof = typeof, warn = function(...) print("WARN", ...) end,
}
local scriptErrors = 0
local function run(path, inPlace)
	-- a place under test runs the scripts saved inside it, otherwise the bundle files
	local src = inPlace and inPlace.Source or fs.readFile(path)
	-- Lune cannot set Players.LocalPlayer, so the client reads the test player directly
	src = src:gsub("Players%.LocalPlayer", "LOCAL_PLAYER")
	local fn = luau.load(src, { debugName = path, environment = setmetatable(env, { __index = _G }) })
	return fn()
end

local function site_floating() return workspace.Site.Floating:GetChildren() end
local failures = 0
local function check(ok, what)
	print((ok and "  PASS  " or "  FAIL  ") .. what)
	if not ok then failures += 1 end
end

-- push changed Beacon attributes to their GetAttributeChangedSignal, which Lune's SetAttribute does not fire
local lastAttrs = {}
local function pumpAttributes()
	for _, inst in ipairs({ workspace:FindFirstChild("Beacon"), workspace }) do
		if inst then
			for k, v in pairs(inst:GetAttributes()) do
				local key = tostring(inst) .. k
				if lastAttrs[key] ~= v then
					lastAttrs[key] = v
					signalOf(inst, "attr:" .. k):Fire()
				end
			end
		end
	end
end

local function step(seconds, dt)
	dt = dt or 0.1
	for _ = 1, math.ceil(seconds / dt) do
		heartbeat:Fire(dt)
		renderStepped:Fire(dt)
		pumpAttributes()
		task.wait()
	end
end

---------------------------------------------------------------- run

print("== server bundle")
if PLACE then
	local n = 0
	for _, d in ipairs(game:GetDescendants()) do if d:IsA("LuaSourceContainer") then n += 1 print("  script in place: " .. d:GetFullName()) end end
	assert(n == 2, "the place should hold exactly our two scripts, found " .. n)
end
run("sim/place/PlanITServer.server.lua", PLACE and game:GetService("ServerScriptService"):FindFirstChild("PlanITServer"))
print("== client bundle")
run("sim/place/PlanITClient.client.lua", PLACE and game:GetService("StarterPlayer"):FindFirstChildOfClass("StarterPlayerScripts"):FindFirstChild("PlanITClient"))
task.wait(0.2)

print("== build")
local site = workspace:FindFirstChild("Site")
if MERGED then
	local scene = workspace.PlanITSite
	check(scene:FindFirstChild("Beacon") == nil and scene:FindFirstChild("RainSheet") == nil, "old beacon and rain retired")
	local bp = workspace.Beacon.Base.CFrame.Position
	check(math.abs(bp.Y - 9.4) < 0.01 and math.abs(bp.X + 6) < 0.01, ("our beacon stands on the platform deck (post center %.1f, %.1f, %.1f)"):format(bp.X, bp.Y, bp.Z))
	local sp = scene:FindFirstChildOfClass("SpawnLocation").CFrame.Position
	check(sp.X < -30, ("spawn out on the boardwalk, outside the zone (x %.0f)"):format(sp.X))
	check(#site_floating() >= 160, "their lily pads and boat ride the flood (" .. #site_floating() .. ")")
	check(scene:FindFirstChild("Boardwalk") and scene:FindFirstChild("Trees") and scene:FindFirstChild("StaffGauge"), "their boardwalk, cypress, and staff gauge kept")
else
check(workspace:FindFirstChild("Baseplate") == nil, "baseplate removed")
check(site ~= nil, "Site folder built")
check(terrainOps.FillCylinder >= 15 and terrainOps.FillBlock >= 4, ("terrain filled (%d blocks, %d cylinders)"):format(terrainOps.FillBlock, terrainOps.FillCylinder))
end
local wild = site and site:FindFirstChild("Wildlife")
local gators, egrets = 0, 0
for _, m in ipairs(wild and wild:GetChildren() or {}) do
	if m.Name == "SwampGator" then gators += 1 elseif m.Name == "Egret" then egrets += 1 end
end
check(gators == 6, "6 alligators in the swamp (" .. gators .. ")")
check(egrets >= 5, "egrets wading (" .. egrets .. ")")
local cypress, moss = 0, 0
for _, d in ipairs(site:GetChildren()) do
	if d.Name == "Trunk" then cypress += 1 elseif d.Name == "Moss" then moss += 1 end
end
if not MERGED then
	check(cypress >= 100 and moss >= 200, ("cypress and pine trunks %d, moss strands %d"):format(cypress, moss))
end
local beacon = workspace:FindFirstChild("Beacon")
check(beacon and beacon:GetAttribute("Led") == "green" and beacon:FindFirstChild("Light"), "beacon with its nine attributes")
check(workspace:FindFirstChild("ZonePart") and workspace:FindFirstChild("FloodWater") and (MERGED or workspace:FindFirstChild("SpawnLocation")), "zone, flood plane, spawn")
check(game:GetService("ServerStorage"):FindFirstChild("Gator") ~= nil, "gator scenario template")
local rs = game:GetService("ReplicatedStorage")
check(rs:FindFirstChild("SimEvents") and #rs.SimEvents:GetChildren() == 4 and rs:FindFirstChild("FlashEvent"), "SimEvents (4) and FlashEvent for the Bridge contract")
local panel = LOCAL_PLAYER.PlayerGui:FindFirstChild("ScenarioUI")
local buttons = 0
for _, d in ipairs(panel and panel:GetDescendants() or {}) do if d:IsA("TextButton") then buttons += 1 end end
check(panel and LOCAL_PLAYER.PlayerGui:FindFirstChild("FlashGui") and buttons == 12, "client panel with 12 buttons (6 scenarios, play, 4 speeds, free play) and flash overlay (" .. buttons .. ")")

print("== storm_west (Studio auto play after 5 s)")
task.wait(5.2)
step(45, 0.25)
local miles = {}
for _, s in ipairs(fired.strike) do table.insert(miles, s[2]) end
check(#fired.flash == 4 and #fired.strike == 4, ("4 flashes and 4 Strike events (%d, %d)"):format(#fired.flash, #fired.strike))
check(table.concat(miles, ",") == "15,11,8,6", "strike miles 15,11,8,6 (" .. table.concat(miles, ",") .. ")")
check(#fired.weather >= 3, "weather events posted (" .. #fired.weather .. ")")
check(workspace:GetAttribute("Storm") and workspace:GetAttribute("Storm") > 0.6, "sky went to storm")
local Lightning = nil
check(#fired.water >= 1 and fired.water[#fired.water][1] == 10, "water pools at the end (10 mm)")

print("== beacon follows the index")
local tag = beacon.Light.LevelTag
beacon:SetAttribute("Countdown", 0); beacon:SetAttribute("Led", "green")
beacon:SetAttribute("Index", 5); step(0.3)
check(tag.Level.Text == "CAUTION", "index 5 -> CAUTION (" .. tag.Level.Text .. ")")
beacon:SetAttribute("Index", 7.5); step(0.3)
check(tag.Level.Text == "WARNING" and tag.Sub.Text == "HAZARD INDEX 7.5", "index 7.5 -> WARNING (" .. tag.Level.Text .. ", " .. tag.Sub.Text .. ")")
beacon:SetAttribute("Index", 9); step(0.3)
check(tag.Level.Text == "DANGER", "index 9 -> DANGER")
beacon:SetAttribute("Countdown", 1800); beacon:SetAttribute("Led", "strobe"); step(0.3)
check(tag.Level.Text == "STOP WORK  30:00", "stop work -> STOP WORK  30:00 (" .. tag.Level.Text .. ")")
check(beacon.Display.SurfaceGui.Countdown.Text == "30:00", "countdown display 30:00")
beacon:SetAttribute("Countdown", 0); beacon:SetAttribute("Led", "green"); beacon:SetAttribute("Index", 2); step(0.3)
check(tag.Level.Text == "ALL CLEAR", "clear -> ALL CLEAR")

print("== hurricane")
local control = rs.ScenarioControl
local boat = site.Floating.Boat
local boatY0 = boat.PrimaryPart.CFrame.Position.Y
local strikes0 = #fired.strike
control:FireServer("load", "hurricane")
control:FireServer("play")
step(60, 0.25)
local flood = workspace.FloodWater
local top = flood.CFrame.Position.Y + flood.Size.Y / 2
check(#fired.strike - strikes0 == 4, "4 hurricane strikes (" .. (#fired.strike - strikes0) .. ")")
check(fired.water[#fired.water][1] == 100, "flood reaches 100 mm")
check(top > 4 and flood.Transparency < 0.5, ("flood water over the pad, top at %.1f studs, transparency %.2f"):format(top, flood.Transparency))
check(boat.PrimaryPart.CFrame.Position.Y > boatY0 + 3, ("boat floated up %.1f studs"):format(boat.PrimaryPart.CFrame.Position.Y - boatY0))
check(workspace.GlobalWind.Magnitude > 30, ("hurricane wind %.0f"):format(workspace.GlobalWind.Magnitude))

print("== flash flood and reset")
control:FireServer("load", "flash_flood")
step(0.5)
check(workspace.FloodWater.Transparency == 1, "loading a scenario drains the flood")
control:FireServer("play")
step(40, 0.25)
check(workspace.FloodWater.CFrame.Position.Y > 1, "flash flood rises")

print("== free play bearing")
local o = workspace.Beacon:GetPivot().Position
rs.StrikeHere.OnServerEvent:Fire(LOCAL_PLAYER, Vector3.new(o.X - 240, 0, o.Z))
local last = fired.strike[#fired.strike]
check(math.abs(last[1] - 270) < 0.5 and math.abs(last[2] - 2) < 0.01, ("click 240 studs west -> bearing %.0f, %.1f mi"):format(last[1], last[2]))

print(failures == 0 and "ALL CHECKS PASSED" or (failures .. " CHECK(S) FAILED"))
process.exit(failures == 0 and 0 or 1)
