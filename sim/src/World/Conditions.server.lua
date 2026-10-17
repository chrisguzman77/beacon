-- Conditions (Script in ServerScriptService/World)
-- The site's one combined risk picture, in simulated time, and the decisions a foreman makes from it. It reads the
-- scenario's weather, water, lightning, and wildlife and applies the field rules a utility crew works under:
--   lightning   any strike inside 10 mi is a stop work; 30 minute all clear, restarted by every new strike
--   heat        NWS heat index (Rothfusz); work/rest 45/15 from 91 F, 30/30 from 103 F, 15/45 from 115 F, water every 15 min
--   wind        gusts of 28 mph and up ground aerial lifts and bucket trucks; 40 mph and up stops the job
--   ground      a week of rain plus today's sets soil saturation; at 85% equipment stays on mats
--   flood       water on the pad (or the river over its levee) stops the job; rising water is a flood watch
--   wildlife    a crew report puts a 30 ft buffer around the animal
-- From those it makes the go/no-go call (GO, GO WITH CONTROLS, NO-GO) with its reasons, runs the tailboard at the
-- start of every shift, counts the crew into shelter during a stop work, and keeps a timestamped shift log.
-- It writes both conditions boards and publishes workspace attributes the crew, the beacon, and the screens read:
-- HeatIndexF, HeatRest, Soil, SimGustMph, SimStopWork, SimCountdown, SimStrikeMiles, SimFloodMm, SimWildlife,
-- SimTime, SimSpeed, GoNoGo, GoReasons, Tailboard, ShiftLog.
-- The real beacon and the in world beacon still show the backend's decision; this is the sim's own picture.
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Engine = require(script.Parent.ScenarioEngine)
local Scenarios = require(script.Parent.Scenarios)
local events = ReplicatedStorage:WaitForChild("SimEvents")

-- one board at each setting; both show the same picture
local boards = {}
for _, name in ipairs({ "ConditionsBoard", "ConditionsBoardRiver" }) do
	local b = name == "ConditionsBoard" and workspace:WaitForChild(name) or workspace:FindFirstChild(name)
	if b then
		local gui = b:WaitForChild("SurfaceGui")
		local entry = { title = gui:WaitForChild("Title"), decision = gui:FindFirstChild("Decision"), rows = {} }
		for i = 1, 6 do entry.rows[i] = gui:WaitForChild("Row" .. i) end
		table.insert(boards, entry)
	end
end

local STOP_MILES, ALL_CLEAR_S, TAILBOARD_S = 10, 30 * 60, 30 * 60
local MUDDY, AERIAL_GUST, STOP_GUST = 0.85, 28, 40
-- heat index bands: { from F, work/rest minutes, share of the crew resting at a time }
local HEAT_BANDS = {
	{ from = 115, label = "VERY HIGH", workRest = "15/45", rest = 0.75 },
	{ from = 103, label = "HIGH", workRest = "30/30", rest = 0.5 },
	{ from = 91, label = "MODERATE", workRest = "45/15", rest = 0.25 },
}
local COLOR = {
	ok = Color3.fromRGB(150, 230, 160),
	caution = Color3.fromRGB(255, 220, 90),
	warning = Color3.fromRGB(255, 150, 50),
	danger = Color3.fromRGB(255, 80, 80),
	text = Color3.fromRGB(236, 238, 243),
}
local DECISION_BG = {
	["GO"] = Color3.fromRGB(26, 110, 60),
	["GO WITH CONTROLS"] = Color3.fromRGB(150, 100, 10),
	["NO-GO"] = Color3.fromRGB(150, 28, 28),
	["TAILBOARD"] = Color3.fromRGB(30, 70, 140),
}
local COMPASS = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }

local S
local log = {}
local function reset(key)
	local sc = key and Scenarios[key]
	S = {
		key = key, name = sc and sc.name or "", clockStart = sc and sc.clockStart or "13:00",
		t = 0, lastT = 0, soil0 = sc and sc.soil or 0.5,
		temp_c = nil, rh = nil, gust = 0, rate = 0, rainMm = 0, depth = 0,
		near = nil, nearest = nil, gatorAt = nil,
		last = {}, -- the previous value of everything the shift log reports on
	}
	log = {}
	workspace:SetAttribute("ShiftLog", "[]")
