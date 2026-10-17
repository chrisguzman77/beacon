-- Crew (Script in ServerScriptService/World)
-- The jobsite crew acts on the decisions the platform makes. On a stop work they walk to the crew truck and get in.
-- When the heat index reaches 115 F they take their rest break under the cooling tent. Otherwise they work the mat road.
-- When the soil is saturated the trucks bog down in the muck and throw mud.
-- A stop work is the sim's own 30 minute rule (Conditions) or the real beacon's, mirrored onto workspace.Beacon.
local RunService = game:GetService("RunService")

local site = workspace:WaitForChild("Site")
local crew = site:FindFirstChild("Crew")
if not crew then return end -- the scene without the jobsite has no crew
local beacon = workspace:WaitForChild("Beacon")
local shelter = crew:WaitForChild("ShelterSpot").CFrame.Position
local shade = crew:WaitForChild("ShadeSpot").CFrame.Position

local WALK = 7 -- studs per second
local HEAT_DANGER, MUDDY = 115, 0.85

local workers = {}
for i, m in ipairs(crew:GetChildren()) do
	if m.Name == "Worker" then
		table.insert(workers, { m = m, home = m:GetPivot(), i = i, hidden = false })
	end
end

local sinkers = {}
for _, m in ipairs(site:GetChildren()) do
	if m:IsA("Model") and m:GetAttribute("SinksInMud") then
		local mud = {}
		for _, d in ipairs(m:GetDescendants()) do
			if d:IsA("ParticleEmitter") and d.Name == "Mud" then table.insert(mud, d) end
		end
		table.insert(sinkers, { m = m, base = m:GetPivot(), k = 0, mud = mud })
	end
end

local function setVisible(m, visible)
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") then p.Transparency = visible and 0 or 1 end
	end
end

local t = 0
RunService.Heartbeat:Connect(function(dt)
	t += dt
	local stop = workspace:GetAttribute("SimStopWork") == true
		or beacon:GetAttribute("Led") == "strobe" or beacon:GetAttribute("Interlock") == "locked"
	local hot = (workspace:GetAttribute("HeatIndexF") or 0) >= HEAT_DANGER

	for _, w in ipairs(workers) do
		local target
		if stop then
			target = shelter
		elseif hot then
			target = shade + Vector3.new((w.i % 2) * 3 - 1.5, 0, (w.i % 3) - 1)
		else
			target = w.home.Position
		end
		local pos = w.m:GetPivot().Position
		local flat = Vector3.new(target.X - pos.X, 0, target.Z - pos.Z)
		local dist = flat.Magnitude
		local arrived = dist < 0.6
		if not arrived then
			-- at 300x a stop work lasts seconds, so the crew hurries in step with the playback, up to 4x
			local hurry = math.clamp((workspace:GetAttribute("SimSpeed") or 1) / 60, 1, 4)
			local step = math.min(dist, dt * WALK * hurry)
			local nextPos = pos + flat.Unit * step
			w.m:PivotTo(CFrame.lookAt(nextPos, nextPos + flat.Unit) * CFrame.new(0, math.abs(math.sin(t * 9)) * 0.15, 0))
		elseif not stop and not hot then
			-- back at the work face: face it and keep busy
			w.m:PivotTo(w.home * CFrame.Angles(0, math.sin(t * 1.3 + w.i) * 0.25, 0))
		end
		local inside = stop and arrived
		if inside ~= w.hidden then
			w.hidden = inside
			setVisible(w.m, not inside)
		end
	end

	local muddy = (workspace:GetAttribute("Soil") or 0) >= MUDDY
	for _, s in ipairs(sinkers) do
		local goal = muddy and 1 or 0
		if s.k ~= goal then
			s.k = math.clamp(s.k + (goal - s.k) * math.min(1, dt * 0.25) + (goal > s.k and 0.001 or -0.001), 0, 1)
			-- sinks to the axles and lists to one side
			s.m:PivotTo(s.base * CFrame.new(0, -0.9 * s.k, 0) * CFrame.Angles(0, 0, math.rad(5) * s.k))
		end
		for _, e in ipairs(s.mud) do e.Enabled = muddy and not stop end -- wheels spin in the muck until the crew stops
	end
end)
