-- Bridge (Script in ServerScriptService/Bridge)
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
	-- the Pi's own needle when it is up; otherwise the site loop below sets Index from the stored hazard index
	if d.online then beacon:SetAttribute("Index", d.index or 0) end
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
			local dev = s.device or {}
			if not dev.online and s.index then beacon:SetAttribute("Index", s.index.index or 0) end
		end
		task.wait(10)
	end
end)

Http.OnlineChanged.Event:Connect(function(online)
	if not online then beacon:SetAttribute("Online", false) end
end)

print("[Bridge] running against " .. tostring(script:GetAttribute("BACKEND_URL")))
