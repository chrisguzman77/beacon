-- SceneBuilder (ModuleScript in ServerScriptService/World)
-- Builds the whole jobsite from code: a Florida swamp edge with cypress, moss, reeds, lily pads,
-- alligators and egrets, plus the beacon, the work zone, equipment, poles, and every instance the World scripts look up by name (simulator guide 2.2).
-- Run it once in edit mode from the Command Bar, then save and publish:
--   require(game.ServerScriptService.World.SceneBuilder).build()
-- Re-running wipes the terrain and everything named in OWNED, then rebuilds it the same way.
-- Nothing is uploaded; every part is a plain Part.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local WeatherFx = require(script.Parent.WeatherFx)

local Builder = {}

local OWNED = { "Site", "Beacon", "ZonePart", "SiteBillboard", "Excavator", "RainEmitter", "GatorSpot", "FloodWater", "SpawnLocation", "Baseplate", "ConditionsBoard", "ConditionsBoardRiver", "RiverBeacon", "RiverFloodWater", "LandFloodWater" }
local SITE_NAME = "SEMINOLE · SITE 12" -- the beacon site, Putnam County FL
local ZONE = 60 -- work zone is ZONE x ZONE studs, centered on the beacon at the origin
-- open water of the swamp east and south of the site, { center, radius }
local SWAMP = {
	{ Vector3.new(150, 0, -60), 70 }, { Vector3.new(205, 0, 45), 85 }, { Vector3.new(170, 0, 150), 60 },
	{ Vector3.new(265, 0, -150), 75 }, { Vector3.new(40, 0, -235), 50 },
}
local WATER_Y = -0.5 -- water surface

local C = {
	steel = Color3.fromRGB(78, 82, 90),
	concrete = Color3.fromRGB(168, 165, 158),
	dark = Color3.fromRGB(32, 34, 40),
	black = Color3.fromRGB(10, 10, 12),
	panel = Color3.fromRGB(18, 20, 26),
	safety = Color3.fromRGB(255, 184, 28),
	orange = Color3.fromRGB(240, 110, 30),
	white = Color3.fromRGB(236, 236, 230),
	green = Color3.fromRGB(40, 210, 100),
	yellow = Color3.fromRGB(255, 190, 0),
	red = Color3.fromRGB(235, 40, 40),
	dim = Color3.fromRGB(150, 155, 165),
	glass = Color3.fromRGB(140, 175, 195),
	tire = Color3.fromRGB(26, 26, 28),
	wood = Color3.fromRGB(105, 82, 60),
	bark = Color3.fromRGB(88, 70, 54),
	lcd = Color3.fromRGB(130, 200, 60),
	lcdText = Color3.fromRGB(20, 40, 10),
	leaves = { Color3.fromRGB(62, 96, 56), Color3.fromRGB(74, 108, 60), Color3.fromRGB(56, 86, 62) },
	moss = Color3.fromRGB(128, 138, 108),
	pine = Color3.fromRGB(48, 78, 46),
	pineBark = Color3.fromRGB(96, 72, 54),
	lily = Color3.fromRGB(72, 112, 48),
	reed = Color3.fromRGB(118, 138, 70),
	cattail = Color3.fromRGB(95, 62, 38),
	gator = Color3.fromRGB(50, 56, 38),
	gatorBelly = Color3.fromRGB(150, 140, 100),
	gatorEye = Color3.fromRGB(230, 200, 60),
	alum = Color3.fromRGB(150, 155, 160),
	navy = Color3.fromRGB(40, 55, 90),
	matWood = Color3.fromRGB(120, 92, 64),
	mud = Color3.fromRGB(84, 66, 44),
	canopy = Color3.fromRGB(40, 110, 190),
}

local rng
local floating -- Site.Floating: lily pads, logs, the boat. Wildlife lifts them as the water rises.

---------------------------------------------------------------- helpers

local function part(parent, name, size, cf, color, material, shape)
	local p = Instance.new("Part")
	p.Name = name
	if shape then p.Shape = shape end
	p.Size, p.CFrame, p.Color = size, cf, color
	p.Material = material or Enum.Material.SmoothPlastic
	p.Anchored = true
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function ghost(p)
	p.Transparency, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = 1, false, false, false, false
	return p
end

-- vertical cylinder standing on pos
local function column(parent, name, height, diameter, pos, color, material)
	return part(parent, name, Vector3.new(height, diameter, diameter),
		CFrame.new(pos + Vector3.new(0, height / 2, 0)) * CFrame.Angles(0, 0, math.rad(90)),
		color, material, Enum.PartType.Cylinder)
end

-- block from a to b
local function strut(parent, name, a, b, width, color)
	return part(parent, name, Vector3.new(width, width, (b - a).Magnitude), CFrame.lookAt((a + b) / 2, b), color)
end

local function model(parent, name)
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

local function ensure(parent, class, name)
	local x = parent:FindFirstChild(name)
	if not x then
		x = Instance.new(class)
		x.Name = name
		x.Parent = parent
	end
	return x
end

-- every sign in the site faces +Z, toward the spawn
local function surface(p, ppu)
	local g = Instance.new("SurfaceGui")
	g.Face = Enum.NormalId.Back
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = ppu or 60
	g.LightInfluence = 0
	g.Parent = p
	return g
end

local function label(parent, name, text, size, pos, color, font, bg)
	local t = Instance.new("TextLabel")
	t.Name, t.Text, t.Size, t.Position = name, text, size, pos
	t.TextColor3, t.Font, t.TextScaled = color, font or Enum.Font.GothamBold, true
	t.BorderSizePixel = 0
	t.BackgroundTransparency = bg and 0 or 1
	if bg then t.BackgroundColor3 = bg end
	t.Parent = parent
	return t
end

---------------------------------------------------------------- pieces

local function plumbing()
	local sim = ensure(ReplicatedStorage, "Folder", "SimEvents")
	for _, n in ipairs({ "Strike", "Weather", "Water", "PresenceChanged" }) do
		ensure(sim, "BindableEvent", n)
	end
	for _, n in ipairs({ "FlashEvent", "ScenarioControl", "ScenarioState", "StrikeHere", "StrikeRadar" }) do
		ensure(ReplicatedStorage, "RemoteEvent", n)
	end
	local thunder = ensure(ReplicatedStorage, "Sound", "Thunder")
	if thunder.SoundId == "" then
		-- "Thunder Sharp Booming Strikes Rumbling 1", ProSoundEffects, Roblox licensed library audio, 12.9 s.
		-- A deep boom with a long tail, which is what the mic listener's 120 Hz band pass hears best.
		thunder.SoundId = "rbxassetid://9120021540"
	end
end

local function terrain()
	local T = workspace.Terrain
	T:Clear()
	T:FillBlock(CFrame.new(0, -8, 0), Vector3.new(2048, 16, 2048), Enum.Material.Grass)
	T:FillBlock(CFrame.new(-620, -8, 0), Vector3.new(800, 16, 2048), Enum.Material.LeafyGrass) -- dry pine flatwoods west
	for _, s in ipairs(SWAMP) do
		local c, r = s[1], s[2]
		T:FillCylinder(CFrame.new(c.X, -8, c.Z), 16, r + 16, Enum.Material.Mud) -- muddy bank
		T:FillCylinder(CFrame.new(c.X, -3, c.Z), 6, r, Enum.Material.Air)
		T:FillCylinder(CFrame.new(c.X, -3.25, c.Z), 5.5, r, Enum.Material.Water)
	end
	T:FillBlock(CFrame.new(0, -8, 0), Vector3.new(112, 16, 112), Enum.Material.Ground) -- work pad, stays dry
	T:FillBlock(CFrame.new(0, -8, 520), Vector3.new(28, 16, 930), Enum.Material.Mud) -- access road
	pcall(function() T.Decoration = true end) -- swaying grass; not scriptable in every Studio, tick Terrain > Decoration by hand
	T.WaterColor = Color3.fromRGB(52, 66, 40)
	T.WaterTransparency, T.WaterReflectance = 0.7, 0.35
	T.WaterWaveSize, T.WaterWaveSpeed = 0.03, 3
	T:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(92, 120, 58))
	T:SetMaterialColor(Enum.Material.LeafyGrass, Color3.fromRGB(110, 118, 64))
	T:SetMaterialColor(Enum.Material.Ground, Color3.fromRGB(132, 116, 88))
	T:SetMaterialColor(Enum.Material.Mud, Color3.fromRGB(78, 64, 46))
