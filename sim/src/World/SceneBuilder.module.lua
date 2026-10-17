-- SceneBuilder (ModuleScript in ServerScriptService/World)
-- Builds the whole jobsite from code: terrain, lighting, the beacon, the work zone, equipment,
-- poles, trees, and every instance the World scripts look up by name (simulator guide 2.2).
-- Run it once in edit mode from the Command Bar, then save and publish:
--   require(game.ServerScriptService.World.SceneBuilder).build()
-- Re-running wipes the terrain and everything named in OWNED, then rebuilds it the same way.
-- Nothing is uploaded; every part is a plain Part.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local WeatherFx = require(script.Parent.WeatherFx)

local Builder = {}

local OWNED = { "Site", "Beacon", "ZonePart", "SiteBillboard", "Excavator", "RainEmitter", "GatorSpot", "FloodWater", "SpawnLocation", "Baseplate" }
local SITE_NAME = "CRYSTAL RIVER"
local ZONE = 60 -- work zone is ZONE x ZONE studs, centered on the beacon at the origin
local SLOUGH = { { Vector3.new(240, 0, -70), 70 }, { Vector3.new(300, 0, 30), 85 }, { Vector3.new(270, 0, 140), 60 } }

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
}

local rng

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
	for _, n in ipairs({ "FlashEvent", "ScenarioControl", "ScenarioState", "StrikeHere" }) do
		ensure(ReplicatedStorage, "RemoteEvent", n)
	end
	local thunder = ensure(ReplicatedStorage, "Sound", "Thunder")
	if thunder.SoundId == "" then
		warn("[SceneBuilder] set ReplicatedStorage.Thunder.SoundId from a Toolbox thunder clip")
	end
end

local function terrain()
	local T = workspace.Terrain
	T:Clear()
	T:FillBlock(CFrame.new(0, -8, 0), Vector3.new(2048, 16, 2048), Enum.Material.Grass)
	T:FillBlock(CFrame.new(0, -8, 0), Vector3.new(112, 16, 112), Enum.Material.Ground) -- work pad
	T:FillBlock(CFrame.new(0, -8, 520), Vector3.new(28, 16, 930), Enum.Material.Mud) -- access road
	for _, s in ipairs(SLOUGH) do
		local c, r = s[1], s[2]
		T:FillCylinder(CFrame.new(c.X, -8, c.Z), 16, r + 14, Enum.Material.Mud) -- muddy bank
		T:FillCylinder(CFrame.new(c.X, -3, c.Z), 6, r, Enum.Material.Air)
		T:FillCylinder(CFrame.new(c.X, -3.5, c.Z), 5, r, Enum.Material.Water)
	end
	T.WaterColor = Color3.fromRGB(58, 78, 52)
	T.WaterTransparency, T.WaterReflectance = 0.55, 0.4
	T.WaterWaveSize, T.WaterWaveSpeed = 0.04, 4
	T:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(96, 128, 64))
	T:SetMaterialColor(Enum.Material.Ground, Color3.fromRGB(132, 116, 88))
	T:SetMaterialColor(Enum.Material.Mud, Color3.fromRGB(92, 74, 56))
end

local function beacon()
	local m = model(workspace, "Beacon")
	local base = part(m, "Base", Vector3.new(0.7, 10, 0.7), CFrame.new(0, 5, 0), C.steel, Enum.Material.Metal)
	m.PrimaryPart = base
	part(m, "Footing", Vector3.new(3, 0.6, 3), CFrame.new(0, 0.3, 0), C.concrete, Enum.Material.Concrete)
	part(m, "Head", Vector3.new(4.4, 3.6, 1.4), CFrame.new(0, 8.2, 0), C.safety)

	-- status light
	column(m, "LightBase", 0.5, 2, Vector3.new(0, 10, 0), C.dark)
	local light = part(m, "Light", Vector3.new(1.6, 1.6, 1.6), CFrame.new(0, 11.2, 0), C.green, Enum.Material.Neon, Enum.PartType.Ball)
	local glow = Instance.new("PointLight")
	glow.Name, glow.Range, glow.Brightness, glow.Color = "Glow", 20, 3, C.green
	glow.Parent = light

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
	floor.Transparency, floor.CanCollide, floor.CanQuery, floor.CastShadow = 0.82, false, false, false
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

