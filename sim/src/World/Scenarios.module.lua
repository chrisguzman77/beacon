-- Scenarios (ModuleScript)
local Scenarios = {}

-- the clock the Instant buttons run on when no scenario is playing: no events, real time scaled 60x
Scenarios.instant = {
	name = "Instant hazards", clockStart = "13:00", speed = 60,
	events = {
		{ t = 0, type = "weather", clouds = 0.3, rain = 0, temp_c = 29, humidity = 70, gust = 8 },
	},
}

Scenarios.order = { "everglades_day", "lightning_cell", "storm_west", "hurricane", "flash_flood", "mississippi_flood", "heat_day", "gator", "tipped" }

-- The lightning rule, start to finish. A cell builds west of the site, crosses the 10 mile ring, passes nearly
-- overhead (1 mi to the side), and moves off east. Every strike inside 10 miles restarts the 30 minute all clear.
-- The storm (seed 271) starts 20 mi out at 14:05: first strike 14:07 at 19.5 mi, first inside 10 mi at 14:11,
-- last inside 10 at 15:07, so the site is clear to work again at 15:37.
-- A storm event { t, type = "storm", seed, from_bearing, start_mi, speed_mph, cross_track_mi, peak_per_min,
-- life_min } runs StormModel: the cell starts start_mi out on from_bearing and walks in at speed_mph, passing
-- cross_track_mi to the side; life_min = 2 * start_mi / speed_mph puts its peak over the site. Every scenario storm
-- here is 20 mi out at 30 mph over 80 minutes at a peak of 2 strikes a minute, played over 5 real minutes; the
-- seed and cross track were picked so the first strike is beyond 10 mi and dozens land inside it.
Scenarios.lightning_cell = {
	name = "Lightning cell passes over", clockStart = "14:00", speed = 120,
	events = {
		{ t = 0,    type = "weather", clouds = 0.5,  rain = 0,  temp_c = 33, humidity = 70, gust = 15 },
		{ t = 1,    type = "note",    text = "14:00 a thunderstorm cell builds west of the site. Watch the radar: the red ring is 10 miles." },
		{ t = 300,  type = "weather", clouds = 0.8,  rain = 0,  temp_c = 32, humidity = 74, gust = 30 },
		{ t = 300,  type = "storm",   seed = 271, from_bearing = 270, start_mi = 20, speed_mph = 30, cross_track_mi = 1, peak_per_min = 2, life_min = 80 },
		{ t = 700,  type = "note",    text = "14:11 first strike inside the 10 mile ring. STOP WORK, the 30 minute all clear starts." },
		{ t = 2600, type = "weather", clouds = 0.95, rain = 45, temp_c = 27, humidity = 94, gust = 42 },
		{ t = 3000, type = "note",    text = "14:50 the cell is overhead and moving off east. Every strike inside 10 miles restarts the 30 minutes." },
		{ t = 4200, type = "weather", clouds = 0.6,  rain = 5,  temp_c = 29, humidity = 85, gust = 15 },
		{ t = 5850, type = "note",    text = "15:37 ALL CLEAR: 30 minutes with no strike inside 10 miles. Work may resume." },
	},
}

-- The brief's river example: a river site gets a flood risk warning after a night of heavy rain. The crossing sits
-- behind a levee; the river climbs through the morning and overtops it. Plays at the Mississippi crossing setting.
Scenarios.mississippi_flood = {
	name = "Mississippi crossing, river flood", site = "river", clockStart = "05:00", speed = 240, soil = 0.75,
	events = {
		{ t = 0,    type = "weather", clouds = 0.85, rain = 30, temp_c = 22, humidity = 96, gust = 18 },
		{ t = 1,    type = "note",    text = "05:00 after a night of heavy rain upstream. River sites get a flood risk warning before the crew mobilizes." },
		{ t = 600,  type = "water",   depth_mm = 20 },
		{ t = 1800, type = "water",   depth_mm = 50 },
		{ t = 1200, type = "storm",   seed = 1686, from_bearing = 200, start_mi = 20, speed_mph = 30, cross_track_mi = 3, peak_per_min = 2, life_min = 80 },
		{ t = 3000, type = "water",   depth_mm = 80 },
		{ t = 3600, type = "note",    text = "06:00 the river is near the top of the levee. Equipment off the floodplain, the crossing work is postponed." },
		{ t = 4200, type = "water",   depth_mm = 110 },
		{ t = 4260, type = "note",    text = "06:11 the levee is overtopping. Flood confirmed on site: stop work, everyone to high ground." },
		{ t = 5400, type = "water",   depth_mm = 130 },
		{ t = 7200, type = "weather", clouds = 0.6,  rain = 5,  temp_c = 24, humidity = 90, gust = 10 },
	},
}

