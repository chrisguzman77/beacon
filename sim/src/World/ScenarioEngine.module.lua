-- ScenarioEngine (ModuleScript)
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Scenarios = require(script.Parent.Scenarios)
local Lightning = require(script.Parent.Lightning)
local StormModel = require(script.Parent.StormModel)
local WeatherFx = require(script.Parent.WeatherFx)
local events = ReplicatedStorage:WaitForChild("SimEvents")

local Engine = {}
Engine.Changed = Instance.new("BindableEvent")

local state = {
	scenario = nil, key = nil, name = "", clockStart = "13:00",
	simTime = 0, speed = 60, playing = false, fired = {}, note = "",
	duration = 0, markers = {},
	storms = {}, -- running storms: { t0, p, strikes, next }, strikes fire at t0 + strike.t in sim time
}

-- A storm event's parameters: the fields it writes out, over its preset (a button's) if it names one
local function stormParams(e)
	local p = e.preset and table.clone(StormModel.presets[e.preset]) or {}
	for _, k in ipairs({ "seed", "from_bearing", "start_mi", "speed_mph", "cross_track_mi", "peak_per_min", "life_min" }) do
		if e[k] ~= nil then p[k] = e[k] end
	end
	return p
end

-- duration and markers let the panel draw a timeline with a tick for every strike, flood step, and briefing
function Engine.snapshot()
	return {
		key = state.key, name = state.name, clockStart = state.clockStart,
		simTime = state.simTime, speed = state.speed, playing = state.playing, note = state.note,
		duration = state.duration, markers = state.markers, stormSpeed = Engine.stormSpeed(),
	}
end

-- the sun follows the scenario's clock, held between early morning and sunset so the site stays readable
local function sun()
	local h, m = state.clockStart:match("(%d+):(%d+)")
	local hours = (tonumber(h) * 60 + tonumber(m) + state.simTime / 60) / 60
	WeatherFx.setClock(math.clamp(hours % 24, 7.2, 18.6))
end

local function emit()
	Engine.Changed:Fire(Engine.snapshot())
end

function Engine.load(key)
	local sc = Scenarios[key]
	if not sc then warn("[Engine] unknown scenario " .. tostring(key)) return end
	state.scenario, state.key, state.name = sc, key, sc.name
	state.clockStart = sc.clockStart or "13:00"
	state.simTime, state.speed, state.playing = 0, sc.speed or 60, false
	state.fired, state.note = {}, ""
	state.duration, state.markers, state.storms = 0, {}, {}
	for _, e in ipairs(sc.events) do
		state.duration = math.max(state.duration, e.t)
		if e.type == "storm" then
			-- a tick for every strike inside 10 mi; the timeline runs to the all clear after the last one
			local p = stormParams(e)
			local strikes = StormModel.generate(p)
			for _, s in ipairs(strikes) do
				if s.miles < StormModel.STOP_MILES then
					table.insert(state.markers, { t = e.t + s.t, type = "strike", miles = s.miles })
				end
			end
			local sum = StormModel.summary(strikes)
			state.duration = math.max(state.duration, e.t + StormModel.lifeSeconds(p), e.t + (sum.allClearT or 0))
		elseif e.type ~= "weather" then
			table.insert(state.markers, { t = e.t, type = e.type, miles = e.miles })
		end
	end
	state.duration += 300
	WeatherFx.reset()
	sun()
	emit()
end

function Engine.play()
	if state.scenario then state.playing = true emit() end
end

function Engine.pause()
	state.playing = false
	emit()
end

function Engine.setSpeed(s)
	state.speed = math.clamp(s, 1, 1200)
	emit()
end

-- start a storm whose clock zero is t0 (sim seconds); its strikes then fire from the Heartbeat in sim time
function Engine.startStorm(params, t0)
	local strikes = StormModel.generate(params)
	table.insert(state.storms, { t0 = t0, p = params, strikes = strikes, next = 1 })
	local sum = StormModel.summary(strikes, StormModel.pace(params))
	print(("[Storm] seed %d from %d deg, %d strikes, %d inside 10 mi, first %.2f mi"):format(params.seed,
		math.floor(params.from_bearing + 0.5), sum.count, sum.inside, sum.first and sum.first.miles or 0))
	return strikes
end

-- Reset to calm: the storms stop where they are
function Engine.stopStorms()
	state.storms = {}
end

-- While a storm lives, the sim clock runs at the speed that plays its approach and passage in
-- StormModel.REAL_SECONDS, whatever the scenario's own speed; after it dies the scenario's speed is back
function Engine.stormSpeed()
	local cap
	for _, st in ipairs(state.storms) do
		if state.simTime < st.t0 + StormModel.lifeSeconds(st.p) then
			cap = math.min(cap or math.huge, StormModel.pace(st.p))
		end
	end
	return cap
end

local function dispatch(e)
	if e.type == "storm" then
		Engine.startStorm(stormParams(e), e.t)
	elseif e.type == "weather" then
		-- the air temperature sets the speed of sound for the thunder delay on every client
		if e.temp_c then workspace:SetAttribute("AirTempC", e.temp_c) end
		WeatherFx.apply(e)
		events.Weather:Fire({ temp_c = e.temp_c, humidity = e.humidity, precip_mm = e.rain or 0, gust = e.gust })
	elseif e.type == "water" then
		WeatherFx.setWater(e.depth_mm)
		events.Water:Fire(e.depth_mm)
	elseif e.type == "wildlife" then
		WeatherFx.spawnGator()
	elseif e.type == "note" then
		state.note = e.text
		emit()
	end
	print(("[Engine] t=%d %s"):format(math.floor(e.t), e.type))
end

-- fire every storm strike that is due; the snapshot goes out first so the sim clock everyone reads (the
-- Conditions countdown, the radar's strike ages) is the strike's own time
local function fireStrikes()
	for _, st in ipairs(state.storms) do
		while st.strikes[st.next] and st.t0 + st.strikes[st.next].t <= state.simTime do
			local s = st.strikes[st.next]
			st.next += 1
			emit()
			Lightning.strike(s.bearing, s.miles)
		end
	end
end

local acc = 0
RunService.Heartbeat:Connect(function(dt)
	if not state.playing or not state.scenario then return end
	state.simTime += dt * (Engine.stormSpeed() or state.speed)
	for i, e in ipairs(state.scenario.events) do
		if not state.fired[i] and e.t <= state.simTime then
			state.fired[i] = true
			dispatch(e)
		end
	end
	fireStrikes()
	acc += dt
	if acc >= 0.5 then
		acc = 0
		sun()
		emit()
	end
end)

-- instant hazards: fire one event now, through the same path as a scenario's timeline
function Engine.fire(e)
	local now = table.clone(e)
	now.t = state.simTime -- stamped with the current sim time, as if it were on the timeline
	dispatch(now)
	emit()
end

function Engine.loadedKey()
	return state.key
end

function Engine.isPlaying()
	return state.playing
end

return Engine