end
reset(nil)

-- NWS heat index (Rothfusz regression with its adjustments), Fahrenheit
local function heatIndexF(tc, rh)
	local T = tc * 9 / 5 + 32
	local hi = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094)
	if (hi + T) / 2 >= 80 then
		hi = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 6.83783e-3 * T * T
			- 5.481717e-2 * rh * rh + 1.22874e-3 * T * T * rh + 8.5282e-4 * T * rh * rh - 1.99e-6 * T * T * rh * rh
		if rh < 13 and T >= 80 and T <= 112 then
			hi -= ((13 - rh) / 4) * math.sqrt((17 - math.abs(T - 95)) / 17)
		elseif rh > 85 and T >= 80 and T <= 87 then
			hi += ((rh - 85) / 10) * ((87 - T) / 5)
		end
	end
	return hi, T
end

local function clock(t)
	local h, m = S.clockStart:match("(%d+):(%d+)")
	local minutes = tonumber(h) * 60 + tonumber(m) + t / 60
	return ("%02d:%02d"):format(math.floor(minutes / 60) % 24, math.floor(minutes % 60))
end

local function mmss(s)
	s = math.max(0, math.floor(s))
	return ("%02d:%02d"):format(s // 60, s % 60)
end

local function n(x) return math.floor(x + 0.5) end -- string.format %d needs whole numbers

local function logEvent(text)
	local entry = clock(S.t) .. "  " .. text
	table.insert(log, 1, entry)
	while #log > 12 do table.remove(log) end
	workspace:SetAttribute("ShiftLog", HttpService:JSONEncode(log))
	print("[ShiftLog] " .. entry)
end

-- log a line only when the value it reports on changes
local function changed(key, value, text)
	if S.last[key] ~= value then
		local first = S.last[key] == nil
		S.last[key] = value
		if text and not (first and value == false) then logEvent(text) end
	end
end

local function setBoards(fn)
	for _, b in ipairs(boards) do fn(b) end
end
local function row(i, text, color)
	setBoards(function(b)
		b.rows[i].Text = text
		b.rows[i].TextColor3 = color or COLOR.text
	end)
end

local function heatBand(hi)
	for _, band in ipairs(HEAT_BANDS) do
		if hi >= band.from then return band end
	end
	return nil
end

local function render()
	if not S.key then
		setBoards(function(b) b.title.Text = "SITE CONDITIONS  ·  NO SCENARIO" end)
	else
		setBoards(function(b) b.title.Text = ("SITE CONDITIONS  ·  %s  ·  %s"):format(clock(S.t), S.name:upper()) end)
	end
	workspace:SetAttribute("SimTime", S.t)

	-- heat
	local hi, band = 0, nil
	if S.temp_c then
		local raw, T = heatIndexF(S.temp_c, S.rh)
		hi = n(raw) -- decide on the number the board shows
		band = heatBand(hi)
		row(1, ("AIR %d°F  ·  RH %d%%  ·  HEAT INDEX %d°F%s"):format(n(T), n(S.rh), hi,
			band and ("  ·  %s, WORK/REST %s, WATER EVERY 15 MIN"):format(band.label, band.workRest) or ""),
			band and (band.from >= 115 and COLOR.danger or band.from >= 103 and COLOR.warning or COLOR.caution) or COLOR.ok)
	else
		row(1, "AIR  ·  waiting for the scenario's first weather report")
	end
	workspace:SetAttribute("HeatIndexF", hi)
	workspace:SetAttribute("HeatRest", band and band.rest or 0)
	changed("heat", band and band.label or "none", band and ("HEAT %s, heat index %d F: work/rest %s, water every 15 min"):format(band.label, hi, band.workRest)
		or (S.last.heat and "Heat back under 91 F, normal work"))

	-- wind
	local gust = S.gust or 0
	workspace:SetAttribute("SimGustMph", gust)
	row(2, ("WIND %d mph  ·  GUSTS %d mph%s"):format(n(gust * 0.6), n(gust),
		gust >= STOP_GUST and "  ·  STOP ALL WORK" or gust >= AERIAL_GUST and "  ·  AERIAL LIFTS GROUNDED" or ""),
		gust >= STOP_GUST and COLOR.danger or gust >= AERIAL_GUST and COLOR.warning or COLOR.text)
	changed("aerial", gust >= AERIAL_GUST, gust >= AERIAL_GUST and ("Gusts %d mph: aerial lifts and bucket trucks grounded"):format(n(gust))
		or "Gusts under 28 mph: aerial work may resume")

	-- ground
	local soil = math.clamp(S.soil0 + S.rainMm / 120, 0, 1)
	workspace:SetAttribute("Soil", soil)
	row(3, ("RAIN TODAY %d mm  ·  SOIL %d%% SATURATED%s"):format(n(S.rainMm), n(soil * 100), soil >= MUDDY and "  ·  EQUIPMENT ON MATS ONLY" or ""),
		soil >= MUDDY and COLOR.warning or soil >= 0.7 and COLOR.caution or COLOR.ok)
	changed("muddy", soil >= MUDDY, soil >= MUDDY and ("Soil %d%% saturated: equipment on mats only, expect stuck vehicles"):format(n(soil * 100)) or nil)

	-- lightning
	local left = S.near and ALL_CLEAR_S - (S.t - S.near.t) or 0
	workspace:SetAttribute("SimStopWork", left > 0)
	workspace:SetAttribute("SimCountdown", math.max(0, left))
	workspace:SetAttribute("SimStrikeMiles", S.near and S.near.miles or 0)
	local sheltered, total = workspace:GetAttribute("CrewSheltered") or 0, workspace:GetAttribute("CrewTotal") or 0
	if left > 0 then
		row(4, ("LIGHTNING %d mi %s at %s  ·  STOP WORK %s%s"):format(n(S.near.miles), S.near.dir, clock(S.near.t), mmss(left),
			total > 0 and ("  ·  CREW %d/%d SHELTERED"):format(sheltered, total) or ""), COLOR.danger)
	elseif S.near then
		row(4, "LIGHTNING  ·  ALL CLEAR, 30 min with no strike inside 10 mi", COLOR.ok)
	elseif S.nearest then
		row(4, ("LIGHTNING nearest %d mi %s, outside 10 mi"):format(n(S.nearest.miles), S.nearest.dir), COLOR.caution)
	else
		row(4, "LIGHTNING  ·  none detected", COLOR.ok)
	end
	changed("stop", left > 0, left <= 0 and S.near and "ALL CLEAR: 30 minutes with no strike inside 10 mi, work may resume" or nil)
	changed("accounted", left > 0 and total > 0 and sheltered == total,
		left > 0 and total > 0 and sheltered == total and ("Headcount: crew %d/%d accounted for in the trucks"):format(sheltered, total) or nil)

	-- flood
	local river = workspace:GetAttribute("ActiveSite") == "river"
	local overtop = workspace:GetAttribute("RiverOvertop") == true
	local floodOnSite = (river and overtop) or (not river and S.depth >= 30)
	workspace:SetAttribute("SimFloodMm", S.depth)
	if S.depth > 0 and river then
		row(5, overtop and ("FLOOD  ·  river up %d mm, OVERTOPPING THE LEVEE"):format(n(S.depth))
			or ("FLOOD RISK  ·  river up %d mm after heavy rain, levee holding"):format(n(S.depth)), overtop and COLOR.danger or COLOR.warning)
	elseif S.depth > 0 then
		row(5, ("FLOOD  ·  water %d mm over the pad, rising after heavy rain"):format(n(S.depth)), floodOnSite and COLOR.danger or COLOR.warning)
	else
		row(5, "FLOOD  ·  none", COLOR.ok)
	end
	changed("floodwatch", S.depth > 0, S.depth > 0 and (river and "Flood risk warning: the river is rising after heavy rain" or "Flood watch: water rising on the pad") or nil)
	changed("flood", floodOnSite, floodOnSite and (river and "Levee overtopping: flood confirmed, evacuate to high ground" or "Flood on site: stop work, move equipment to high ground") or nil)

	-- wildlife
	workspace:SetAttribute("SimWildlife", S.gatorAt ~= nil)
	if S.gatorAt then
		row(6, ("WILDLIFE  ·  alligator reported %s on the mat road, pinned to the site map, 30 ft buffer"):format(clock(S.gatorAt)), COLOR.warning)
	else
		row(6, "WILDLIFE  ·  no reports today", COLOR.ok)
	end
	changed("gator", S.gatorAt ~= nil, S.gatorAt and "Crew report: alligator on the mat road, photo pinned, 30 ft buffer" or nil)

	-- the call
	local reasons, go = {}, "GO"
	if left > 0 then go = "NO-GO"; table.insert(reasons, "lightning inside 10 mi") end
	if floodOnSite then go = "NO-GO"; table.insert(reasons, "flood on site") end
	if gust >= STOP_GUST then go = "NO-GO"; table.insert(reasons, ("gusts %d mph"):format(n(gust))) end
	if go == "GO" then
		if band then table.insert(reasons, "heat work/rest " .. band.workRest) end
		if soil >= MUDDY then table.insert(reasons, "mats only") end
		if gust >= AERIAL_GUST then table.insert(reasons, "no aerial lifts") end
		if S.gatorAt then table.insert(reasons, "gator buffer 30 ft") end
		if S.depth > 0 then table.insert(reasons, "flood watch") end
		if #reasons > 0 then go = "GO WITH CONTROLS" end
	end
	local tailboard = S.key ~= nil and S.t < TAILBOARD_S
	workspace:SetAttribute("Tailboard", tailboard)
	workspace:SetAttribute("GoNoGo", go)
	workspace:SetAttribute("GoReasons", table.concat(reasons, ", "))
	local banner = tailboard and ("TAILBOARD  ·  JHA REVIEWED, CREW 4/4 SIGNED  ·  THEN %s"):format(go)
		or (#reasons > 0 and ("%s  ·  %s"):format(go, table.concat(reasons, ", "):upper()) or go)
	setBoards(function(b)
		if b.decision then
			b.decision.Text = banner
			b.decision.BackgroundColor3 = DECISION_BG[tailboard and "TAILBOARD" or go]
		end
	end)
	if S.key then
		changed("tailboard", tailboard, tailboard and "Tailboard: job hazard analysis reviewed with the crew, 4/4 signed" or nil)
		changed("go", go, ("Call: %s%s"):format(go, #reasons > 0 and (" (" .. table.concat(reasons, ", ") .. ")") or ""))
	end
end

events.Weather.Event:Connect(function(w)
	S.temp_c, S.rh, S.gust, S.rate = w.temp_c, w.humidity, w.gust or 0, w.precip_mm or 0
	render()
end)

events.Water.Event:Connect(function(depth_mm)
	S.depth = depth_mm
	render()
end)

events.Strike.Event:Connect(function(bearing, miles)
	local strike = { t = S.t, miles = miles, dir = COMPASS[math.floor(((bearing % 360) + 22.5) / 45) % 8 + 1] }
	if not S.nearest or miles < S.nearest.miles then S.nearest = strike end
	if miles < STOP_MILES then
		local restart = S.near and (S.t - S.near.t) < ALL_CLEAR_S
		S.near = strike -- every strike inside 10 miles restarts the 30 minutes
		logEvent(("%s: strike %d mi %s, %s"):format(restart and "COUNTDOWN RESET" or "STOP WORK", n(miles), strike.dir,
			restart and "30 minute all clear restarted" or "30 minute all clear started, crew to the trucks"))
	end
	render()
end)

workspace:GetAttributeChangedSignal("CrewSheltered"):Connect(render)

Engine.Changed.Event:Connect(function(snap)
	if snap.key ~= S.key then
		reset(snap.key)
		if snap.key then logEvent("Shift start: " .. S.name) end
	end
	local dt = math.max(0, snap.simTime - S.lastT)
	S.t, S.lastT = snap.simTime, snap.simTime
	workspace:SetAttribute("SimSpeed", snap.speed) -- the crew walks faster when the day plays fast
	S.rainMm += S.rate * dt / 3600 -- rain rate is mm per hour
	if not S.gatorAt and workspace:FindFirstChild("Gator") then S.gatorAt = S.t end
	render()
end)

render()
