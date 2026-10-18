-- Lightning (ModuleScript)
local Debris = game:GetService("Debris")
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local events = ReplicatedStorage:WaitForChild("SimEvents")
local flashEvent = ReplicatedStorage:WaitForChild("FlashEvent")
local strikeRadar = ReplicatedStorage:WaitForChild("StrikeRadar")

local Lightning = {}
Lightning.STUDS_PER_MILE = 120 -- a 15 mile bolt lands 1800 studs out, near enough to see through the haze
local CLOUD_HEIGHT = 900
local BOLT_COLOR = Color3.fromRGB(225, 235, 255)
local BASE_EXPOSURE = Lighting.ExposureCompensation
local rng = Random.new()

-- strikes are measured from the active setting's beacon: the main site, or the river crossing
local function origin()
	local river = workspace:FindFirstChild("RiverBeacon")
	if workspace:GetAttribute("ActiveSite") == "river" and river then
		return river:GetPivot().Position
	end
	return workspace.Beacon:GetPivot().Position
end

-- bearing 0 is north (negative Z), 90 is east (positive X)
function Lightning.groundPoint(bearing, miles)
	local o = origin()
	local r = miles * Lightning.STUDS_PER_MILE
	local x = o.X + math.sin(math.rad(bearing)) * r
	local z = o.Z - math.cos(math.rad(bearing)) * r
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { workspace.Beacon, workspace:FindFirstChild("RiverBeacon") }
	local hit = workspace:Raycast(Vector3.new(x, 2000, z), Vector3.new(0, -4000, 0), params)
	return hit and hit.Position or Vector3.new(x, 0, z)
end

function Lightning.fromPosition(pos)
	local o = origin()
	local dx, dz = pos.X - o.X, pos.Z - o.Z
	local miles = math.sqrt(dx * dx + dz * dz) / Lightning.STUDS_PER_MILE
	local bearing = (math.deg(math.atan2(dx, -dz)) + 360) % 360
	return bearing, miles
end

local function segment(a, b, width, parts)
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.Neon
	p.Color = BOLT_COLOR
	p.Size = Vector3.new(width, width, (b - a).Magnitude)
	p.CFrame = CFrame.lookAt((a + b) / 2, b)
	p.Name = "Bolt"
	p.Parent = workspace
	table.insert(parts, p)
end

-- jagged channel from a to b that thins toward b
local function channel(a, b, width, steps, jitter, parts)
	local points = { a }
	for i = 1, steps - 1 do
		local base = a:Lerp(b, i / steps)
		table.insert(points, base + Vector3.new(rng:NextNumber(-jitter, jitter), 0, rng:NextNumber(-jitter, jitter)))
	end
	table.insert(points, b)
	for i = 1, #points - 1 do
		segment(points[i], points[i + 1], width * (1 - 0.4 * i / #points), parts)
	end
	return points
end

function Lightning.strike(bearing, miles)
	local ground = Lightning.groundPoint(bearing, miles)
	local top = Vector3.new(ground.X, CLOUD_HEIGHT, ground.Z)
	local width = math.max(3, miles * 0.8)
	local parts = {}

	-- 1. draw the bolt, a main channel and two thinner branches
	local main = channel(top, ground, width, rng:NextInteger(7, 9), 70, parts)
	local impact = parts[#main - 1]
	for _ = 1, 2 do
		local from = main[rng:NextInteger(2, #main - 2)]
		local drop = (from.Y - ground.Y) * rng:NextNumber(0.25, 0.45)
		local to = from + Vector3.new(rng:NextNumber(-160, 160), -drop, rng:NextNumber(-160, 160))
		channel(from, to, width * 0.45, 3, 40, parts)
	end
	local light = Instance.new("PointLight")
	light.Brightness, light.Range, light.Color = 20, 60, BOLT_COLOR
	light.Parent = impact
	-- the sky lights up like the screen flash: 1/d^2, full at 3 mi or closer, never under 0.15
	Lighting.ExposureCompensation = BASE_EXPOSURE + 1.5 * math.max(0.15, math.min(1, 9 / (miles * miles)))

	-- 2. physical path: every client flashes (brightness by distance) and schedules thunder (delay by distance and air temperature)
	flashEvent:FireAllClients(miles)
	strikeRadar:FireAllClients(bearing, miles)

	-- 3. data path: the Bridge posts the strike
	events.Strike:Fire(bearing, miles)

	-- a return stroke flickers once, then the channel fades. Nothing here yields.
	local function setAll(t)
		for _, p in ipairs(parts) do p.Transparency = t end
	end
	task.delay(0.05, setAll, 1)
	task.delay(0.09, setAll, 0)
	task.delay(0.14, function()
		Lighting.ExposureCompensation = BASE_EXPOSURE
		for _, p in ipairs(parts) do
			TweenService:Create(p, TweenInfo.new(0.35), { Transparency = 1 }):Play()
			Debris:AddItem(p, 0.4)
		end
	end)
	print(("[Lightning] strike bearing %.1f miles %.2f"):format(bearing, miles))
end

return Lightning