-- The challenge brief, start to finish. 6:45 AM in August on a remote Everglades site where the crew is laying a
-- temporary mat road for the equipment that will build a new transmission line. A week of rain has the ground at
-- 82% saturation, so boots sink and trucks bog down. The heat index passes 110 F by noon. Thunderstorms build to
-- the west after 1 PM and walk in across the site. Someone saw a gator by the jobsite yesterday, today it is on the road.
-- At 6 PM site time the next-day briefing goes out. t is simulated seconds after 06:45; 300x plays the day in
-- under three minutes. soil is the starting saturation the Conditions board carries forward.
Scenarios.everglades_day = {
	name = "Everglades mat road, August", clockStart = "06:45", speed = 300, soil = 0.82,
	events = {
		{ t = 0,     type = "weather", clouds = 0.25, rain = 0, temp_c = 27, humidity = 94, gust = 6 },
		{ t = 0,     type = "water",   depth_mm = 5 },
		{ t = 1,     type = "note",    text = "06:45 go/no-go. A week of rain: soil 82% saturated, expect mud and stuck trucks. Heat index past 110 F by noon. Storms building west after 1 PM. Gator seen yesterday by the slough." },
		{ t = 2700,  type = "wildlife", species = "American alligator" },
		{ t = 2760,  type = "note",    text = "07:31 crew report: alligator on the mat road. Photo pinned to the site map and shared with every crew on this job." },
		{ t = 8100,  type = "weather", clouds = 0.2,  rain = 0,  temp_c = 31, humidity = 78, gust = 8 },
		{ t = 15300, type = "weather", clouds = 0.2,  rain = 0,  temp_c = 34, humidity = 64, gust = 10 },
		{ t = 18900, type = "weather", clouds = 0.3,  rain = 0,  temp_c = 35, humidity = 62, gust = 12 },
		{ t = 18960, type = "note",    text = "12:00 heat index over 110 F. Rest breaks in the cooling tent, water every 15 minutes." },
		{ t = 22500, type = "weather", clouds = 0.55, rain = 0,  temp_c = 35, humidity = 60, gust = 20 },
		{ t = 24300, type = "weather", clouds = 0.75, rain = 0,  temp_c = 33, humidity = 66, gust = 30 },
		-- seed 923, 2.5 mi to the side: first strike 13:34 at 19.2 mi, first inside 10 mi 13:47, last 14:32, all clear 15:02
		{ t = 24300, type = "storm",   seed = 923, from_bearing = 270, start_mi = 20, speed_mph = 30, cross_track_mi = 2.5, peak_per_min = 2, life_min = 80 },
		{ t = 25340, type = "note",    text = "13:47 lightning inside 10 miles. STOP WORK, 30 minute all clear, crew to the trucks." },
		{ t = 29400, type = "weather", clouds = 0.95, rain = 55, temp_c = 27, humidity = 95, gust = 45 },
		{ t = 30600, type = "water",   depth_mm = 30 },
		{ t = 32400, type = "water",   depth_mm = 60 },
		{ t = 37800, type = "weather", clouds = 0.6,  rain = 5,  temp_c = 28, humidity = 90, gust = 12 },
		{ t = 40500, type = "note",    text = "18:00 site time: next-day safety briefing sent to the crew, English and Spanish. Tomorrow: same heat, mats need re-leveling where the trucks sank." },
	},
}

Scenarios.storm_west = {
	name = "Storm from the west", clockStart = "13:00", speed = 60,
	events = {
		{ t = 0,    type = "weather", clouds = 0.2, rain = 0, temp_c = 33, humidity = 70, gust = 15 },
		{ t = 600,  type = "weather", clouds = 0.7, rain = 0, temp_c = 31, humidity = 78, gust = 35 },
		-- seed 279, 2 mi to the side: first strike 13:14 at 16.1 mi, first inside 10 mi 13:18 at 8.1, last 14:10, all clear 14:40
		{ t = 600,  type = "storm",   seed = 279, from_bearing = 270, start_mi = 20, speed_mph = 30, cross_track_mi = 2, peak_per_min = 2, life_min = 80 },
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
		-- the outer bands from the south, seed 29, 1.5 mi to the side: first strike 14.0 mi, first inside 10 mi at 8.1
		{ t = 1200, type = "storm",   seed = 29, from_bearing = 180, start_mi = 20, speed_mph = 30, cross_track_mi = 1.5, peak_per_min = 2, life_min = 80 },
		{ t = 3000, type = "weather", clouds = 0.95, rain = 60, temp_c = 27, humidity = 97, gust = 75 },
		{ t = 3600, type = "water",   depth_mm = 20 },
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
		{ t = 600,  type = "storm",   seed = 971, from_bearing = 120, start_mi = 20, speed_mph = 30, cross_track_mi = 3, peak_per_min = 2, life_min = 80 },
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
