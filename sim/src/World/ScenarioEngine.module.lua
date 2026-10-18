-- ScenarioEngine (ModuleScript)
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Scenarios = require(script.Parent.Scenarios)
local Lightning = require(script.Parent.Lightning)
local WeatherFx = require(script.Parent.WeatherFx)
local events = ReplicatedStorage:WaitForChild("SimEvents")

local Engine = {}
Engine.Changed = Instance.new("BindableEvent")

local state = {
	scenario = nil, key = nil, name = "", clockStart = "13:00",
	simTime = 0, speed = 60, playing = false, fired = {}, note = "",
	duration = 0, markers = {},
}

-- duration and markers let the panel draw a timeline with a tick for every strike, flood step, and briefing
function Engine.snapshot()
	return {
		key = state.key, name = state.name, clockStart = state.clockStart,
		simTime = state.simTime, speed = state.speed, playing = state.playing, note = state.note,
		duration = state.duration, markers = state.markers,
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
	state.duration, state.markers = 0, {}
	for _, e in ipairs(sc.events) do
		state.duration = math.max(state.duration, e.t)
		if e.type ~= "weather" then
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

local function dispatch(e)
	if e.type == "strike" then
		Lightning.strike(e.bearing, e.miles)
	elseif e.type == "weather" then
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
	print(("[Engine] t=%d %s"):format(e.t, e.type))
end

local acc = 0
RunService.Heartbeat:Connect(function(dt)
	if not state.playing or not state.scenario then return end
	state.simTime += dt * state.speed
	for i, e in ipairs(state.scenario.events) do
		if not state.fired[i] and e.t <= state.simTime then
			state.fired[i] = true
			dispatch(e)
		end
	end
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
	now.t = math.floor(state.simTime) -- stamped with the current sim time, as if it were on the timeline
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