local function cypress(parent, pos, h)
	column(parent, "Flare", 3, 3.2, pos - Vector3.new(0, 0.5, 0), C.bark, Enum.Material.Wood)
	column(parent, "Trunk", h, 1.5, pos, C.bark, Enum.Material.Wood)
	local leaf = C.leaves[rng:NextInteger(1, #C.leaves)]
	for i, r in ipairs({ 14, 11, 7 }) do
		local off = Vector3.new(rng:NextNumber(-1, 1), h - 7 + i * 2.6, rng:NextNumber(-1, 1))
		column(parent, "Canopy", 2.2, r * rng:NextNumber(0.85, 1.1), pos + off, leaf, Enum.Material.Grass)
	end
end

local function inSlough(x, z)
	for _, s in ipairs(SLOUGH) do
		if (Vector2.new(x, z) - Vector2.new(s[1].X, s[1].Z)).Magnitude < s[2] + 8 then return true end
	end
	return false
end

local function trees(parent)
	local placed = 0
	while placed < 22 do -- around the slough
		local x, z = rng:NextNumber(190, 420), rng:NextNumber(-200, 260)
		if not inSlough(x, z) then
			cypress(parent, Vector3.new(x, 0, z), rng:NextNumber(18, 30))
			placed += 1
		end
	end
	for _ = 1, 26 do -- tree line west and north of the site
		local west = rng:NextNumber() < 0.5
		local x = west and rng:NextNumber(-460, -180) or rng:NextNumber(-300, 160)
		local z = west and rng:NextNumber(-380, 380) or rng:NextNumber(-460, -200)
		cypress(parent, Vector3.new(x, 0, z), rng:NextNumber(20, 34))
	end
end

local function billboard(parent)
	local cf = CFrame.new(-28, 0, 70)
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

local function markers()
	local spawn = Instance.new("SpawnLocation")
	spawn.Name, spawn.Anchored, spawn.Neutral, spawn.Duration = "SpawnLocation", true, true, 0
	spawn.Size, spawn.CFrame = Vector3.new(10, 0.4, 10), CFrame.new(0, 0.2, 100) -- faces -Z, toward the zone
	spawn.Color, spawn.Material = C.concrete, Enum.Material.Concrete
	spawn.Parent = workspace

	local rainPart = ghost(part(workspace, "RainEmitter", Vector3.new(400, 1, 400), CFrame.new(0, 150, 0), C.white))
	local rain = Instance.new("ParticleEmitter")
	rain.Enabled, rain.Rate = false, 0
	rain.EmissionDirection = Enum.NormalId.Bottom
	rain.Speed, rain.Lifetime = NumberRange.new(80, 95), NumberRange.new(2, 2.4)
	rain.Size, rain.Squash = NumberSequence.new(0.12), NumberSequence.new(2.5)
	rain.Orientation = Enum.ParticleOrientation.VelocityParallel
	rain.Color, rain.Transparency = ColorSequence.new(Color3.fromRGB(200, 212, 228)), NumberSequence.new(0.35)
	rain.Parent = rainPart

	ghost(part(workspace, "GatorSpot", Vector3.new(4, 1, 4), CFrame.new(166, 0.5, -70) * CFrame.Angles(0, math.rad(-90), 0), C.green))
	ghost(part(workspace, "FloodWater", Vector3.new(110, 0.2, 150), CFrame.new(115, 0.1, 10), Color3.fromRGB(70, 98, 90), Enum.Material.Glass))
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

	plumbing()
	terrain()
	beacon()
	zone()
	excavator(CFrame.new(-16, 0, -12) * CFrame.Angles(0, math.rad(30), 0))
	truck(site, CFrame.new(24, 0, 46))
	for _, x in ipairs({ -22, -15, 15, 22 }) do
		barrier(site, CFrame.new(x, 0, 31.5))
	end
	trailer(site, CFrame.new(42, 0, 95))
	powerLine(site)
	trees(site)
	billboard(site)
	markers()
	lighting()
	print("[SceneBuilder] site built. File > Save, then publish.")
end

return Builder
