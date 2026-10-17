-- BridgeInstaller: paste into the Studio Command Bar (View -> Command Bar) in edit mode and press Enter.
-- Generated from Http.lua and Bridge.server.lua in this folder; regenerate if those change.
-- Installs ServerScriptService.Bridge (Http + Bridge), sets BACKEND_URL and SITE_ID, disables FakeBridge,
-- and creates workspace.Beacon and ReplicatedStorage.SimEvents only if missing, so it is safe in Slavik's place.
-- SIM_TOKEN is left empty on purpose: type it into the Bridge script's attribute in Properties by hand.
local BACKEND_URL = "https://api.omnirisking-it-all-at-swamphacks.us"
local SITE_ID = 12

local HTTP_SRC = [==[-- Http (ModuleScript in ServerScriptService/Bridge)
local HttpService = game:GetService("HttpService")

local Http = {}
Http.online = false
Http.OnlineChanged = Instance.new("BindableEvent")

local cfg = nil

function Http.configure(source)
	cfg = {
		url = tostring(source:GetAttribute("BACKEND_URL") or ""):gsub("/$", ""),
		token = tostring(source:GetAttribute("SIM_TOKEN") or ""),
		site = tonumber(source:GetAttribute("SITE_ID")) or 1,
	}
	assert(cfg.url ~= "", "Bridge script needs a BACKEND_URL attribute")
	assert(cfg.token ~= "", "Bridge script needs a SIM_TOKEN attribute")
end

function Http.siteId() return cfg.site end

local function setOnline(v)
	if v ~= Http.online then
		Http.online = v
		Http.OnlineChanged:Fire(v)
		print("[Http] online =", v)
	end
end

local function request(method, path, body)
	local req = {
		Url = cfg.url .. path,
		Method = method,
		Headers = { ["X-Token"] = cfg.token, ["Content-Type"] = "application/json" },
	}
	if body then req.Body = HttpService:JSONEncode(body) end
	for attempt = 1, 2 do
		local ok, res = pcall(HttpService.RequestAsync, HttpService, req)
		if ok and res.Success then
			setOnline(true)
			if res.Body and #res.Body > 0 then
				local decoded, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
				return decoded and data or {}
			end
			return {}
		end
		if ok then
			warn(("[Http] %s %s -> %d %s"):format(method, path, res.StatusCode, res.StatusMessage))
		else
			warn(("[Http] %s %s failed: %s"):format(method, path, tostring(res)))
		end
		if attempt == 1 then task.wait(0.5) end
	end
	setOnline(false)
	return nil
end

function Http.post(path, body)
	body.site_id = cfg.site
	return request("POST", path, body)
end

function Http.get(path)
	return request("GET", path)
end

return Http
]==]
local BRIDGE_SRC = [==[-- Bridge (Script in ServerScriptService/Bridge)
-- Attributes on this script: BACKEND_URL (string), SIM_TOKEN (string), SITE_ID (number)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")

local Http = require(script.Parent.Http)
Http.configure(script)

local beacon = workspace:WaitForChild("Beacon")
local events = ReplicatedStorage:WaitForChild("SimEvents")
local SITE = Http.siteId()

-- World -> backend
events.Strike.Event:Connect(function(bearing, miles)
	Http.post("/sim/strike", { bearing = bearing, miles = miles })
end)

events.Weather.Event:Connect(function(w)
	Http.post("/sim/weather", { temp_c = w.temp_c, humidity = w.humidity, precip_mm = w.precip_mm, gust = w.gust })
end)

events.Water.Event:Connect(function(depth_mm)
	Http.post("/sim/water", { depth_mm = depth_mm })
end)

local lastUsers = {}
local function postPresence()
	Http.post("/sim/presence", { count = #lastUsers, users = lastUsers })
end
events.PresenceChanged.Event:Connect(function(count, users)
	lastUsers = users or {}
	postPresence()
end)
task.spawn(function()
	while true do
		task.wait(5)
		if #lastUsers > 0 then postPresence() end
	end
end)

-- backend -> Beacon attributes
local function applyDevice(d)
	beacon:SetAttribute("Led", d.led or "green")
	beacon:SetAttribute("Countdown", d.countdown or 0)
	beacon:SetAttribute("Index", d.index or 0)
	beacon:SetAttribute("Interlock", d.interlock or "running")
	beacon:SetAttribute("Presence", d.presence == true)
	-- Online means the whole chain is up: Roblox can reach the backend and the backend can see the Pi
	beacon:SetAttribute("Online", Http.online and d.online == true)
	local lcd = d.lcd or {}
	beacon:SetAttribute("Lcd1", lcd[1] or "")
	beacon:SetAttribute("Lcd2", lcd[2] or "")
end

task.spawn(function()
	while true do
		local d = Http.get("/sites/" .. SITE .. "/device")
		if d then
			applyDevice(d)
		else
			beacon:SetAttribute("Online", false)
		end
		task.wait(1)
	end
end)

task.spawn(function()
	while true do
		local s = Http.get("/sites/" .. SITE)
		if s then
			local types = {}
			for _, a in ipairs(s.alerts or {}) do
				table.insert(types, a.type)
			end
			beacon:SetAttribute("Alerts", HttpService:JSONEncode(types))
			if s.name then beacon:SetAttribute("SiteName", s.name) end
		end
		task.wait(10)
	end
end)

Http.OnlineChanged.Event:Connect(function(online)
	if not online then beacon:SetAttribute("Online", false) end
end)

print("[Bridge] running against " .. tostring(script:GetAttribute("BACKEND_URL")))
]==]

game:GetService("HttpService").HttpEnabled = true
local RS = game:GetService("ReplicatedStorage")
local SSS = game:GetService("ServerScriptService")

local function ensure(parent, class, name)
	local x = parent:FindFirstChild(name)
	if not x then
		x = Instance.new(class)
		x.Name = name
		x.Parent = parent
		print("[BridgeInstaller] created " .. x:GetFullName())
	end
	return x
end

if not workspace:FindFirstChild("Beacon") then
	local p = ensure(workspace, "Part", "Beacon")
	p.Anchored, p.Size, p.Position = true, Vector3.new(2, 6, 2), Vector3.new(0, 3, 0)
end
local sim = ensure(RS, "Folder", "SimEvents")
for _, n in ipairs({ "Strike", "Weather", "Water", "PresenceChanged" }) do ensure(sim, "BindableEvent", n) end

local folder = ensure(SSS, "Folder", "Bridge")
local token = ""
local old = folder:FindFirstChild("Bridge")
if old then token = old:GetAttribute("SIM_TOKEN") or "" old:Destroy() end
if folder:FindFirstChild("Http") then folder.Http:Destroy() end

local http = Instance.new("ModuleScript")
http.Name, http.Source, http.Parent = "Http", HTTP_SRC, folder
local bridge = Instance.new("Script")
bridge.Name, bridge.Source = "Bridge", BRIDGE_SRC
bridge:SetAttribute("BACKEND_URL", BACKEND_URL)
bridge:SetAttribute("SIM_TOKEN", token)
bridge:SetAttribute("SITE_ID", SITE_ID)
bridge.Parent = folder
local fake = folder:FindFirstChild("FakeBridge")
if fake then fake.Disabled = true end

print("[BridgeInstaller] done." .. (token == "" and " Now set SIM_TOKEN on ServerScriptService.Bridge.Bridge in Properties, then Play." or " Kept the existing SIM_TOKEN. Press Play."))
