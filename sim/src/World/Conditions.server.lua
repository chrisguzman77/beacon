-- Conditions (Script in ServerScriptService/World)
-- The site conditions board: one combined risk picture for the jobsite, in simulated time, from the scenario's
-- weather, water, lightning, and wildlife. The same rules the platform enforces, shown in the world:
--   heat index from the NWS Rothfusz regression, warning at 103 F, danger at 115 F
--   any strike inside 10 miles opens a stop work with a 30 minute all clear that restarts on every new strike
--   rain over the last day plus the week before sets soil saturation; past 85% vehicles bog down in the muck
-- It also publishes workspace attributes the Crew script and the beacon act on:
-- HeatIndexF, Soil, SimStopWork, SimCountdown, SimFloodMm, SimWildlife.
-- The real beacon and the in world beacon still show the backend's decision; this board is the sim's own picture.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Engine = require(script.Parent.ScenarioEngine)
local Scenarios = require(script.Parent.Scenarios)
local events = ReplicatedStorage:WaitForChild("SimEvents")
local gui = workspace:WaitForChild("ConditionsBoard"):WaitForChild("SurfaceGui")
local title = gui:WaitForChild("Title")
local rows = {}
for i = 1, 6 do rows[i] = gui:WaitForChild("Row" .. i) end

local STOP_MILES, ALL_CLEAR_S = 10, 30 * 60
local HEAT_WARNING, HEAT_DANGER, MUDDY = 103, 115, 0.85
local COLOR = {
	ok = Color3.fromRGB(150, 230, 160),
	caution = Color3.fromRGB(255, 220, 90),
	warning = Color3.fromRGB(255, 150, 50),
	danger = Color3.fromRGB(255, 80, 80),
	text = Color3.fromRGB(236, 238, 243),
}
local COMPASS = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }

local S
local function reset(key)
	local sc = key and Scenarios[key]
	S = {
		key = key, name = sc and sc.name or "", clockStart = sc and sc.clockStart or "13:00",
		t = 0, lastT = 0, soil0 = sc and sc.soil or 0.5,
		temp_c = nil, rh = nil, gust = 0, rate = 0, rainMm = 0, depth = 0,
		near = nil, nearest = nil, gatorAt = nil,
	}
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

local function row(i, text, color)
	rows[i].Text = text
	rows[i].TextColor3 = color or COLOR.text
end

local function render()
	title.Text = ("SITE CONDITIONS  ·  %s  ·  %s"):format(clock(S.t), S.name ~= "" and S.name:upper() or "NO SCENARIO")

	if S.temp_c then
		local raw, T = heatIndexF(S.temp_c, S.rh)
		local hi = n(raw) -- decide on the number the board shows
		local level = hi >= HEAT_DANGER and "DANGER, REST BREAKS" or hi >= HEAT_WARNING and "WARNING" or hi >= 90 and "CAUTION" or "OK"
		row(1, ("AIR %d°F  ·  HUMIDITY %d%%  ·  HEAT INDEX %d°F  %s"):format(n(T), n(S.rh), n(hi), level),
			hi >= HEAT_DANGER and COLOR.danger or hi >= HEAT_WARNING and COLOR.warning or hi >= 90 and COLOR.caution or COLOR.ok)
		workspace:SetAttribute("HeatIndexF", math.floor(hi + 0.5))
		row(2, ("WIND %d mph  ·  GUSTS %d mph"):format(n(S.gust * 0.6), n(S.gust)), S.gust >= 40 and COLOR.warning or COLOR.text)
	else
		row(1, "AIR  waiting for the scenario's first weather report")
		row(2, "")
		workspace:SetAttribute("HeatIndexF", 0)
	end

	local soil = math.clamp(S.soil0 + S.rainMm / 120, 0, 1)
	workspace:SetAttribute("Soil", soil)
	row(3, ("RAIN TODAY %d mm  ·  SOIL %d%% SATURATED%s"):format(n(S.rainMm), n(soil * 100), soil >= MUDDY and "  ·  MUCK, TRUCKS STUCK" or ""),
		soil >= MUDDY and COLOR.warning or soil >= 0.7 and COLOR.caution or COLOR.ok)

	local left = S.near and ALL_CLEAR_S - (S.t - S.near.t) or 0
	workspace:SetAttribute("SimStopWork", left > 0)
	workspace:SetAttribute("SimCountdown", math.max(0, left))
	workspace:SetAttribute("SimStrikeMiles", S.near and S.near.miles or 0)
	if left > 0 then
		row(4, ("LIGHTNING %.0f mi %s at %s  ·  STOP WORK  %s"):format(S.near.miles, S.near.dir, clock(S.near.t), mmss(left)), COLOR.danger)
	elseif S.near then
		row(4, "LIGHTNING  ·  ALL CLEAR, 30 min with no strike inside 10 mi", COLOR.ok)
	elseif S.nearest then
		row(4, ("LIGHTNING nearest %.0f mi %s, outside 10 mi"):format(S.nearest.miles, S.nearest.dir), COLOR.caution)
	else
		row(4, "LIGHTNING  ·  none detected", COLOR.ok)
	end

	workspace:SetAttribute("SimFloodMm", S.depth)
	workspace:SetAttribute("SimWildlife", S.gatorAt ~= nil)
	if S.depth > 0 then
		row(5, ("FLOOD  ·  water %d mm over the pad, rising after heavy rain"):format(n(S.depth)), S.depth >= 30 and COLOR.danger or COLOR.warning)
	else
		row(5, "FLOOD  ·  none", COLOR.ok)
	end

	if S.gatorAt then
		row(6, ("WILDLIFE  ·  alligator reported %s on the mat road, photo pinned to the site map"):format(clock(S.gatorAt)), COLOR.warning)
	else
		row(6, "WILDLIFE  ·  no reports today", COLOR.ok)
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
	if miles < STOP_MILES then S.near = strike end -- every strike inside 10 miles restarts the 30 minutes
	render()
end)

Engine.Changed.Event:Connect(function(snap)
	if snap.key ~= S.key then reset(snap.key) end
	local dt = math.max(0, snap.simTime - S.lastT)
	S.t, S.lastT = snap.simTime, snap.simTime
	S.rainMm += S.rate * dt / 3600 -- rain rate is mm per hour
	if not S.gatorAt and workspace:FindFirstChild("Gator") then S.gatorAt = S.t end
	render()
end)

render()