end

local function beacon()
	local m = model(workspace, "Beacon")
	local base = part(m, "Base", Vector3.new(0.7, 10, 0.7), CFrame.new(0, 5, 0), C.steel, Enum.Material.Metal)
	m.PrimaryPart = base
	part(m, "Footing", Vector3.new(3, 0.6, 3), CFrame.new(0, 0.3, 0), C.concrete, Enum.Material.Concrete)
	part(m, "Head", Vector3.new(4.4, 3.6, 1.4), CFrame.new(0, 8.2, 0), C.safety)
	-- the real unit's silhouette: a tilted solar panel behind the head, the sensor pod on a short mast, a whip antenna
	part(m, "SolarBracket", Vector3.new(0.3, 2.2, 0.3), CFrame.new(0, 6.2, -1.1) * CFrame.Angles(math.rad(-20), 0, 0), C.steel, Enum.Material.Metal)
	part(m, "SolarPanel", Vector3.new(3.4, 0.15, 2.4), CFrame.new(0, 7.3, -2) * CFrame.Angles(math.rad(35), 0, 0), Color3.fromRGB(28, 40, 72), Enum.Material.Glass)
	part(m, "PodMast", Vector3.new(0.25, 2.4, 0.25), CFrame.new(1.9, 11.2, 0), C.steel, Enum.Material.Metal)
	part(m, "SensorPod", Vector3.new(1.1, 0.9, 0.9), CFrame.new(1.9, 12.85, 0), C.white)
	part(m, "PodLens", Vector3.new(0.5, 0.5, 0.1), CFrame.new(1.9, 12.85, 0.46), C.dark, Enum.Material.Glass)
	part(m, "Antenna", Vector3.new(0.08, 3, 0.08), CFrame.new(-1.9, 11.5, 0), C.dark)

	-- status light
	column(m, "LightBase", 0.5, 2, Vector3.new(0, 10, 0), C.dark)
	local light = part(m, "Light", Vector3.new(1.6, 1.6, 1.6), CFrame.new(0, 11.2, 0), C.green, Enum.Material.Neon, Enum.PartType.Ball)
	local glow = Instance.new("PointLight")
	glow.Name, glow.Range, glow.Brightness, glow.Color = "Glow", 20, 3, C.green
	glow.Parent = light
	-- level tag floating over the light, readable from the spawn
	local tag = Instance.new("BillboardGui")
	tag.Name, tag.Size, tag.StudsOffset = "LevelTag", UDim2.fromOffset(240, 64), Vector3.new(0, 2.6, 0)
	tag.MaxDistance, tag.LightInfluence = 300, 0
	tag.Parent = light
	label(tag, "Level", "ALL CLEAR", UDim2.fromScale(1, 0.62), UDim2.new(), C.green)
	label(tag, "Sub", "HAZARD INDEX 0", UDim2.fromScale(1, 0.38), UDim2.fromScale(0, 0.62), C.white, Enum.Font.GothamMedium)

	-- countdown
	local display = part(m, "Display", Vector3.new(3.6, 1.3, 0.2), CFrame.new(0, 9.15, 0.75), C.black)
	label(surface(display), "Countdown", "--:--", UDim2.fromScale(1, 1), UDim2.new(), C.red, Enum.Font.Code, C.black)

	-- hazard index gauge
	local gauge = part(m, "Gauge", Vector3.new(3.6, 1.4, 0.2), CFrame.new(0, 7.45, 0.75), C.black)
	local g = surface(gauge)
	local band = Instance.new("Frame")
	band.Size, band.Position, band.BorderSizePixel = UDim2.fromScale(0.9, 0.1), UDim2.fromScale(0.05, 0.08), 0
	band.BackgroundColor3 = Color3.new(1, 1, 1)
	band.Parent = g
	local grad = Instance.new("UIGradient")
	grad.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, C.green), ColorSequenceKeypoint.new(0.5, C.yellow), ColorSequenceKeypoint.new(1, C.red),
	})
	grad.Parent = band
	label(g, "Lo", "0", UDim2.fromScale(0.1, 0.25), UDim2.fromScale(0.03, 0.7), C.dim)
	label(g, "Hi", "10", UDim2.fromScale(0.1, 0.25), UDim2.fromScale(0.87, 0.7), C.dim)
	local hubCf = CFrame.new(0, 6.95, 0.95)
	part(m, "NeedleHub", Vector3.new(0.3, 0.3, 0.3), hubCf, C.dark, Enum.Material.Metal, Enum.PartType.Ball)
	part(m, "Needle", Vector3.new(0.08, 1, 0.06), hubCf * CFrame.Angles(0, 0, math.rad(90)) * CFrame.new(0, 0.5, 0), C.white, Enum.Material.Neon)

	-- equipment lockout LCD
	local lcd = part(m, "Lcd", Vector3.new(3.4, 1.1, 0.3), CFrame.new(0, 4.6, 0.5), C.black)
	local lg = surface(lcd)
	label(lg, "Line1", "RIG 1  RUNNING", UDim2.fromScale(0.94, 0.42), UDim2.fromScale(0.03, 0.06), C.lcdText, Enum.Font.Code, C.lcd)
	label(lg, "Line2", "BEACON LINK OK", UDim2.fromScale(0.94, 0.42), UDim2.fromScale(0.03, 0.52), C.lcdText, Enum.Font.Code, C.lcd)

	for k, v in pairs({
		Led = "green", Countdown = 0, Index = 0, Interlock = "running", Presence = false,
		Online = false, Lcd1 = "RIG 1  RUNNING", Lcd2 = "BEACON LINK OK", Alerts = "[]",
	}) do
		m:SetAttribute(k, v)
	end
end

-- yellow and black stripes along the ground from a to b
local function hazardLine(parent, a, b)
	local n = math.floor((b - a).Magnitude / 3)
	for i = 0, n - 1 do
		local p0, p1 = a:Lerp(b, i / n), a:Lerp(b, (i + 1) / n)
		local s = part(parent, "Stripe", Vector3.new(1, 0.12, (p1 - p0).Magnitude), CFrame.lookAt((p0 + p1) / 2, p1),
			i % 2 == 0 and C.safety or C.dark)
		s.CanCollide, s.CanQuery, s.CastShadow = false, false, false
	end
end

local function zone()
	local z = ghost(part(workspace, "ZonePart", Vector3.new(ZONE, 14, ZONE), CFrame.new(0, 7, 0), C.safety))
	local floor = part(z, "ZoneFloor", Vector3.new(ZONE, 0.05, ZONE), CFrame.new(0, 0.05, 0), C.green)
	floor.Transparency, floor.CanCollide, floor.CanQuery, floor.CastShadow = 0.9, false, false, false
	local h = ZONE / 2
	local corners = { Vector3.new(-h, 0.07, -h), Vector3.new(h, 0.07, -h), Vector3.new(h, 0.07, h), Vector3.new(-h, 0.07, h) }
	for i = 1, 4 do
		hazardLine(z, corners[i], corners[i % 4 + 1])
	end
end

local function barrier(parent, cf)
	part(parent, "Barrier", Vector3.new(6, 2.4, 1.2), cf * CFrame.new(0, 1.2, 0), C.white, Enum.Material.Concrete)
	part(parent, "BarrierBand", Vector3.new(6.02, 0.5, 1.22), cf * CFrame.new(0, 1.9, 0), C.orange)
end

