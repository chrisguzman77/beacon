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
	lighting = { Brightness = 3, OutdoorAmbient = Color3.fromRGB(118, 120, 126) },
	atmosphere = { Density = 0.36, Haze = 1.8, Glare = 0.35, Color = Color3.fromRGB(200, 204, 196), Decay = Color3.fromRGB(108, 118, 112) },
	grade = { Brightness = 0, Contrast = 0.12, Saturation = -0.06, TintColor = Color3.fromRGB(255, 248, 236) },
	clouds = { Cover = 0.5, Density = 0.55, Color = Color3.new(1, 1, 1) },
}
local STORM = {
	lighting = { Brightness = 1.1, OutdoorAmbient = Color3.fromRGB(78, 84, 96) },
	atmosphere = { Density = 0.58, Haze = 2.6, Glare = 0, Color = Color3.fromRGB(104, 110, 120), Decay = Color3.fromRGB(64, 70, 84) },
	grade = { Brightness = -0.04, Contrast = 0.16, Saturation = -0.3, TintColor = Color3.fromRGB(212, 222, 236) },
	clouds = { Cover = 0.96, Density = 0.9, Color = Color3.fromRGB(105, 110, 120) },
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

-- The river crossing: the river side climbs from its normal level at -3, the land side floods only once the river
-- passes the levee top at 4. 100 mm brings the river to the levee top, 120 mm and up overtops it.
local RIVER_NORMAL, LEVEE_TOP, RIVER_PER_MM = -3, 4, 0.07
local function setRiver(depth_mm, instant)
	local riverTop = RIVER_NORMAL + math.max(0, depth_mm) * RIVER_PER_MM
	local landTop = riverTop > LEVEE_TOP and (riverTop - 0.6) or -1.2
	local plan = {
		{ workspace:FindFirstChild("RiverFloodWater"), riverTop, depth_mm > 0 and 0.2 or 1 },
		{ workspace:FindFirstChild("LandFloodWater"), landTop, riverTop > LEVEE_TOP and 0.25 or 1 },
	}
	for _, p in ipairs(plan) do
		local water, top, transparency = p[1], p[2], p[3]
		if water then
			local goal = { Transparency = transparency, CFrame = CFrame.new(water.CFrame.Position.X, top - water.Size.Y / 2, water.CFrame.Position.Z) }
			if instant then
				for name, v in pairs(goal) do water[name] = v end
			else
				TweenService:Create(water, TweenInfo.new(RISE_SECONDS, Enum.EasingStyle.Sine), goal):Play()
			end
		end
	end
	workspace:SetAttribute("RiverOvertop", riverTop > LEVEE_TOP)
end

-- the rain falls over whichever setting is active
function WeatherFx.moveRain(position)
	local part = workspace:FindFirstChild("RainEmitter")
	if part then part.CFrame = CFrame.new(position + Vector3.new(0, 150, 0)) end
end

function WeatherFx.setWater(depth_mm, instant)
	setRiver(depth_mm, instant)
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
	for _, n in ipairs({ "Gator", "HazardPin" }) do
		local x = workspace:FindFirstChild(n)
		if x then x:Destroy() end
	end
end

-- a crew hazard report as it shows on the site map: a pin with the report, and the 30 ft buffer on the ground
local function hazardPin(at, title, detail)
	local m = Instance.new("Model")
	m.Name = "HazardPin"
	local function piece(size, cf, color, material, shape)
		local p = Instance.new("Part")
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
		p.Size, p.CFrame, p.Color, p.Material = size, cf, color, material or Enum.Material.SmoothPlastic
		if shape then p.Shape = shape end
		p.Parent = m
		return p
	end
	local yellow = Color3.fromRGB(255, 200, 0)
	piece(Vector3.new(0.25, 7, 0.25), CFrame.new(at + Vector3.new(0, 3.5, 0)), Color3.fromRGB(40, 40, 46), Enum.Material.Metal)
	local head = piece(Vector3.new(1.4, 1.4, 1.4), CFrame.new(at + Vector3.new(0, 7.6, 0)), yellow, Enum.Material.Neon, Enum.PartType.Ball)
	-- 30 ft is about 28 studs across at our 1 stud to 1.1 ft
	local ring = piece(Vector3.new(0.12, 28, 28), CFrame.new(at + Vector3.new(0, 0.12, 0)) * CFrame.Angles(0, 0, math.rad(90)), yellow, Enum.Material.Neon, Enum.PartType.Cylinder)
	ring.Transparency = 0.75
	local bb = Instance.new("BillboardGui")
	bb.Size, bb.StudsOffset, bb.MaxDistance, bb.LightInfluence = UDim2.fromOffset(250, 58), Vector3.new(0, 2.4, 0), 250, 0
	bb.Parent = head
	local function line(text, y, h, color, font)
		local t = Instance.new("TextLabel")
		t.BackgroundColor3, t.BackgroundTransparency, t.BorderSizePixel = Color3.fromRGB(14, 16, 22), 0.15, 0
		t.Size, t.Position = UDim2.fromScale(1, h), UDim2.fromScale(0, y)
		t.Font, t.TextScaled, t.TextColor3, t.Text = font, true, color, text
		t.Parent = bb
	end
	line(title, 0, 0.55, yellow, Enum.Font.GothamBold)
	line(detail, 0.55, 0.45, Color3.fromRGB(236, 238, 243), Enum.Font.GothamMedium)
	m.Parent = workspace
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
		rain.Rate = math.clamp((e.rain or 0) * 12, 0, 800) -- the worst cells come down in sheets
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
		-- pinned where the crew saw it, centered on where it crawls to
		local at = (spot.CFrame * CFrame.new(0, -1, -8)).Position
		hazardPin(at, "HAZARD REPORT  ·  ALLIGATOR", "Crew photo, tagged and shared  ·  30 ft buffer")
	end
end

return WeatherFx
