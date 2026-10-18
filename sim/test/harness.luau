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
local serde = require("@lune/serde")
local net = require("@lune/net")
-- LIVE=1 sends the Bridge's requests to the real backend. Without SIM_TOKEN the posts come back 401, which still
-- proves the route, the JSON, and the header. With SIM_TOKEN set they create real events on that site.
local LIVE = process.env.LIVE == "1"
-- the Bridge polls forever, so a test that stops on an error would never exit: give up after 10 minutes
task.delay(600, function() print("WATCHDOG: test took over 10 minutes, giving up") process.exit(3) end)

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
local function waitForChild(self, name, timeout)
	for _ = 1, (timeout and math.min(timeout, 5) or 5) * 100 do
		local c = self:FindFirstChild(name)
		if c then return c end
		task.wait(0.01)
	end
	if timeout then return nil end -- with a timeout Roblox returns nil instead of waiting forever
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
roblox.implementMethod("Camera", "GetPropertyChangedSignal", function(self, name) return signalOf(self, "prop:" .. name) end)
roblox.implementProperty("UserInputService", "InputBegan", function(self) return signalOf(self, "InputBegan") end)

local httpLog = {}
roblox.implementMethod("HttpService", "JSONEncode", function(_, v) return serde.encode("json", v) end)
roblox.implementMethod("HttpService", "JSONDecode", function(_, s) return serde.decode("json", s) end)
roblox.implementMethod("HttpService", "RequestAsync", function(_, req)
	assert(type(req.Url) == "string" and type(req.Method) == "string", "RequestAsync needs Url and Method")
	local entry = { method = req.Method, url = req.Url, body = req.Body, token = req.Headers and req.Headers["X-Token"] }
	table.insert(httpLog, entry)
	if not LIVE then
		entry.status = 0
		return { Success = false, StatusCode = 0, StatusMessage = "offline test", Body = "" }
	end
	local res = net.request({ url = req.Url, method = req.Method, headers = req.Headers, body = req.Body })
	entry.status, entry.response = res.statusCode, res.body
	return { Success = res.ok, StatusCode = res.statusCode, StatusMessage = res.statusMessage, Body = res.body }
end)

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
local loaded = {}
local function load(src, name, inst)
	-- Lune cannot set Players.LocalPlayer, so the client reads the test player directly
	src = src:gsub("Players%.LocalPlayer", "LOCAL_PLAYER")
	-- Lune puts its own metatable on the environment, so copy the shared globals in rather than inherit them
	local scriptEnv = table.clone(env)
	scriptEnv.script = inst
	scriptEnv.require = function(mod)
		if typeof(mod) ~= "Instance" then return require(mod) end
		if loaded[mod] == nil then loaded[mod] = load(mod.Source, mod:GetFullName(), mod)() end
		return loaded[mod]
	end
	return luau.load(src, { debugName = name, environment = scriptEnv })
end
local function run(path, inPlace)
	-- a place under test runs the scripts saved inside it, otherwise the bundle files
	local src = inPlace and inPlace.Source or fs.readFile(path)
	return load(src, inPlace and inPlace:GetFullName() or path, inPlace)()
end

local function shiftLogHas(text)
	local ok, entries = pcall(serde.decode, "json", workspace:GetAttribute("ShiftLog") or "[]")
	if not ok then return false end
	for _, e in ipairs(entries) do if e:find(text, 1, true) then return true end end
	return false
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
	assert(n == 4, "the place should hold our two scripts plus the Bridge and its Http module, found " .. n)
end
run("sim/place/PlanITServer.server.lua", PLACE and game:GetService("ServerScriptService"):FindFirstChild("PlanITServer"))
print("== client bundle")
run("sim/place/PlanITClient.client.lua", PLACE and game:GetService("StarterPlayer"):FindFirstChildOfClass("StarterPlayerScripts"):FindFirstChild("PlanITClient"))
local bridgeScript = PLACE and game:GetService("ServerScriptService"):FindFirstChild("Bridge")
bridgeScript = bridgeScript and bridgeScript:FindFirstChild("Bridge")
if bridgeScript then
	print("== Viet's Bridge from the place" .. (LIVE and ", LIVE against " .. bridgeScript:GetAttribute("BACKEND_URL") or ", offline"))
	bridgeScript:SetAttribute("SIM_TOKEN", process.env.SIM_TOKEN or "harness-no-token")
	task.spawn(function()
		local ok, err = pcall(run, nil, bridgeScript)
		if not ok then print("BRIDGE ERROR", err) end
	end)
