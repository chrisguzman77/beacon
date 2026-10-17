-- Wildlife (Script in ServerScriptService/World)
-- Gators swim slow loops and bask, egrets flush when the storm or the flood arrives, the gator scenario's gator
-- crawls toward the zone, and everything that floats (pads, logs, the boat, the gators) rides the rising water.
local RunService = game:GetService("RunService")

local site = workspace:WaitForChild("Site")
local wild = site:WaitForChild("Wildlife")
local beacon = workspace:WaitForChild("Beacon")

local swimmers, baskers, birds = {}, {}, {}
for _, m in ipairs(wild:GetChildren()) do
	if m.Name == "SwampGator" then
		if m:GetAttribute("Bask") then
			table.insert(baskers, { m = m, base = m:GetPivot() })
		else
			table.insert(swimmers, { m = m, a = m:GetAttribute("Phase") or 0 })
		end
	elseif m.Name == "Egret" then
		table.insert(birds, { m = m, home = m:GetPivot(), f = 0, dir = m:GetAttribute("Dir") or 0 })
	end
end

local WATER_Y = -0.5
local floats = {}
local floatFolder = site:FindFirstChild("Floating")
if floatFolder then
	for _, f in ipairs(floatFolder:GetChildren()) do
		table.insert(floats, { f = f, base = f:GetPivot() })
	end
end
local surface, applied = WATER_Y, WATER_Y

local crawled = setmetatable({}, { __mode = "k" })
local CRAWL_STUDS, CRAWL_SPEED = 16, 0.8

local t = 0
RunService.Heartbeat:Connect(function(dt)
	t += dt
	-- the water surface eases toward WeatherFx's target over about the same 8 s the flood plane tweens
	local target = workspace:GetAttribute("WaterSurface") or WATER_Y
	surface += (target - surface) * math.min(1, dt * 0.45)
	local rise = surface - WATER_Y
	if math.abs(surface - applied) > 0.02 then
		applied = surface
		for _, x in ipairs(floats) do
			x.f:PivotTo(x.base + Vector3.new(0, rise, 0))
		end
	end
	for _, s in ipairs(swimmers) do
		local m = s.m
		local r = m:GetAttribute("R")
		s.a += dt * m:GetAttribute("Speed") / r
		local pos = Vector3.new(
			m:GetAttribute("CX") + math.cos(s.a) * r,
			m:GetAttribute("Y") + rise + math.sin(t * 0.8 + s.a) * 0.05,
			m:GetAttribute("CZ") + math.sin(s.a) * r)
		local ahead = pos + Vector3.new(-math.sin(s.a), 0, math.cos(s.a))
		-- a slow side to side sway, the way a swimming gator sculls with its tail
		m:PivotTo(CFrame.lookAt(pos, ahead) * CFrame.Angles(0, math.sin(t * 1.6 + s.a) * 0.12, 0))
	end

	for _, b in ipairs(baskers) do
		-- breathing, and once the flood is over the bank the gator floats off it
		local lift = math.max(0, surface - 0.6 - b.base.Y)
		b.m:PivotTo(b.base * CFrame.new(0, lift + math.sin(t * 0.5) * 0.03, 0))
	end

	local storm = (workspace:GetAttribute("Storm") or 0) > 0.6 or beacon:GetAttribute("Led") == "strobe" or rise > 0.8
	local k = math.min(1, dt * 0.35)
	for _, b in ipairs(birds) do
		b.f += ((storm and 1 or 0) - b.f) * k
		local away = Vector3.new(math.cos(b.dir), 0, math.sin(b.dir)) * b.f * 260
		b.m:PivotTo(b.home + away + Vector3.new(0, b.f * 80, 0))
	end

	local g = workspace:FindFirstChild("Gator")
	if g then
		local done = crawled[g] or 0
		if done < CRAWL_STUDS then
			local step = math.min(dt * CRAWL_SPEED, CRAWL_STUDS - done)
			crawled[g] = done + step
			g:PivotTo(g:GetPivot() * CFrame.new(0, 0, -step))
		end
	end
end)
