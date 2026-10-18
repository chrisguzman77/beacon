-- StormModel (ModuleScript)
-- A thunderstorm cell that walks across the site and produces every strike. No strike distance is typed by hand:
-- each one is where the model's cell happened to be when the model's clock said it fired.
--   frame      the site at the origin, miles; bearing 0 is north, clockwise, as in Lightning.groundPoint
--   motion     the cell starts start_mi out on from_bearing and moves toward the site at speed_mph, passing
--              cross_track_mi to the side at its closest. p(t) = p0 + v * t, t in simulated seconds
--   life       cloud-to-ground rate lambda(t) = peak_per_min * sin(pi * t / life), so the storm builds, peaks as
--              the cell passes the site (life = 2 * start_mi / speed_mph), and dies on the far side
--   timing     non-homogeneous Poisson by thinning: dt = -ln(U) / lambda_max, kept with probability lambda / lambda_max
--   placement  95% Rayleigh (sigma 1.5 mi) around the core at a uniform angle, 5% "bolts from the blue" 5 to 10 mi
--              ahead of the core within 45 degrees of its motion
--   per strike distance = hypot, bearing = atan2, to the site. Never rounded or clamped.
-- Its random numbers come from its own generator seeded per storm, used for nothing else, so a seed is always the
-- same storm. It is a Park-Miller generator written out here (not Roblox's Random) so the Lune harness gets the
-- exact strikes Studio does, which is how the seeds below were checked.
local StormModel = {}

StormModel.SIGMA_MI = 1.5
StormModel.BLUE_SHARE = 0.05
StormModel.STOP_MILES = 10
StormModel.ALL_CLEAR_S = 30 * 60
-- one storm, approach to passage, plays in this many real seconds; the engine slows the sim clock to fit
StormModel.REAL_SECONDS = 300

local MOD = 2147483647
local function generator(seed)
	local state = math.floor(seed) % MOD
	if state == 0 then state = 1 end
	return function()
		state = (state * 48271) % MOD -- exact in doubles: 48271 * 2^31 < 2^53
		return state / MOD -- in (0, 1), never 0, so ln(U) is finite
	end
end

-- The storms the buttons start (the scenarios write theirs out in Scenarios). Every storm in the World shares one
-- track so the life cycle puts the peak over the site: 20 mi out at 30 mph reaches the site at 40 min, so life is
-- 80 min and the cell dies 20 mi past. A peak of 2 strikes a minute is the low end of an ordinary storm; at 2, an
-- 80 minute storm played over 300 real s keeps the strikes inside 10 mi about 3.2 to 3.8 real seconds apart on
-- average (checked in the harness). Seeds were picked from the first 2000 so the first strike is beyond 10 mi and
-- dozens land inside it.
local BASE = { start_mi = 20, speed_mph = 30, peak_per_min = 2, life_min = 80 }
local function track(t)
	for k, v in pairs(BASE) do if t[k] == nil then t[k] = v end end
	return t
end
StormModel.presets = {
	-- Each button starts a whole storm; the label is where its first strike inside 10 mi lands (for 15, its very
	-- first strike). seed 279, 3 mi to the side: first 16.2 mi, first inside 8.0 mi, 57 inside, 3.4 s apart
	strike8 = track({ seed = 279, from_bearing = 270, cross_track_mi = 3 }),
	-- seed 552 cross 2: first 16.4, first inside 6.0, 3.2 s apart
	strike6 = track({ seed = 552, from_bearing = 255, cross_track_mi = 2 }),
	-- seed 419 cross 2: first 15.0, first inside 9.8, 3.5 s apart
	strike15 = track({ seed = 419, from_bearing = 270, cross_track_mi = 2 }),
	-- Strike here: the clicked spot sets from_bearing; the storm is Storm W's (seed 279, 2 mi to the side, first
	-- 16.1 mi, first inside 8.1 mi) turned to come from there. Distances do not depend on the direction.
	here = track({ seed = 279, from_bearing = 270, cross_track_mi = 2 }),
}

-- The strike list for one storm, in order: { t = sim seconds from the storm's start, bearing, miles }.
-- Pure: the same parameters always give the same list.
function StormModel.generate(p)
	local rand = generator(p.seed)
	local life = p.life_min * 60
	local lambdaMax = p.peak_per_min / 60
	local v = p.speed_mph / 3600
	local strikes = {}
	local t = 0
	while true do
		t += -math.log(rand()) / lambdaMax
		if t >= life then break end
		if rand() <= math.sin(math.pi * t / life) then
			-- storm frame: the cell moves along +x, the site at the origin, cross_track_mi to its left
			local cx, cy = -p.start_mi + v * t, p.cross_track_mi
			local x, y
			if rand() < StormModel.BLUE_SHARE then
				local d = 5 + 5 * rand()
				local a = math.rad((rand() * 2 - 1) * 45)
				x, y = cx + d * math.cos(a), cy + d * math.sin(a)
			else
				local r = StormModel.SIGMA_MI * math.sqrt(-2 * math.log(rand()))
				local th = 2 * math.pi * rand()
				x, y = cx + r * math.cos(th), cy + r * math.sin(th)
			end
			-- to the site's frame: +x points the way the storm moves (from_bearing + 180), counterclockwise is -bearing
			local bearing = (p.from_bearing + 180 - math.deg(math.atan2(y, x))) % 360
			-- x, y (storm frame, miles) are kept so the harness can check the geometry
			table.insert(strikes, { t = t, bearing = bearing, miles = math.sqrt(x * x + y * y), x = x, y = y })
		end
	end
	return strikes
end

-- the storm's own duration in sim seconds, and the sim speed that plays it in REAL_SECONDS
function StormModel.lifeSeconds(p) return p.life_min * 60 end
function StormModel.pace(p) return p.life_min * 60 / StormModel.REAL_SECONDS end

-- What the demo needs from a storm, for the harness and for picking seeds
function StormModel.summary(strikes, pace)
	local inside, firstInside, lastInside = 0, nil, nil
	for _, s in ipairs(strikes) do
		if s.miles < StormModel.STOP_MILES then
			inside += 1
			firstInside = firstInside or s
			lastInside = s
		end
	end
	local gap = (inside >= 2 and pace) and (lastInside.t - firstInside.t) / (inside - 1) / pace or nil
	return {
		count = #strikes, inside = inside, first = strikes[1], firstInside = firstInside, lastInside = lastInside,
		allClearT = lastInside and lastInside.t + StormModel.ALL_CLEAR_S, realGap = gap,
	}
end

-- Light and sound, in real seconds (FlashClient). Speed of sound from the air temperature in C.
function StormModel.soundSpeed(tempC) return 331.3 + 0.606 * (tempC or 25) end
function StormModel.thunderDelay(miles, tempC) return miles * 1609.344 / StormModel.soundSpeed(tempC) end
-- amplitude 1/d, full at 1 mi or closer, fading to silent between 10 and 15 mi
function StormModel.thunderGain(miles)
	local g = math.min(1, 1 / math.max(miles, 1e-6))
	if miles >= 15 then return 0 end
	if miles > 10 then g *= (15 - miles) / 5 end
	return g
end
-- flash brightness 1/d^2, full at 3 mi or closer, never under 0.15 so a far flash still shows
function StormModel.flashBrightness(miles)
	return math.max(0.15, math.min(1, 9 / math.max(miles * miles, 1e-6)))
end

return StormModel