end
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
if MERGED then
	local dress = workspace.Site:FindFirstChild("Jobsite")
	local words = {}
	for _, d in ipairs(dress and dress:GetDescendants() or {}) do
		if d.Name == "Signal" then words[d.Text] = (words[d.Text] or 0) + 1 end
	end
	check(words.DANGER and words.WARNING and words.CAUTION and words.NOTICE and words.SAFETY,
		"ANSI style signs: DANGER, WARNING, CAUTION, NOTICE, SAFETY")
	check(dress:FindFirstChild("ReelFlange") and dress:FindFirstChild("Generator") and dress:FindFirstChild("Drum"), "conductor reel, generator, road drums on site")
end
local rs = game:GetService("ReplicatedStorage")
check(rs:FindFirstChild("SimEvents") and #rs.SimEvents:GetChildren() == 4 and rs:FindFirstChild("FlashEvent"), "SimEvents (4) and FlashEvent for the Bridge contract")
local panel = LOCAL_PLAYER.PlayerGui:FindFirstChild("ScenarioUI")
local buttons = 0
for _, d in ipairs(panel and panel:GetDescendants() or {}) do if d:IsA("TextButton") then buttons += 1 end end
check(panel and LOCAL_PLAYER.PlayerGui:FindFirstChild("FlashGui") and buttons == 27, "client panel with 27 buttons (collapse, demo, 2 sites, 8 instant, 9 scenarios, play, 4 speeds, free play) and flash overlay (" .. buttons .. ")")

print("== Play opens calm and idle, the demo starts from its button")
task.wait(5.2)
step(0.5)
check(workspace:GetAttribute("DemoMode") ~= true and #fired.strike == 0, "pressing Play starts nothing on its own")
rs.ScenarioControl:FireServer("demo")
step(0.5)
local caption = LOCAL_PLAYER.PlayerGui:FindFirstChild("DemoCaption")
check(workspace:GetAttribute("DemoMode") == true and caption and caption:FindFirstChild("Caption", true).Text:find("06:45") ~= nil,
	"demo mode on, caption narrating 06:45 (" .. (caption and caption:FindFirstChild("Caption", true).Text:sub(1, 60) or "no caption") .. ")")
step(10, 0.25) -- 3000 s of the day at 300x, past the gator
check(caption:FindFirstChild("Caption", true).Text:find("gator") ~= nil, "demo caption moves on to the gator (" .. caption:FindFirstChild("Caption", true).Text:sub(1, 50) .. ")")

print("== storm_west")
local control = rs.ScenarioControl
control:FireServer("load", "storm_west")
check(workspace:GetAttribute("DemoMode") == false, "picking a scenario takes over from the demo")
step(1)
check(workspace:GetAttribute("SimTime") ~= nil and workspace:GetAttribute("SimTime") > 0, "one click on a scenario loads and plays it")
step(45, 0.25)
local miles = {}
for _, s in ipairs(fired.strike) do table.insert(miles, s[2]) end
check(#fired.flash == 4 and #fired.strike == 4, ("4 flashes and 4 Strike events (%d, %d)"):format(#fired.flash, #fired.strike))
check(table.concat(miles, ",") == "15,11,8,6", "strike miles 15,11,8,6 (" .. table.concat(miles, ",") .. ")")
check(#fired.weather >= 3, "weather events posted (" .. #fired.weather .. ")")
check(workspace:GetAttribute("Storm") and workspace:GetAttribute("Storm") > 0.6, "sky went to storm")
local Lightning = nil
check(#fired.water >= 1 and fired.water[#fired.water][1] == 10, "water pools at the end (10 mm)")

if LIVE and bridgeScript then
	print("== backend link (live)")
	task.wait(4)
	local dev = serde.decode("json", net.request(bridgeScript:GetAttribute("BACKEND_URL") .. "/sites/12/device").body)
	local b = workspace.Beacon
	check(b:GetAttribute("SiteName") == "Seminole (FL)", "site name from GET /sites/12 (" .. tostring(b:GetAttribute("SiteName")) .. ")")
	check(b:GetAttribute("Lcd1") == dev.lcd[1] and b:GetAttribute("Index") == dev.index and b:GetAttribute("Led") == dev.led,
		("Beacon mirrors GET /sites/12/device (led %s, index %s, lcd %q)"):format(dev.led, tostring(dev.index), dev.lcd[1]))
	check(string.find(b:GetAttribute("Alerts") or "", "flood") ~= nil, "active alerts from the backend (" .. tostring(b:GetAttribute("Alerts")) .. ")")
	local posts = {}
	for _, h in ipairs(httpLog) do
		if h.method == "POST" then
			local route = h.url:match("/sim/%w+")
			posts[route] = posts[route] or {}
			table.insert(posts[route], h.status)
		end
	end
	for route, codes in pairs(posts) do
		print(("  POST %s x%d -> %s"):format(route, #codes, table.concat(codes, ",")))
	end
	check(posts["/sim/strike"] and #posts["/sim/strike"] >= 4, "every strike posted to /sim/strike")
	check(posts["/sim/weather"] and posts["/sim/water"], "weather and water posted")
	local sample
	for _, h in ipairs(httpLog) do if h.url:find("/sim/strike") then sample = h break end end
	local body = sample and serde.decode("json", sample.body)
	check(body and body.site_id == 12 and body.bearing == 270 and body.miles == 15 and sample.token ~= "",
		"strike body matches the contract {site_id, bearing, miles} with X-Token (" .. tostring(sample and sample.body) .. ")")
	if not process.env.SIM_TOKEN then
		print("  (no SIM_TOKEN given, so 401 or 403 on posts is expected; set SIM_TOKEN to send real events)")
	end
end

print("== beacon follows the index")
rs.ScenarioControl:FireServer("load", "tipped") -- a calm scenario: the sim's own hazards reset
rs.ScenarioControl:FireServer("pause") -- loading plays it now; paused, it leaves the hand set hazards alone
step(0.5)
if LIVE and bridgeScript then print("  skipped in live mode, the Bridge rewrites these attributes from the backend every second") else
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

print("== a different alarm for each hazard")
local light = beacon.Light
local function hazard(attrName, value, label, alarmName)
	workspace:SetAttribute(attrName, value)
	step(0.3)
	check(tag.Level.Text == label and light:GetAttribute("LastAlarm") == alarmName,
		("%s -> %s with the %s alarm (%s, %s)"):format(attrName, label, alarmName, tag.Level.Text, tostring(light:GetAttribute("LastAlarm"))))
end
check(beacon:GetAttribute("LiveRisk") == beacon:GetAttribute("Index"), ("no hazard: the meter shows the model's index (%s)"):format(tostring(beacon:GetAttribute("LiveRisk"))))
hazard("SimWildlife", true, "GATOR ON SITE", "wildlife")
check(beacon:GetAttribute("LiveRisk") == 5, "gator on site: meter floor 5 (" .. tostring(beacon:GetAttribute("LiveRisk")) .. ")")
hazard("HeatIndexF", 108, "HEAT WARNING", "heat_warning")
hazard("HeatIndexF", 117, "HEAT DANGER", "heat_danger")
check(beacon:GetAttribute("LiveRisk") == 9 and tag.Sub.Text:find("LIVE RISK 9", 1, true) ~= nil, "heat danger: meter 9, LIVE RISK 9 on the tag (" .. tag.Sub.Text .. ")")
hazard("SimFloodMm", 40, "FLOOD", "flood")
check(tag.Sub.Text:find("+2 MORE") ~= nil, "the tag counts the other active hazards (" .. tag.Sub.Text .. ")")
workspace:SetAttribute("SimCountdown", 1500)
hazard("SimStopWork", true, "STOP WORK  25:00", "stopwork")
check(beacon:GetAttribute("LiveRisk") == 10, "stop work: meter swings to 10")
check(tag.Level.TextColor3.R > 0.8 and tag.Level.TextColor3.G < 0.3, "stop work shows in red")
for _, a in ipairs({ "SimStopWork", "SimFloodMm", "HeatIndexF", "SimWildlife", "SimCountdown" }) do
	workspace:SetAttribute(a, a == "SimStopWork" and false or a == "SimWildlife" and false or 0)
end
step(0.3)
check(tag.Level.Text == "ALL CLEAR" and light:GetAttribute("LastAlarm") == "all_clear", "everything clears -> all clear chime (" .. tostring(light:GetAttribute("LastAlarm")) .. ")")
check(beacon:GetAttribute("LiveRisk") == beacon:GetAttribute("Index"), "cleared: the meter eases back to the model's index")

end
print("== hurricane")
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
check(shiftLogHas("aerial lifts and bucket trucks grounded"), "hurricane gusts ground the aerial lifts, logged")
check(workspace:GetAttribute("GoNoGo") == "NO-GO", "hurricane call is NO-GO (" .. tostring(workspace:GetAttribute("GoReasons")) .. ")")

print("== flash flood and reset")
control:FireServer("load", "flash_flood")
step(0.5)
check(workspace.FloodWater.Transparency == 1, "loading a scenario drains the flood")
control:FireServer("play")
step(40, 0.25)
check(workspace.FloodWater.CFrame.Position.Y > 1, "flash flood rises")

print("== everglades day (the challenge brief)")
local crewFolder = workspace.Site:FindFirstChild("Crew")
local matTruck = workspace.Site:FindFirstChild("MatTruck")
local truckY0 = matTruck and matTruck.PrimaryPart.CFrame.Position.Y
local boardRows = workspace.ConditionsBoard.SurfaceGui
local function rowText(i) return boardRows["Row" .. i].Text end
local function workers()
	local list = {}
	for _, m in ipairs(crewFolder and crewFolder:GetChildren() or {}) do if m.Name == "Worker" then table.insert(list, m) end end
	return list
end
control:FireServer("load", "everglades_day")
control:FireServer("play")
step(2, 0.25) -- 06:55: the tailboard
check(workspace:GetAttribute("Tailboard") == true and shiftLogHas("Tailboard: job hazard analysis reviewed"), "shift opens with the tailboard, logged")
if crewFolder then
	step(2, 0.25)
	local spot = crewFolder.TailboardSpot.CFrame.Position
	local far = 0
	for _, w in ipairs(workers()) do far = math.max(far, (w:GetPivot().Position - spot).Magnitude) end
	check(far < 6, ("crew gathered at the board for the tailboard (farthest %.1f studs)"):format(far))
else
	step(2, 0.25)
end
step(62, 0.25) -- past 12:00 at 300x
local hiNoon = workspace:GetAttribute("HeatIndexF")
check(hiNoon >= 110, ("noon heat index %d F, over 110 (%s)"):format(hiNoon, rowText(1)))
check(rowText(6):find("alligator") ~= nil, "gator report on the board (" .. rowText(6) .. ")")
check(rowText(3):find("SOIL 8") ~= nil, "a week of rain shows as soil saturation (" .. rowText(3) .. ")")
local spent = 0 -- test seconds used by the optional crew check, taken off the next step so the strikes line up
check(workspace:GetAttribute("GoNoGo") == "GO WITH CONTROLS" and (workspace:GetAttribute("GoReasons") or ""):find("work/rest 15/45", 1, true) ~= nil,
	"noon call: GO WITH CONTROLS, heat work/rest 15/45 (" .. tostring(workspace:GetAttribute("GoReasons")) .. ")")
check(workspace:FindFirstChild("HazardPin") ~= nil, "gator report pinned with a 30 ft buffer")
if crewFolder and hiNoon >= 115 then
	spent = 6
	step(6, 0.25)
	local shade = crewFolder.ShadeSpot.CFrame.Position
	local most = 0 -- the resting group rotates every 15 sim minutes, so look across a moment, not one frame
	for _ = 1, 8 do
		local resting = 0
		for _, w in ipairs(workers()) do if (w:GetPivot().Position - shade).Magnitude < 6 then resting += 1 end end
		most = math.max(most, resting)
		step(0.25, 0.25)
	end
	spent += 2
	check(most == 3, ("heat index %d F: work/rest 15/45, 3 of 4 on break in the tent at a time (%d)"):format(hiNoon, most))
end
step(28 - spent, 0.25) -- past the 8 mile strike at 14:30 (93 s at 300x), before the 6 mile one (96 s)
check(workspace:GetAttribute("SimStopWork") == true and rowText(4):find("STOP WORK") ~= nil, "8 mile strike opens stop work (" .. rowText(4) .. ")")
check(workspace:GetAttribute("GoNoGo") == "NO-GO", "call goes to NO-GO on the strike")
local before = workspace:GetAttribute("SimCountdown")
step(2.5, 0.25) -- the 6 mile strike at 14:45
check(workspace:GetAttribute("SimCountdown") > before, ("6 mile strike restarts the 30 minute countdown (%s -> %s)"):format(before, workspace:GetAttribute("SimCountdown")))
check(shiftLogHas("STOP WORK: strike 8 mi") and shiftLogHas("COUNTDOWN RESET: strike 6 mi"), "shift log records the stop work and the reset")
if crewFolder then
	step(4, 0.25) -- still inside the 30 minutes the 6 mile strike restarted
	local hidden = 0
	for _, w in ipairs(workers()) do if w.Head.Transparency == 1 then hidden += 1 end end
	check(hidden == #workers() and hidden == 4, ("crew sheltered in the truck (%d of %d)"):format(hidden, #workers()))
	step(0.5, 0.25)
	check(rowText(4):find("CREW 4/4 SHELTERED", 1, true) ~= nil and shiftLogHas("Headcount: crew 4/4 accounted for"), "headcount on the board and in the log (" .. rowText(4) .. ")")
end
step(42, 0.25) -- through the downpour past 18:00 (135 s)
check(workspace:GetAttribute("Soil") >= 0.85, ("downpour saturates the soil (%d%%)"):format(workspace:GetAttribute("Soil") * 100))
if matTruck then
	step(8, 0.25)
	local sunk = truckY0 - matTruck.PrimaryPart.CFrame.Position.Y
	check(sunk > 0.5, ("mat truck bogged in the muck, down %.2f studs"):format(sunk))
end
local briefing = false
for _, d in ipairs(LOCAL_PLAYER.PlayerGui:GetDescendants()) do
	if d:IsA("TextLabel") and d.Text:find("18:00") and d.Text:find("briefing") then briefing = true end
end
check(briefing, "6 PM next-day briefing note shown")
local panelLog = LOCAL_PLAYER.PlayerGui.ScenarioUI:FindFirstChild("Frame"):GetDescendants()
local logShown = false
for _, d in ipairs(panelLog) do if d:IsA("TextLabel") and d.Font == roblox.Enum.Font.RobotoMono and d.Text:find("  ") and d.Text:find(":") and d.Text ~= "No entries yet" then logShown = true end end
check(logShown, "shift log shown in the operator panel")

print("== lightning cell, first strike to all clear")
local radarScope = LOCAL_PLAYER.PlayerGui.LightningRadar:FindFirstChild("Scope", true)
local strikesBefore = #fired.strike
control:FireServer("load", "lightning_cell")
control:FireServer("play")
step(16, 0.25) -- 14:32 at 120x: the 9 mile strike landed
check(workspace:GetAttribute("SimStopWork") == true, "9 mile strike opens stop work")
local radarCard = LOCAL_PLAYER.PlayerGui.LightningRadar
local function radarDots()
	local n = 0
	for _, d in ipairs(radarScope:GetChildren()) do if d.Name == "Strike" then n += 1 end end
	return n
end
step(0.5, 0.25)
task.wait(0.4) -- the radar redraws every quarter of a real second
check(radarDots() == 5 and radarCard:FindFirstChild("TrendLine", true).Text:find("APPROACHING") ~= nil,
	("radar: 5 strikes plotted, storm approaching (%d, %s)"):format(radarDots(), radarCard:FindFirstChild("TrendLine", true).Text))
check(radarCard:FindFirstChild("StopLine", true).Text:find("STOP WORK") ~= nil, "radar shows the stop work countdown")
step(15, 0.25) -- 15:03: the 8 mile strike east restarted it
local left = workspace:GetAttribute("SimCountdown")
check(left > 1450, ("8 mile strike east restarts the all clear (%d s left)"):format(left))
step(16, 0.25) -- 15:35: 30 minutes after the last close strike
check(workspace:GetAttribute("SimStopWork") == false, "all clear 30 minutes after the last strike inside 10 mi")
check(#fired.strike - strikesBefore == 14, ("14 strikes in the cell (%d)"):format(#fired.strike - strikesBefore))
step(0.5, 0.25)
task.wait(0.4)
check(radarDots() == 3 and radarCard:FindFirstChild("TrendLine", true).Text:find("RECEDING") ~= nil,
	("radar: strikes older than 30 min age off, storm receding (%d, %s)"):format(radarDots(), radarCard:FindFirstChild("TrendLine", true).Text))

print("== the Mississippi crossing, river flood")
control:FireServer("load", "mississippi_flood")
check(workspace:GetAttribute("ActiveSite") == "river", "river scenario switches to the river crossing")
control:FireServer("play")
step(11, 0.25) -- 05:44 at 240x: the 12 mile strike at 05:40
local o = workspace.RiverBeacon:GetPivot().Position
check(#fired.strike > 0, "strike fired at the river setting")
local riverTop = function() local w = workspace.RiverFloodWater return w.CFrame.Position.Y + w.Size.Y / 2 end
step(13, 0.25) -- past 06:10, the levee overtops
check(riverTop() > 4 and workspace:GetAttribute("RiverOvertop") == true, ("river over the levee top (river at %.1f)"):format(riverTop()))
check(workspace.LandFloodWater.Transparency < 0.5, "land side floods once the levee is overtopped")
check(workspace.ConditionsBoardRiver.SurfaceGui.Row5.Text:find("LEVEE") ~= nil, "river board reports the levee (" .. workspace.ConditionsBoardRiver.SurfaceGui.Row5.Text .. ")")
check(workspace.RiverBeacon.Light.LevelTag.Level.Text == beacon.Light.LevelTag.Level.Text, "river beacon mirrors the main beacon (" .. workspace.RiverBeacon.Light.LevelTag.Level.Text .. ")")
control:FireServer("site", "everglades")
check(workspace:GetAttribute("ActiveSite") == "everglades", "site switch back to the Everglades")

print("== instant hazard buttons")
control:FireServer("load", "tipped")
step(0.5)
local strikesNow = #fired.strike
control:FireServer("instant", "strike8")
step(0.5)
check(#fired.strike == strikesNow + 1 and fired.strike[#fired.strike][2] == 8 and workspace:GetAttribute("SimStopWork") == true,
	"Strike 8 mi W fires one strike and opens stop work")
check(beacon:GetAttribute("LiveRisk") == 10, "Strike 8 mi W swings the meter to 10 (" .. tostring(beacon:GetAttribute("LiveRisk")) .. ")")
control:FireServer("instant", "heat")
step(0.5)
check((workspace:GetAttribute("HeatIndexF") or 0) >= 115, ("Heat button: heat index %d F"):format(workspace:GetAttribute("HeatIndexF") or 0))
control:FireServer("instant", "flood")
step(0.5)
check(fired.water[#fired.water][1] == 60 and workspace:GetAttribute("SimFloodMm") == 60, "Downpour + flood posts 60 mm of water")
control:FireServer("instant", "wind")
step(0.5)
check((workspace:GetAttribute("SimGustMph") or 0) >= 45, "High wind button: gusts 45 mph")
control:FireServer("instant", "gator")
step(0.5)
check(workspace:FindFirstChild("Gator") ~= nil and workspace:GetAttribute("SimWildlife") == true, "Gator report button spawns and reports the gator")
control:FireServer("instant", "calm")
step(0.5)
check(workspace:GetAttribute("SimFloodMm") == 0 and (workspace:GetAttribute("SimGustMph") or 0) < 28, "Reset to calm drains the water and drops the wind")

print("== free play bearing")
local o = workspace.Beacon:GetPivot().Position
rs.StrikeHere.OnServerEvent:Fire(LOCAL_PLAYER, Vector3.new(o.X - 240, 0, o.Z))
local last = fired.strike[#fired.strike]
check(math.abs(last[1] - 270) < 0.5 and math.abs(last[2] - 2) < 0.01, ("click 240 studs west -> bearing %.0f, %.1f mi"):format(last[1], last[2]))

print("== the guided demo, start to finish")
control:FireServer("demo")
local capText = function() return LOCAL_PLAYER.PlayerGui.DemoCaption:FindFirstChild("Caption", true).Text end
local seenStop, t0 = false, os.clock()
for _ = 1, 400 do -- 0.25 s steps, up to 100 s of play
	step(0.25, 0.25)
	if capText():find("STOP WORK") then seenStop = true end
	if capText():find("18:00") then break end
end
local played = 0
for _ = 1, 1 do played = (workspace:GetAttribute("SimSpeed") or 0) end
check(seenStop and capText():find("18:00") ~= nil, "demo reaches stop work and the 6 PM briefing")

print(failures == 0 and "ALL CHECKS PASSED" or (failures .. " CHECK(S) FAILED"))
process.exit(failures == 0 and 0 or 1)
