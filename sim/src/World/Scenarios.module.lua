-- Scenarios (ModuleScript)
local Scenarios = {}

Scenarios.order = { "storm_west", "hurricane", "flash_flood", "heat_day", "gator", "tipped" }

Scenarios.storm_west = {
	name = "Storm from the west", clockStart = "13:00", speed = 60,
	events = {
		{ t = 0,    type = "weather", clouds = 0.2, rain = 0, temp_c = 33, humidity = 70, gust = 15 },
		{ t = 600,  type = "weather", clouds = 0.7, rain = 0, temp_c = 31, humidity = 78, gust = 35 },
		{ t = 900,  type = "strike",  bearing = 270, miles = 15 },
		{ t = 1200, type = "strike",  bearing = 265, miles = 11 },
		{ t = 1500, type = "strike",  bearing = 260, miles = 8 },
		{ t = 1800, type = "strike",  bearing = 250, miles = 6 },
		{ t = 2100, type = "weather", clouds = 0.8, rain = 12, temp_c = 28, humidity = 90, gust = 40 },
		{ t = 2400, type = "water",   depth_mm = 10 },
	},
}

-- A Gulf hurricane making landfall: outer rain bands, lightning walking in from the south, wind past
-- hurricane force, then rain and surge push the swamp up over the pad. About a minute at 120x.
Scenarios.hurricane = {
	name = "Hurricane landfall", clockStart = "06:00", speed = 120,
	events = {
		{ t = 0,    type = "weather", clouds = 0.5,  rain = 2,  temp_c = 29, humidity = 85, gust = 30 },
		{ t = 1200, type = "weather", clouds = 0.8,  rain = 20, temp_c = 28, humidity = 92, gust = 50 },
		{ t = 1800, type = "strike",  bearing = 200, miles = 12 },
		{ t = 2400, type = "strike",  bearing = 190, miles = 9 },
		{ t = 3000, type = "weather", clouds = 0.95, rain = 60, temp_c = 27, humidity = 97, gust = 75 },
		{ t = 3300, type = "strike",  bearing = 180, miles = 6 },
		{ t = 3600, type = "water",   depth_mm = 20 },
		{ t = 3900, type = "strike",  bearing = 170, miles = 4 },
		{ t = 4800, type = "water",   depth_mm = 60 },
		{ t = 5400, type = "note",    text = "Surge and rain push the swamp over the pad. The beacon's water sensor trips, the crew moves to high ground by the trucks." },
		{ t = 6000, type = "water",   depth_mm = 100 },
		{ t = 6600, type = "weather", clouds = 0.85, rain = 25, temp_c = 27, humidity = 95, gust = 45 },
	},
}

-- Heat index at 70 percent humidity. 33 C is about 104 F (heat_warning at 103),
-- 36 C is about 117 F (heat_danger at 115), 39 C is well past both.
Scenarios.heat_day = {
	name = "Heat day", clockStart = "10:00", speed = 120,
	events = {
		{ t = 0,    type = "weather", clouds = 0.1, rain = 0, temp_c = 31, humidity = 70, gust = 5 },
		{ t = 3600, type = "weather", clouds = 0.1, rain = 0, temp_c = 33, humidity = 70, gust = 5 },
		{ t = 7200, type = "weather", clouds = 0.1, rain = 0, temp_c = 36, humidity = 70, gust = 5 },
		{ t = 10800, type = "weather", clouds = 0.1, rain = 0, temp_c = 39, humidity = 70, gust = 5 },
	},
}

Scenarios.flash_flood = {
	name = "Flash flood", clockStart = "14:00", speed = 60,
	events = {
		{ t = 0,    type = "weather", clouds = 0.8, rain = 10, temp_c = 27, humidity = 92, gust = 20 },
		{ t = 600,  type = "weather", clouds = 0.9, rain = 30, temp_c = 26, humidity = 95, gust = 25 },
		{ t = 900,  type = "water",   depth_mm = 0 },
		{ t = 1200, type = "weather", clouds = 0.9, rain = 60, temp_c = 25, humidity = 97, gust = 30 },
		{ t = 1500, type = "water",   depth_mm = 20 },
		{ t = 1800, type = "strike",  bearing = 120, miles = 7 },
		{ t = 2100, type = "water",   depth_mm = 60 },
		{ t = 2700, type = "water",   depth_mm = 90 },
		{ t = 3300, type = "weather", clouds = 0.6, rain = 5, temp_c = 26, humidity = 90, gust = 10 },
		{ t = 3900, type = "water",   depth_mm = 40 },
	},
}

-- Wildlife is visual only. The dashboard's wildlife layer comes from iNaturalist,
-- there is no /sim/wildlife route, so this scenario just spawns the gator by the slough.
Scenarios.gator = {
	name = "Gator sighting", clockStart = "08:00", speed = 30,
	events = {
		{ t = 0,   type = "weather",  clouds = 0.3, rain = 0, temp_c = 29, humidity = 80, gust = 8 },
		{ t = 300, type = "wildlife", species = "American alligator" },
		{ t = 310, type = "note",     text = "Gator at the slough. Crew reports it from the phone page, the tag appears on the site map." },
	},
}

-- The tilt switch is demonstrated by hand on the real pod. The sim only explains it.
Scenarios.tipped = {
	name = "Tipped pod", clockStart = "09:00", speed = 1,
	events = {
		{ t = 0, type = "note", text = "Tip the real sensor pod by hand. TILT goes to 1, the beacon reports beacon_unsafe, the dashboard shows it. Set it upright to clear." },
	},
}

return Scenarios