local function excavator(cf)
	local function P(x, y, z) return (cf * CFrame.new(x, y, z)).Position end
	local m = model(workspace, "Excavator")
	part(m, "TrackL", Vector3.new(1.8, 2, 10), cf * CFrame.new(-2.8, 1, 0), C.tire)
	part(m, "TrackR", Vector3.new(1.8, 2, 10), cf * CFrame.new(2.8, 1, 0), C.tire)
	m.PrimaryPart = part(m, "Undercarriage", Vector3.new(4, 1.2, 7), cf * CFrame.new(0, 1.6, 0), C.steel, Enum.Material.Metal)
	-- everything above the slewing ring swings as one model, BeaconVisuals freezes it on lockout
	local up = model(m, "Upper")
	up.PrimaryPart = ghost(part(up, "Hub", Vector3.new(1, 1, 1), cf * CFrame.new(0, 2.6, 0), C.steel))
	part(up, "Body", Vector3.new(6.5, 2.8, 7), cf * CFrame.new(0, 3.6, 0.8), C.safety)
	part(up, "Counterweight", Vector3.new(6.5, 2, 1.6), cf * CFrame.new(0, 3.8, 4.8), C.dark)
	local cab = part(up, "Cab", Vector3.new(2.8, 3, 3), cf * CFrame.new(-1.8, 6.5, -1.2), C.glass, Enum.Material.Glass)
	cab.Transparency = 0.35
	part(up, "CabRoof", Vector3.new(3, 0.3, 3.2), cf * CFrame.new(-1.8, 8.1, -1.2), C.safety)
	strut(up, "Boom", P(1.4, 4.8, -1.8), P(1.4, 9.6, -9.4), 1.2, C.safety)
	strut(up, "Stick", P(1.4, 9.6, -9.4), P(1.4, 3.4, -10.6), 0.9, C.safety)
	part(up, "Bucket", Vector3.new(2.4, 1.8, 1.8), cf * CFrame.new(1.4, 2.6, -10.8), C.dark, Enum.Material.Metal)
end

local function truck(parent, cf)
	for _, x in ipairs({ -3.1, 3.1 }) do
		for _, z in ipairs({ -4.6, 3.8 }) do
			part(parent, "Wheel", Vector3.new(1.2, 3, 3), cf * CFrame.new(x, 1.5, z), C.tire, nil, Enum.PartType.Cylinder)
		end
	end
	part(parent, "Chassis", Vector3.new(6, 0.8, 13), cf * CFrame.new(0, 2.6, 0), C.dark)
	part(parent, "Cab", Vector3.new(6, 3.6, 3.8), cf * CFrame.new(0, 4.8, -4.4), C.white)
	part(parent, "Windshield", Vector3.new(5.6, 1.6, 0.2), cf * CFrame.new(0, 5.6, -6.32), C.glass, Enum.Material.Glass)
	part(parent, "LightBar", Vector3.new(3.6, 0.35, 0.6), cf * CFrame.new(0, 6.78, -4.4), C.orange, Enum.Material.Neon)
	part(parent, "Bed", Vector3.new(6, 2.4, 8), cf * CFrame.new(0, 4.2, 2.4), C.white)
	part(parent, "Stripe", Vector3.new(6.05, 0.4, 8.05), cf * CFrame.new(0, 4.6, 2.4), C.orange)
	column(parent, "Turret", 1, 1.6, (cf * CFrame.new(0, 5.4, 4.6)).Position, C.white)
	local a, b = (cf * CFrame.new(0, 6.2, 4.6)).Position, (cf * CFrame.new(0, 10.5, -2)).Position
	strut(parent, "Boom", a, b, 0.8, C.white)
	part(parent, "Basket", Vector3.new(2.2, 2, 2.2), CFrame.new(b + Vector3.new(0, 0.6, 0)) * cf.Rotation, C.orange)
end

local function trailer(parent, cf)
	part(parent, "Skirt", Vector3.new(26, 1, 9), cf * CFrame.new(0, 0.5, 0), C.dark)
	part(parent, "Trailer", Vector3.new(26, 8, 9), cf * CFrame.new(0, 5, 0), C.white)
	part(parent, "Windows", Vector3.new(16, 2, 9.1), cf * CFrame.new(3, 6, 0), C.glass, Enum.Material.Glass)
	part(parent, "Door", Vector3.new(3, 6, 0.2), cf * CFrame.new(-9, 4, 4.55), C.steel)
	part(parent, "Step", Vector3.new(4, 1, 2.5), cf * CFrame.new(-9, 0.5, 5.6), C.steel, Enum.Material.DiamondPlate)
end

-- one power pole. Returns the three wire attachments, their X axis points down so beams sag.
local function pole(parent, pos)
	column(parent, "Pole", 38, 1.3, pos, C.wood, Enum.Material.Wood)
	local arm = part(parent, "Crossarm", Vector3.new(10, 0.7, 0.7), CFrame.new(pos + Vector3.new(0, 35, 0)), C.wood, Enum.Material.Wood)
	local atts = {}
	for _, x in ipairs({ -4.2, -1.8, 4.2 }) do
		column(parent, "Insulator", 0.8, 0.45, pos + Vector3.new(x, 35.35, 0), C.white, Enum.Material.Glass)
		local a = Instance.new("Attachment")
		a.CFrame = CFrame.new(x, 1.15, 0) * CFrame.Angles(0, 0, math.rad(-90))
		a.Parent = arm
		table.insert(atts, a)
	end
	return atts
end

local function powerLine(parent)
	local prev
	for z = -420, 960, 92 do
		local atts = pole(parent, Vector3.new(-44, 0, z))
		if prev then
			for i = 1, 3 do
				local w = Instance.new("Beam")
				w.Attachment0, w.Attachment1 = prev[i], atts[i]
				w.CurveSize0, w.CurveSize1 = 6, -6
				w.Width0, w.Width1, w.Segments = 0.14, 0.14, 16
				w.Color = ColorSequence.new(C.dark)
				w.FaceCamera = true
				w.Parent = atts[i].Parent
			end
		end
		prev = atts
	end
end

-- how far (x, z) is outside the nearest open water edge, negative when in the water
local function shoreDistance(x, z)
	local best = math.huge
	for _, s in ipairs(SWAMP) do
		best = math.min(best, (Vector2.new(x, z) - Vector2.new(s[1].X, s[1].Z)).Magnitude - s[2])
	end
	return best
end

local function nonCollide(p)
	p.CanCollide, p.CanQuery, p.CastShadow = false, false, false
	return p
end

