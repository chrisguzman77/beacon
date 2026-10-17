-- WeatherFx (ModuleScript)
-- Blends the sky between a clear Florida afternoon and a storm by the scenario's cloud cover.
local Lighting = game:GetService("Lighting")
local ServerStorage = game:GetService("ServerStorage")
local TweenService = game:GetService("TweenService")

local WeatherFx = {}

local function ensure(parent, class, name)
	local x = parent:FindFirstChild(name)
	if not x then
		x = Instance.new(class)
		x.Name = name
		x.Parent = parent
	end
	return x
end

local targets = {
	lighting = Lighting,
	atmosphere = ensure(Lighting, "Atmosphere", "Atmosphere"),
	grade = ensure(Lighting, "ColorCorrectionEffect", "Grade"),
	clouds = ensure(workspace.Terrain, "Clouds", "Clouds"),
}

local CLEAR = {
	lighting = { Brightness = 2.5, OutdoorAmbient = Color3.fromRGB(140, 140, 150) },
	atmosphere = { Density = 0.34, Haze = 1.6, Glare = 0.25, Color = Color3.fromRGB(196, 198, 172), Decay = Color3.fromRGB(96, 112, 96) },
	grade = { Brightness = 0, Contrast = 0.05, Saturation = 0.1, TintColor = Color3.new(1, 1, 1) },
	clouds = { Cover = 0.45, Density = 0.6, Color = Color3.new(1, 1, 1) },
}
local STORM = {
	lighting = { Brightness = 1.2, OutdoorAmbient = Color3.fromRGB(90, 95, 110) },
	atmosphere = { Density = 0.55, Haze = 2.5, Glare = 0, Color = Color3.fromRGB(110, 115, 125), Decay = Color3.fromRGB(70, 75, 90) },
	grade = { Brightness = -0.05, Contrast = 0.12, Saturation = -0.25, TintColor = Color3.fromRGB(215, 225, 240) },
	clouds = { Cover = 0.95, Density = 0.85, Color = Color3.fromRGB(120, 125, 135) },
}

-- k = 0 is CLEAR, k = 1 is STORM
local function blend(k)
	local out = {}
	for key, props in pairs(CLEAR) do
		out[key] = {}
		for name, a in pairs(props) do
			local b = STORM[key][name]
			out[key][name] = typeof(a) == "Color3" and a:Lerp(b, k) or a + (b - a) * k
		end
	end
	return out
end

local function set(preset, seconds)
	for key, props in pairs(preset) do
		if seconds > 0 then
			TweenService:Create(targets[key], TweenInfo.new(seconds, Enum.EasingStyle.Sine), props):Play()
		else
			for name, v in pairs(props) do targets[key][name] = v end
		end
	end
end

local function emitter()
	local part = workspace:FindFirstChild("RainEmitter")
	return part and part:FindFirstChildOfClass("ParticleEmitter")
end

-- The flood. FloodWater is a site wide plane that sits under the ground until a water event raises it.
-- The scenarios speak in depth_mm (the contract); the twin exaggerates so the rise reads on screen:
-- 20 mm is shin deep on the pad (gauge about 1 ft), 60 mm thigh deep (3 ft), 100 mm chest deep (4.7 ft).
local WATER_Y = -0.5
local STUDS_PER_MM = 2.4 / 60
local RISE_SECONDS = 8

function WeatherFx.setWater(depth_mm, instant)
	local top = depth_mm > 0 and math.min(6, 0.3 + depth_mm * STUDS_PER_MM) or -1
	workspace:SetAttribute("WaterSurface", math.max(WATER_Y, top)) -- Wildlife floats the boat, logs, pads, and gators to this
	local water = workspace:FindFirstChild("FloodWater")
	if not water then return end
	local goal = {
		Transparency = depth_mm > 0 and 0.28 or 1,
		CFrame = CFrame.new(water.CFrame.Position.X, top - water.Size.Y / 2, water.CFrame.Position.Z),
	}
	if instant then
		for name, v in pairs(goal) do water[name] = v end
	else
		TweenService:Create(water, TweenInfo.new(RISE_SECONDS, Enum.EasingStyle.Sine), goal):Play()
	end
end

-- the sun's position comes from the scenario clock (ScenarioEngine), the weather only dims and tints it
function WeatherFx.setClock(hours)
	Lighting.ClockTime = hours
end

function WeatherFx.reset()
	set(blend(0), 0)
	workspace:SetAttribute("Storm", 0)
	workspace:SetAttribute("Rain", 0)
	workspace.GlobalWind = Vector3.new(4, 0, 0)
	local e = emitter()
	if e then e.Enabled, e.Rate = false, 0 end
	WeatherFx.setWater(0, true)
	local gator = workspace:FindFirstChild("Gator")
	if gator then gator:Destroy() end
end

function WeatherFx.apply(e)
	local k = math.clamp(((e.clouds or 0) - 0.2) / 0.6, 0, 1)
	set(blend(k), 4)
	workspace:SetAttribute("Storm", k) -- Wildlife flushes the egrets past 0.6
	workspace:SetAttribute("Rain", e.rain or 0) -- Ambience fades the rain loop to this
	-- wind from the scenario's gust (mph), blowing east off the storm: bends the rain, the grass, and the clouds
	workspace.GlobalWind = Vector3.new(math.max(4, (e.gust or 0) * 0.8), 0, (e.gust or 0) * 0.15)
	local rain = emitter()
	if rain then
		rain.Enabled = (e.rain or 0) > 0
		rain.Rate = math.clamp((e.rain or 0) * 8, 0, 500)
	end
end

function WeatherFx.spawnGator()
	if workspace:FindFirstChild("Gator") then return end
	local template = ServerStorage:FindFirstChild("Gator")
	local spot = workspace:FindFirstChild("GatorSpot")
	if template and spot then
		local g = template:Clone()
		g:PivotTo(spot.CFrame)
		g.Parent = workspace
	end
end

return WeatherFx