-- bald cypress: buttressed trunk, flat crown, Spanish moss, knees. In the shallows it stands from the swamp floor.
local function cypress(parent, x, z, h)
	local wet = shoreDistance(x, z) < 0
	local baseY = wet and -6 or 0
	local base = Vector3.new(x, baseY, z)
	h += wet and 6 or 0
	column(parent, "Flare", wet and 7.5 or 3, 3.4, base - Vector3.new(0, 0.5, 0), C.bark, Enum.Material.Wood)
	column(parent, "Trunk", h, 1.4, base, C.bark, Enum.Material.Wood)
	local top = baseY + h
	local leaf = C.leaves[rng:NextInteger(1, #C.leaves)]
	for i, r in ipairs({ 16, 12, 8 }) do
		local p = Vector3.new(x + rng:NextNumber(-1.5, 1.5), top - 6 + i * 2.2, z + rng:NextNumber(-1.5, 1.5))
		column(parent, "Canopy", 1.8, r * rng:NextNumber(0.85, 1.1), p, leaf, Enum.Material.Grass)
	end
	for _ = 1, rng:NextInteger(4, 7) do
		local a, d, len = rng:NextNumber(0, math.pi * 2), rng:NextNumber(2.5, 6.5), rng:NextNumber(3, 6)
		local moss = part(parent, "Moss", Vector3.new(0.25, len, rng:NextNumber(0.8, 1.6)),
			CFrame.new(x + math.cos(a) * d, top - 5.5 - len / 2, z + math.sin(a) * d) * CFrame.Angles(0, a, 0), C.moss, Enum.Material.Grass)
		moss.Transparency = 0.2
		nonCollide(moss)
	end
	if wet or rng:NextNumber() < 0.5 then
		for _ = 1, rng:NextInteger(2, 5) do
			local a, d = rng:NextNumber(0, math.pi * 2), rng:NextNumber(3, 7)
			column(parent, "Knee", rng:NextNumber(1, 2.5) + (wet and 5.5 or 0), rng:NextNumber(0.5, 0.9),
				Vector3.new(x + math.cos(a) * d, baseY, z + math.sin(a) * d), C.bark, Enum.Material.Wood)
		end
	end
end

-- longleaf pine on the dry ground west of the site
local function pine(parent, x, z, h)
	column(parent, "Trunk", h, 1.1, Vector3.new(x, 0, z), C.pineBark, Enum.Material.Wood)
	for i = 1, 3 do
		local d = rng:NextNumber(6, 9)
		part(parent, "Crown", Vector3.new(d, d, d),
			CFrame.new(x + rng:NextNumber(-2.5, 2.5), h - 1 - i * 2.4, z + rng:NextNumber(-2.5, 2.5)), C.pine, Enum.Material.Grass, Enum.PartType.Ball)
	end
end

local function trees(parent)
	local placed = 0
	while placed < 70 do -- cypress dome around and in the shallows of the swamp
		local x, z = rng:NextNumber(60, 360), rng:NextNumber(-320, 240)
		local shore = shoreDistance(x, z)
		local onPad = math.abs(x) < 80 and math.abs(z) < 80
		local onDock = x < 112 and math.abs(z + 60) < 10
		if shore > -22 and shore < 60 and not onPad and not onDock then
			cypress(parent, x, z, rng:NextNumber(20, 32))
			placed += 1
		end
	end
	placed = 0
	while placed < 50 do -- pine flatwoods west and north
		local x, z = rng:NextNumber(-520, -60), rng:NextNumber(-460, 460)
		if math.abs(x + 44) > 10 and (x < -80 or z < -120) and shoreDistance(x, z) > 20 then
			pine(parent, x, z, rng:NextNumber(34, 48))
			placed += 1
		end
	end
end

-- reeds and cattails along the shore, lily pads and flowers on the water
local function marsh(parent)
	for _, s in ipairs(SWAMP) do
		local c, r = s[1], s[2]
		for _ = 1, 16 do
			local a, d = rng:NextNumber(0, math.pi * 2), r + rng:NextNumber(-7, 3)
			local cx, cz = c.X + math.cos(a) * d, c.Z + math.sin(a) * d
			if not (math.abs(cx) < 75 and math.abs(cz) < 75) then
				for _ = 1, 7 do
					local x, z, h = cx + rng:NextNumber(-2, 2), cz + rng:NextNumber(-2, 2), rng:NextNumber(3, 6)
					local baseY = WATER_Y - 1
					local tilt = CFrame.Angles(rng:NextNumber(-0.12, 0.12), 0, rng:NextNumber(-0.12, 0.12))
					local stem = part(parent, "Reed", Vector3.new(0.15, h, 0.15), CFrame.new(x, baseY + h / 2, z) * tilt, C.reed, Enum.Material.Grass)
					nonCollide(stem)
					if rng:NextNumber() < 0.4 then
						nonCollide(part(parent, "Cattail", Vector3.new(0.35, 1, 0.35), stem.CFrame * CFrame.new(0, h / 2 - 0.7, 0), C.cattail, Enum.Material.Fabric))
					end
				end
			end
		end
		for _ = 1, 22 do
			local a, d = rng:NextNumber(0, math.pi * 2), rng:NextNumber(0, r - 6)
			local x, z = c.X + math.cos(a) * d, c.Z + math.sin(a) * d
			nonCollide(column(floating, "LilyPad", 0.08, rng:NextNumber(1.6, 2.8), Vector3.new(x, WATER_Y + 0.02, z), C.lily, Enum.Material.Grass))
			if rng:NextNumber() < 0.25 then
				nonCollide(part(floating, "Lily", Vector3.new(0.5, 0.5, 0.5), CFrame.new(x + 0.3, WATER_Y + 0.3, z), C.white, Enum.Material.SmoothPlastic, Enum.PartType.Ball))
			end
		end
		for _ = 1, 3 do -- fallen cypress logs adrift
			local a, d = rng:NextNumber(0, math.pi * 2), rng:NextNumber(0, r - 15)
			local log = part(floating, "Log", Vector3.new(rng:NextNumber(8, 14), 1.2, 1.2),
				CFrame.new(c.X + math.cos(a) * d, WATER_Y, c.Z + math.sin(a) * d) * CFrame.Angles(0, a, 0), C.bark, Enum.Material.Wood, Enum.PartType.Cylinder)
			nonCollide(log)
		end
	end
end

-- wooden dock off the west bank of the nearest pond, with a jon boat tied to it
local function dock(parent)
	local z = -60
	part(parent, "Deck", Vector3.new(30, 0.4, 5), CFrame.new(86, 0.6, z), C.wood, Enum.Material.WoodPlanks)
	for x = 73, 99, 6.5 do
		for _, dz in ipairs({ -2.2, 2.2 }) do
			column(parent, "Piling", 7, 0.5, Vector3.new(x, -6, z + dz), C.bark, Enum.Material.Wood)
		end
	end
	local hull = CFrame.new(96, WATER_Y + 0.15, z + 5.2) * CFrame.Angles(0, math.rad(4), 0)
	local boat = model(floating, "Boat")
	boat.PrimaryPart = part(boat, "Hull", Vector3.new(11, 1.2, 4), hull, C.alum, Enum.Material.Metal)
	part(boat, "Bench", Vector3.new(0.6, 0.3, 3.6), hull * CFrame.new(-1, 0.7, 0), C.wood, Enum.Material.WoodPlanks)
	part(boat, "Motor", Vector3.new(0.8, 1.6, 0.8), hull * CFrame.new(5.6, 0.8, 0), C.dark, Enum.Material.Metal)
end

-- an American alligator about 11 ft long, built facing -Z with its pivot at the body center
local function gatorModel(parent, name, cf)
	local m = model(parent, name)
	local function g(n, size, off, color, material, shape)
		return nonCollide(part(m, n, size, cf * off, color or C.gator, material or Enum.Material.Slate, shape))
	end
	m.PrimaryPart = g("Body", Vector3.new(3, 1.3, 5), CFrame.new())
	g("Belly", Vector3.new(2.6, 0.3, 4.6), CFrame.new(0, -0.65, 0), C.gatorBelly, Enum.Material.SmoothPlastic)
	g("Neck", Vector3.new(2.1, 1.05, 1.6), CFrame.new(0, 0.05, -3.1))
	g("Head", Vector3.new(1.8, 0.9, 1.4), CFrame.new(0, 0.1, -4.3))
	g("Snout", Vector3.new(1.2, 0.55, 2.3), CFrame.new(0, -0.05, -6.1))
	g("Nostrils", Vector3.new(0.5, 0.25, 0.4), CFrame.new(0, 0.32, -7))
	for _, x in ipairs({ -0.55, 0.55 }) do
		g("EyeBump", Vector3.new(0.5, 0.4, 0.6), CFrame.new(x, 0.6, -4.5))
		g("Eye", Vector3.new(0.28, 0.28, 0.28), CFrame.new(x, 0.78, -4.62), C.gatorEye, Enum.Material.Neon, Enum.PartType.Ball)
	end
	for i, t in ipairs({ { 2.3, 1.1, 3.7 }, { 1.6, 0.85, 6.2 }, { 0.9, 0.6, 8.7 } }) do
		g("Tail" .. i, Vector3.new(t[1], t[2], 2.6), CFrame.new(0, -0.1 * i, t[3]))
	end
	for z = -1.8, 9, 1.2 do
		g("Scute", Vector3.new(0.35, 0.3, 0.6), CFrame.new(0, 0.75 - math.max(0, z) * 0.08, z))
	end
	for _, x in ipairs({ -1.7, 1.7 }) do
		for _, z in ipairs({ -1.7, 1.6 }) do
			g("Leg", Vector3.new(0.7, 0.9, 0.9), CFrame.new(x, -0.55, z))
		end
	end
	return m
end

local function egretModel(parent, cf)
	local m = model(parent, "Egret")
	local function e(n, size, off, color)
		return nonCollide(part(m, n, size, cf * off, color, Enum.Material.SmoothPlastic))
	end
	m.PrimaryPart = e("Body", Vector3.new(0.7, 0.8, 1.5), CFrame.new(), C.white)
	e("Neck", Vector3.new(0.22, 1.3, 0.22), CFrame.new(0, 0.8, -0.6) * CFrame.Angles(math.rad(-20), 0, 0), C.white)
	e("Head", Vector3.new(0.35, 0.35, 0.5), CFrame.new(0, 1.45, -0.85), C.white)
	e("Beak", Vector3.new(0.1, 0.1, 0.7), CFrame.new(0, 1.42, -1.35), C.yellow)
	for _, x in ipairs({ -0.15, 0.15 }) do
		e("Leg", Vector3.new(0.08, 1.8, 0.08), CFrame.new(x, -1.25, 0.1), C.black)
	end
	return m
end

-- gators swim loops in the ponds or bask on the banks, egrets wade in the shallows. Wildlife.server.lua animates them.
-- layout.swims: { x, z, radius, studs per second } loops; layout.basks: { x, y, z, bearing } still gators
local function wildlife(parent, layout)
	local wild = Instance.new("Folder")
	wild.Name = "Wildlife"
	wild.Parent = parent
	for i, s in ipairs(layout.swims) do
		local g = gatorModel(wild, "SwampGator", CFrame.new(s[1] + s[3], WATER_Y - 0.6, s[2]))
		g:SetAttribute("CX", s[1]); g:SetAttribute("CZ", s[2]); g:SetAttribute("R", s[3])
		g:SetAttribute("Y", WATER_Y - 0.6); g:SetAttribute("Speed", s[4]); g:SetAttribute("Phase", i * 1.7)
	end
	for _, b in ipairs(layout.basks) do
		local pos = Vector3.new(b[1], b[2], b[3])
		local g = gatorModel(wild, "SwampGator", CFrame.lookAt(pos, pos + Vector3.new(math.sin(math.rad(b[4])), 0, -math.cos(math.rad(b[4])))))
		g:SetAttribute("Bask", true)
	end
	for _ = 1, layout.egrets and 8 or 0 do
		local s = SWAMP[rng:NextInteger(1, #SWAMP)]
		local a = rng:NextNumber(0, math.pi * 2)
		local x, z = s[1].X + math.cos(a) * (s[2] - 4), s[1].Z + math.sin(a) * (s[2] - 4)
		if not (math.abs(x) < 75 and math.abs(z) < 75) then
			local e = egretModel(wild, CFrame.new(x, WATER_Y + 1, z) * CFrame.Angles(0, rng:NextNumber(0, math.pi * 2), 0))
			e:SetAttribute("Dir", math.atan2(z, x)) -- flushes away from the site
		end
	end
	-- the gator scenario's template, spawned at GatorSpot by WeatherFx
	local old = ServerStorage:FindFirstChild("Gator")
	if old then old:Destroy() end
	gatorModel(ServerStorage, "Gator", CFrame.new())
end

-- staff gauge at the zone's south east corner, so everyone sees the water climb
local function floodGauge(parent, x, z)
	column(parent, "GaugePost", 8, 0.5, Vector3.new(x + 0.9, 0, z - 0.3), C.steel, Enum.Material.Metal)
	local board = part(parent, "FloodGauge", Vector3.new(1.4, 7, 0.15), CFrame.new(x, 3.5, z), C.white)
	local g = surface(board, 50)
	label(g, "Title", "FLOOD FT", UDim2.fromScale(1, 0.05), UDim2.fromScale(0, 0.005), C.red)
	for ft = 1, 6 do -- a 5.5 stud avatar is about 6 ft, so 1 ft is about 0.92 studs
		local y = 1 - ft * 0.92 / 7
		local tick = Instance.new("Frame")
		tick.BorderSizePixel, tick.BackgroundColor3 = 0, C.black
		tick.Size, tick.Position = UDim2.fromScale(0.45, 0.006), UDim2.fromScale(0, y)
		tick.Parent = g
		label(g, "Ft" .. ft, tostring(ft), UDim2.fromScale(0.45, 0.06), UDim2.fromScale(0.5, y - 0.03), C.black)
	end
end

local function billboard(parent, cf)
	for _, x in ipairs({ -6, 6 }) do
		column(parent, "SignPost", 12, 0.6, (cf * CFrame.new(x, 0, -0.4)).Position, C.steel, Enum.Material.Metal)
	end
	local b = part(workspace, "SiteBillboard", Vector3.new(14, 7, 0.5), cf * CFrame.new(0, 8.5, 0), C.panel)
	b:SetAttribute("SiteName", SITE_NAME)
	local g = surface(b, 40)
	label(g, "Header", "PLANIT BEACON  ·  SITE STATUS", UDim2.fromScale(0.92, 0.16), UDim2.fromScale(0.04, 0.06), C.safety)
	local status = label(g, "Status", SITE_NAME .. "\nBEACON OFFLINE", UDim2.fromScale(0.92, 0.66), UDim2.fromScale(0.04, 0.28), C.white)
	status.TextXAlignment, status.TextYAlignment = Enum.TextXAlignment.Left, Enum.TextYAlignment.Top
end

local function markers(gatorSpot, withSpawn)
	if withSpawn then
		local spawn = Instance.new("SpawnLocation")
		spawn.Name, spawn.Anchored, spawn.Neutral, spawn.Duration = "SpawnLocation", true, true, 0
		spawn.Size, spawn.CFrame = Vector3.new(10, 0.4, 10), CFrame.new(0, 0.2, 100) -- faces -Z, toward the zone
		spawn.Color, spawn.Material = C.concrete, Enum.Material.Concrete
		spawn.Parent = workspace
	end

	local rainPart = ghost(part(workspace, "RainEmitter", Vector3.new(400, 1, 400), CFrame.new(0, 150, 0), C.white))
	local rain = Instance.new("ParticleEmitter")
	rain.Enabled, rain.Rate = false, 0
	rain.EmissionDirection = Enum.NormalId.Bottom
	rain.Speed, rain.Lifetime = NumberRange.new(80, 95), NumberRange.new(2, 2.4)
	rain.Size, rain.Squash = NumberSequence.new(0.12), NumberSequence.new(2.5)
	rain.Orientation = Enum.ParticleOrientation.VelocityParallel
	rain.Color, rain.Transparency = ColorSequence.new(Color3.fromRGB(200, 212, 228)), NumberSequence.new(0.35)
	rain.WindAffectsDrag, rain.Drag = true, 0.6
	rain.Parent = rainPart

	ghost(part(workspace, "GatorSpot", Vector3.new(4, 1, 4), gatorSpot, C.green)) -- the gator scenario's gator crawls forward from here
	-- flood plane over the whole site, hidden under the ground until WeatherFx raises it
	local flood = ghost(part(workspace, "FloodWater", Vector3.new(1400, 0.4, 1400), CFrame.new(100, -1.2, 0), Color3.fromRGB(62, 76, 50), Enum.Material.Glass))
	flood.Reflectance = 0.08
end

local function lighting()
	pcall(function() Lighting.Technology = Enum.Technology.Future end)
	Lighting.GlobalShadows, Lighting.ShadowSoftness = true, 0.2
	Lighting.Ambient = Color3.fromRGB(38, 40, 46)
	Lighting.EnvironmentDiffuseScale, Lighting.EnvironmentSpecularScale = 1, 1
	Lighting.GeographicLatitude = 29
	ensure(Lighting, "Sky", "Sky")
	local bloom = ensure(Lighting, "BloomEffect", "Bloom")
	bloom.Intensity, bloom.Size, bloom.Threshold = 0.5, 28, 1.4
	local rays = ensure(Lighting, "SunRaysEffect", "SunRays")
	rays.Intensity, rays.Spread = 0.05, 0.7
	WeatherFx.reset()
end

---------------------------------------------------------------- build

---------------------------------------------------------------- the jobsite from the challenge brief

-- a blocky hi-vis crew member, pivot at the torso, feet 3 studs below it
local function workerModel(parent, cf)
	local m = model(parent, "Worker")
	local function w(n, size, off, color)
		return nonCollide(part(m, n, size, cf * off, color))
	end
	m.PrimaryPart = w("Torso", Vector3.new(2, 2, 1), CFrame.new(), C.orange)
	w("Stripe", Vector3.new(2.05, 0.25, 1.05), CFrame.new(0, 0.2, 0), C.white)
	w("Head", Vector3.new(1.1, 1.1, 1.1), CFrame.new(0, 1.6, 0), Color3.fromRGB(176, 124, 92))
	w("HardHat", Vector3.new(1.4, 0.45, 1.4), CFrame.new(0, 2.3, 0), C.yellow)
	w("LegL", Vector3.new(0.9, 2, 1), CFrame.new(-0.5, -2, 0), C.navy)
	w("LegR", Vector3.new(0.9, 2, 1), CFrame.new(0.5, -2, 0), C.navy)
	w("ArmL", Vector3.new(0.6, 1.9, 0.8), CFrame.new(-1.3, 0, 0), C.orange)
	w("ArmR", Vector3.new(0.6, 1.9, 0.8), CFrame.new(1.3, 0, 0), C.orange)
	return m
end

-- timber crane mats laid across the marsh, the temporary road the brief describes
local function mats(parent, x0, x1, z, width)
	for x = x0, x1, 4.2 do
		part(parent, "Mat", Vector3.new(4, 0.6, width), CFrame.new(x, -0.3, z) * CFrame.Angles(0, 0, math.rad(rng:NextNumber(-0.8, 0.8))),
			C.matWood, Enum.Material.WoodPlanks)
	end
end

-- an H-frame transmission structure; returns the three conductor attachments
local function hframe(parent, x, z)
	for _, dx in ipairs({ -5, 5 }) do
		column(parent, "TxPole", 50, 1.6, Vector3.new(x + dx, -6, z), C.wood, Enum.Material.Wood)
	end
	local arm = part(parent, "TxArm", Vector3.new(18, 1, 1.2), CFrame.new(x, 40, z), C.wood, Enum.Material.Wood)
	strut(parent, "TxBrace", Vector3.new(x - 5, 28, z), Vector3.new(x + 5, 38, z), 0.5, C.wood)
	strut(parent, "TxBrace", Vector3.new(x + 5, 28, z), Vector3.new(x - 5, 38, z), 0.5, C.wood)
	local atts = {}
	for _, dx in ipairs({ -7, 0, 7 }) do
		part(parent, "Insulator", Vector3.new(0.5, 2.6, 0.5), CFrame.new(x + dx, 38.2, z), C.white, Enum.Material.Glass)
		local a = Instance.new("Attachment")
		a.CFrame = CFrame.new(dx, -3.3, 0) * CFrame.Angles(0, 0, math.rad(-90)) -- X points down so the conductors sag
		a.Parent = arm
		table.insert(atts, a)
	end
	return atts
end

-- the new line the crew is building: finished spans strung, the newest structures still bare
local function transmissionLine(parent, z, xs, strung)
	local prev
	for i, x in ipairs(xs) do
		local atts = hframe(parent, x, z)
		if prev and i <= strung then
			for k = 1, 3 do
				local w = Instance.new("Beam")
				w.Attachment0, w.Attachment1 = prev[k], atts[k]
				w.CurveSize0, w.CurveSize1 = 10, -10
				w.Width0, w.Width1, w.Segments = 0.22, 0.22, 20
				w.Color = ColorSequence.new(C.dark)
				w.FaceCamera = true
				w.Parent = atts[k].Parent
			end
		end
		prev = atts
	end
end

local function crewTruck(parent, cf)
	local m = model(parent, "CrewTruck")
	for _, x in ipairs({ -2.6, 2.6 }) do
		for _, z in ipairs({ -3.2, 3.2 }) do
			part(m, "Wheel", Vector3.new(1, 2.4, 2.4), cf * CFrame.new(x, 1.2, z), C.tire, nil, Enum.PartType.Cylinder)
		end
	end
	m.PrimaryPart = part(m, "Body", Vector3.new(5, 1.6, 10), cf * CFrame.new(0, 2.4, 0), C.white)
	part(m, "Cab", Vector3.new(5, 2.2, 4.4), cf * CFrame.new(0, 4.3, -1.2), C.white)
	part(m, "Glass", Vector3.new(4.8, 1.2, 0.2), cf * CFrame.new(0, 4.6, -3.45), C.glass, Enum.Material.Glass)
	part(m, "Stripe", Vector3.new(5.05, 0.3, 10.05), cf * CFrame.new(0, 2.6, 0), C.orange)
	m:SetAttribute("SinksInMud", true)
	return m
end

-- mud spray for a vehicle bogged in the muck, switched on by Crew.server.lua
local function mudSpray(p)
	local e = Instance.new("ParticleEmitter")
	e.Name, e.Enabled, e.Rate = "Mud", false, 30
	e.Speed, e.Lifetime = NumberRange.new(6, 10), NumberRange.new(0.6, 1)
	e.SpreadAngle = Vector2.new(30, 30)
	e.Acceleration = Vector3.new(0, -40, 0)
	e.Size = NumberSequence.new(0.35)
	e.Color = ColorSequence.new(C.mud)
	e.Parent = p
end

local function coolingTent(parent, cf)
	for _, x in ipairs({ -4.5, 4.5 }) do
		for _, z in ipairs({ -4.5, 4.5 }) do
			column(parent, "TentPole", 7, 0.3, (cf * CFrame.new(x, 0, z)).Position, C.steel, Enum.Material.Metal)
		end
	end
	part(parent, "Canopy", Vector3.new(10, 0.3, 10), cf * CFrame.new(0, 7, 0), C.canopy, Enum.Material.Fabric)
	part(parent, "Valance", Vector3.new(10.1, 0.8, 10.1), cf * CFrame.new(0, 6.5, 0), C.canopy, Enum.Material.Fabric).Transparency = 0.2
	column(parent, "WaterCooler", 1.4, 1.1, (cf * CFrame.new(3, 0.9, 3)).Position, C.orange)
	part(parent, "CoolerTable", Vector3.new(3, 0.3, 2), cf * CFrame.new(3, 0.75, 3), C.white)
	part(parent, "Bench", Vector3.new(6, 0.4, 1.2), cf * CFrame.new(-1, 1, -2.5), C.steel, Enum.Material.Metal)
end

-- the site conditions board, the one combined risk picture standing on the jobsite. Conditions.server.lua writes it.
local function conditionsBoard(cf, name)
	local b = part(workspace, name or "ConditionsBoard", Vector3.new(18, 10.5, 0.4), cf * CFrame.new(0, 10, 0), C.panel)
	for _, x in ipairs({ -7, 7 }) do
		column(workspace.Site, "BoardPost", 14, 0.5, (cf * CFrame.new(x, 0, -0.35)).Position, C.steel, Enum.Material.Metal)
	end
	local g = surface(b, 36)
	local title = label(g, "Title", "SITE CONDITIONS", UDim2.fromScale(0.94, 0.1), UDim2.fromScale(0.03, 0.025), C.safety)
	title.TextXAlignment = Enum.TextXAlignment.Left
	-- the go/no-go call, a colored banner under the title
	local decision = label(g, "Decision", "GO", UDim2.fromScale(0.94, 0.12), UDim2.fromScale(0.03, 0.14), C.white, Enum.Font.GothamBold, Color3.fromRGB(26, 110, 60))
	local dpad = Instance.new("UIPadding")
	dpad.PaddingLeft = UDim.new(0.015, 0)
	dpad.Parent = decision
	decision.TextXAlignment = Enum.TextXAlignment.Left
	for i = 1, 6 do
		local row = label(g, "Row" .. i, "", UDim2.fromScale(0.94, 0.1), UDim2.fromScale(0.03, 0.3 + (i - 1) * 0.115), C.white, Enum.Font.GothamMedium)
		row.TextXAlignment = Enum.TextXAlignment.Left
	end
	return b
end

-- camera shots for demo mode: an invisible part per shot, the part's CFrame is where the camera sits and looks
local function shots(list, name)
	local f = Instance.new("Folder")
	f.Name = name or "Shots"
	f.Parent = workspace.Site
	for name, s in pairs(list) do
		ghost(part(f, name, Vector3.new(1, 1, 1), CFrame.lookAt(s[1], s[2]), C.white))
	end
end

-- the brief's jobsite fitted beside the boardwalk: a mat road from the truck end toward the new line,
-- a laydown pad with the crew truck and the cooling tent, the excavator and mat truck at the work face,
-- the crew at work, and the transmission line they are building south of the road
local function jobsite(site)
	local crew = Instance.new("Folder")
	crew.Name = "Crew"
	crew.Parent = site
	mats(site, -262, -40, -24, 12) -- the road
	mats(site, -134, -72, -36, 14) -- the laydown pad
	transmissionLine(site, -70, { -280, -160, -40, 80, 200 }, 3)
	excavator(CFrame.new(-46, 0, -24) * CFrame.Angles(0, math.rad(-90), 0)) -- boom out over the marsh, facing east
	local matTruck = model(site, "MatTruck")
	truck(matTruck, CFrame.new(-150, 0, -24) * CFrame.Angles(0, math.rad(-90), 0))
	matTruck.PrimaryPart = matTruck:FindFirstChild("Chassis")
	matTruck:SetAttribute("SinksInMud", true)
	for _, p in ipairs(matTruck:GetChildren()) do if p.Name == "Wheel" then mudSpray(p) end end
	local pickup = crewTruck(site, CFrame.new(-115, 0, -38) * CFrame.Angles(0, math.rad(-90), 0))
	for _, p in ipairs(pickup:GetChildren()) do if p.Name == "Wheel" then mudSpray(p) end end
	coolingTent(site, CFrame.new(-86, 0, -38))
	-- where the crew goes: into the truck on stop work, under the tent in the heat (pivot height, 3 studs over the mats)
	ghost(part(crew, "ShelterSpot", Vector3.new(1, 1, 1), CFrame.new(-115, 3, -38), C.white))
	ghost(part(crew, "ShadeSpot", Vector3.new(1, 1, 1), CFrame.new(-86, 3, -38), C.white))
	ghost(part(crew, "TailboardSpot", Vector3.new(1, 1, 1), CFrame.lookAt(Vector3.new(-75, 3, -19), Vector3.new(-75, 3, -8)), C.white))
	for _, p in ipairs({ { -58, -20 }, { -61, -28 }, { -67, -22 }, { -54, -29 } }) do
		workerModel(crew, CFrame.new(p[1], 3, p[2]) * CFrame.Angles(0, math.rad(rng:NextNumber(60, 120)), 0))
	end
end

-- The second setting: a Mississippi River crossing 2600 studs east of the main site. A levee 4 studs high between
-- the river and the work pad, a substation, the new transmission line crossing the river, a river gauge, its own
-- conditions board, and a beacon light that mirrors the main beacon. Flood water is two planes: the river side
-- rises first, the land side only floods once the river tops the levee. It is a sim setting only; the contract's
-- site 12 beacon, zone, and muster stay at the main site.
local RIVER = Vector3.new(2600, 0, 0)
local function riverSite()
	local R = RIVER
	local f = Instance.new("Folder")
	f.Name = "RiverSite"
	f.Parent = workspace.Site
	local T = workspace.Terrain
	T:FillBlock(CFrame.new(R + Vector3.new(0, -8, 0)), Vector3.new(1000, 16, 1000), Enum.Material.Grass)
	T:FillBlock(CFrame.new(R + Vector3.new(180, -4, 0)), Vector3.new(160, 8, 1000), Enum.Material.Air)
	T:FillBlock(CFrame.new(R + Vector3.new(180, -5.5, 0)), Vector3.new(160, 5, 1000), Enum.Material.Water) -- surface at -3
	T:FillBlock(CFrame.new(R + Vector3.new(97, -4, 0)), Vector3.new(10, 8, 1000), Enum.Material.Mud)
	T:FillBlock(CFrame.new(R + Vector3.new(80, 2, 0)), Vector3.new(20, 4, 1000), Enum.Material.Grass) -- the levee, top at 4
	T:FillBlock(CFrame.new(R + Vector3.new(-40, -8, 10)), Vector3.new(110, 16.1, 90), Enum.Material.Ground) -- the work pad

	-- substation: three transformers on a slab inside a fence
	local sub = R + Vector3.new(-130, 0, -80)
	part(f, "SubSlab", Vector3.new(44, 0.6, 22), CFrame.new(sub + Vector3.new(10, 0.3, 0)), C.concrete, Enum.Material.Concrete)
	for i = 0, 2 do
		local p = sub + Vector3.new(i * 10, 0, 0)
		part(f, "Transformer", Vector3.new(6, 6, 5), CFrame.new(p + Vector3.new(0, 3.6, 0)), Color3.fromRGB(110, 118, 110), Enum.Material.Metal)
		for _, dx in ipairs({ -1.8, 0, 1.8 }) do
			part(f, "Bushing", Vector3.new(0.6, 2.4, 0.6), CFrame.new(p + Vector3.new(dx, 7.8, 0)), C.white, Enum.Material.Glass)
		end
	end
	for _, side in ipairs({ { 10, -11, 44, 0 }, { 10, 11, 44, 0 }, { -12, 0, 22, 90 }, { 32, 0, 22, 90 } }) do
		local fence = part(f, "Fence", Vector3.new(side[3], 5, 0.15), CFrame.new(sub + Vector3.new(side[1], 2.5, side[2])) * CFrame.Angles(0, math.rad(side[4]), 0), C.steel, Enum.Material.DiamondPlate)
		fence.Transparency = 0.55
	end

	-- the new line crossing the river, strung from the substation side to the far bank
	transmissionLine(f, R.Z + 90, { R.X - 150, R.X + 20, R.X + 340 }, 3)

	-- crew equipment on the pad: a mat truck and the crew truck, parked
	local matTruck = model(f, "RiverMatTruck")
	truck(matTruck, CFrame.new(R + Vector3.new(-60, 0, 30)) * CFrame.Angles(0, math.rad(-90), 0))
	crewTruck(f, CFrame.new(R + Vector3.new(-30, 0, 45)) * CFrame.Angles(0, math.rad(-90), 0)):SetAttribute("SinksInMud", nil)

	-- a beacon light on its own post, mirroring the main beacon's state
	local rb = model(workspace, "RiverBeacon")
	rb.PrimaryPart = part(rb, "Post", Vector3.new(0.7, 9, 0.7), CFrame.new(R + Vector3.new(-10, 4.5, 10)), C.steel, Enum.Material.Metal)
	part(rb, "Head", Vector3.new(2.4, 1.6, 1.2), CFrame.new(R + Vector3.new(-10, 8.6, 10)), C.safety)
	local light = part(rb, "Light", Vector3.new(1.6, 1.6, 1.6), CFrame.new(R + Vector3.new(-10, 10.2, 10)), C.green, Enum.Material.Neon, Enum.PartType.Ball)
	local glow = Instance.new("PointLight")
	glow.Name, glow.Range, glow.Brightness, glow.Color = "Glow", 20, 3, C.green
	glow.Parent = light
	local tag = Instance.new("BillboardGui")
	tag.Name, tag.Size, tag.StudsOffset = "LevelTag", UDim2.fromOffset(240, 64), Vector3.new(0, 2.6, 0)
	tag.MaxDistance, tag.LightInfluence = 300, 0
	tag.Parent = light
	label(tag, "Level", "ALL CLEAR", UDim2.fromScale(1, 0.62), UDim2.new(), C.green)
	label(tag, "Sub", "HAZARD INDEX 0", UDim2.fromScale(1, 0.38), UDim2.fromScale(0, 0.62), C.white, Enum.Font.GothamMedium)

	floodGauge(f, R.X + 64, R.Z + 20)
	conditionsBoard(CFrame.new(R + Vector3.new(-60, 0, 20)), "ConditionsBoardRiver")
	local sp = ghost(part(f, "RiverSpawn", Vector3.new(4, 1, 4), CFrame.lookAt(R + Vector3.new(-40, 3, 70), R + Vector3.new(100, 3, 20)), C.white))
	sp.Name = "RiverSpawn"

	-- river side rises first, land side floods only past the levee top (WeatherFx drives both)
	local riverFlood = ghost(part(workspace, "RiverFloodWater", Vector3.new(410, 0.4, 1000), CFrame.new(R + Vector3.new(295, -3.4, 0)), Color3.fromRGB(96, 84, 60), Enum.Material.Glass))
	riverFlood.Reflectance = 0.05
	local landFlood = ghost(part(workspace, "LandFloodWater", Vector3.new(570, 0.4, 1000), CFrame.new(R + Vector3.new(-215, -1.2, 0)), Color3.fromRGB(96, 84, 60), Enum.Material.Glass))
	landFlood.Reflectance = 0.05

	shots({
		Wide = { R + Vector3.new(-160, 70, 160), R + Vector3.new(40, 0, 0) },
		Levee = { R + Vector3.new(40, 9, 60), R + Vector3.new(140, 0, 0) },
		Beacon = { R + Vector3.new(-26, 12, 26), R + Vector3.new(-10, 9, 10) },
		Board = { R + Vector3.new(-60, 9, 44), R + Vector3.new(-60, 8, 20) },
	}, "ShotsRiver")
end

-- The boardwalk swamp (workspace.PlanITSite, a hand made scene): deck top 4.4, open water everywhere at -0.6,
-- a 28 x 24 research platform at the origin, the boardwalk running west to the truck at x -300.
-- Our beacon stands on the platform facing the boardwalk, the work zone is around the platform, crews spawn
-- out on the boardwalk and walk in, gators swim beside the walkway. Its own beacon, rain, and scripts are retired.
local DECK_Y = 4.4
local function adopt(scene, site)
	for _, n in ipairs({ "Beacon", "RainSheet", "Bolts" }) do
		local x = scene:FindFirstChild(n)
		if x then x:Destroy() end
	end
	local spawn = scene:FindFirstChildOfClass("SpawnLocation")
	if spawn then
		spawn.CFrame = CFrame.new(-90, DECK_Y + 0.15, 0) * CFrame.Angles(0, math.rad(-90), 0) -- facing east, toward the platform
	end
	-- its lily pads and boat ride our flood, its egrets flush with our storm
	for _, n in ipairs({ "Pads" }) do
		local f = scene:FindFirstChild(n)
		if f then for _, c in ipairs(f:GetChildren()) do c.Parent = floating end end
	end
	local boat = scene:FindFirstChild("Boat")
	if boat then boat.Parent = floating end
	local birds = scene:FindFirstChild("Birds")
	if birds then
		for _, b in ipairs(birds:GetChildren()) do
			b.Name = "Egret"
			b.Parent = site.Wildlife
		end
	end
end

function Builder.build()
	rng = Random.new(42)
	for _, child in ipairs(workspace:GetChildren()) do
		if table.find(OWNED, child.Name) and not child:IsA("Terrain") and not child:IsA("Camera") then
			child:Destroy()
		end
	end
	local site = Instance.new("Folder")
	site.Name = "Site"
	site.Parent = workspace
	floating = Instance.new("Folder")
	floating.Name = "Floating"
	floating.Parent = site
	local scene = workspace:FindFirstChild("PlanITSite")

	plumbing()
	beacon()
	zone()
	if scene then
		-- the beacon pivots on its post, whose center is 5 studs up
		workspace.Beacon:PivotTo(CFrame.new(-6, DECK_Y, -6) * CFrame.Angles(0, math.rad(-90), 0) * CFrame.new(0, 5, 0)) -- faces west, down the boardwalk
		jobsite(site)
		wildlife(site, {
			swims = { { 40, -60, 30, 3.2 }, { -100, 50, 25, 2.6 }, { 120, 80, 40, 3.6 }, { -200, -60, 30, 2.2 } },
			basks = { { -70, WATER_Y - 0.4, -12, 90 }, { 30, WATER_Y - 0.4, 22, 300 } }, -- lurking by the walkway
		})
		adopt(scene, site)
		billboard(site, CFrame.new(-50, 0, 9) * CFrame.Angles(0, math.pi, 0))
		conditionsBoard(CFrame.new(-75, -1, -8))
		shots({
			Wide = { Vector3.new(-170, 70, 120), Vector3.new(-60, 0, -20) },
			Road = { Vector3.new(-125, 14, 10), Vector3.new(-60, 2, -26) },
			Gator = { Vector3.new(-82, 9, -6), Vector3.new(-100, 1, -24) },
			Tent = { Vector3.new(-70, 10, -18), Vector3.new(-86, 3, -38) },
			Storm = { Vector3.new(-20, 30, 40), Vector3.new(-600, 120, -60) },
			Beacon = { Vector3.new(-22, 12, 4), Vector3.new(-6, 9, -6) },
			Flood = { Vector3.new(40, 9, 20), Vector3.new(0, 3, -6) },
			Board = { Vector3.new(-75, 9, 16), Vector3.new(-75, 8, -8) },
		})
		markers(CFrame.lookAt(Vector3.new(-100, 1, -24), Vector3.new(0, 1, -24)), false) -- the gator walks the mat road toward the crew
	else
		terrain()
		excavator(CFrame.new(-16, 0, -12) * CFrame.Angles(0, math.rad(30), 0))
		truck(site, CFrame.new(24, 0, 46))
		for _, x in ipairs({ -22, -15, 15, 22 }) do
			barrier(site, CFrame.new(x, 0, 31.5))
		end
		trailer(site, CFrame.new(42, 0, 95))
		powerLine(site)
		trees(site)
		marsh(site)
		dock(site)
		local swims = {}
		for _, s in ipairs({ { 1, 0.55, 3.2 }, { 2, 0.6, 2.6 }, { 4, 0.5, 3.6 }, { 2, 0.3, 2.2 } }) do -- pond, radius fraction, speed
			local c, r = SWAMP[s[1]][1], SWAMP[s[1]][2] * s[2]
			table.insert(swims, { c.X, c.Z, r, s[3] })
		end
		wildlife(site, { swims = swims, basks = { { 72, 1, -20, 63 }, { 100, 1, 140, 98 } }, egrets = true }) -- one bask in sight of the spawn
		floodGauge(site, 37, 37)
		billboard(site, CFrame.new(-28, 0, 70))
		conditionsBoard(CFrame.new(30, 0, 70))
		shots({
			Wide = { Vector3.new(0, 70, 190), Vector3.new(0, 0, 0) },
			Road = { Vector3.new(-50, 14, 60), Vector3.new(-16, 2, -12) },
			Gator = { Vector3.new(90, 9, 50), Vector3.new(66, 1, 30) },
			Tent = { Vector3.new(30, 12, 110), Vector3.new(30, 8, 70) },
			Storm = { Vector3.new(30, 30, 60), Vector3.new(-600, 120, 0) },
			Beacon = { Vector3.new(0, 12, 22), Vector3.new(0, 9, 0) },
			Flood = { Vector3.new(60, 10, 60), Vector3.new(0, 1, 0) },
			Board = { Vector3.new(30, 9, 92), Vector3.new(30, 8, 70) },
		})
		markers(CFrame.lookAt(Vector3.new(66, 1, 30), Vector3.new(0, 1, 30)), true) -- gator crawls toward the zone
	end
	riverSite()
	workspace:SetAttribute("ActiveSite", "everglades")
	lighting()
	print("[SceneBuilder] site built" .. (scene and " into the boardwalk swamp" or "") .. ". File > Save, then publish.")
end

return Builder
