-- Scenarios (ModuleScript)
local Scenarios = {}

Scenarios.order = { "everglades_day", "lightning_cell", "storm_west", "hurricane", "flash_flood", "mississippi_flood", "heat_day", "gator", "tipped" }

-- The lightning rule, start to finish. A cell builds west of the site, crosses the 10 mile ring, passes overhead
-- with strikes down to 3 miles, and moves off east. Every strike inside 10 miles restarts the 30 minute all
-- clear; the last one inside 10 is the 8 mile strike at 15:00, so the site is clear to work again at 15:30.
Scenarios.lightning_cell = {
	name = "Lightning cell passes over", clockStart = "14:00", speed = 120,
	events = {
		{ t = 0,    type = "weather", clouds = 0.5,  rain = 0,  temp_c = 33, humidity = 70, gust = 15 },
		{ t = 1,    type = "note",    text = "14:00 a thunderstorm cell builds west of the site. Watch the radar: the red ring is 10 miles." },
		{ t = 300,  type = "weather", clouds = 0.8,  rain = 0,  temp_c = 32, humidity = 74, gust = 30 },
		{ t = 600,  type = "strike",  bearing = 270, miles = 18 },
		{ t = 900,  type = "strike",  bearing = 268, miles = 15 },
		{ t = 1200, type = "strike",  bearing = 265, miles = 13 },
		{ t = 1500, type = "strike",  bearing = 262, miles = 11 },
		{ t = 1800, type = "strike",  bearing = 260, miles = 9 },
		{ t = 1810, type = "note",    text = "14:30 strike 9 miles out, inside the ring. STOP WORK, the 30 minute all clear starts." },
		{ t = 2100, type = "strike",  bearing = 255, miles = 7 },
		{ t = 2400, type = "strike",  bearing = 250, miles = 5 },
		{ t = 2600, type = "weather", clouds = 0.95, rain = 45, temp_c = 27, humidity = 94, gust = 42 },
		{ t = 2700, type = "strike",  bearing = 240, miles = 3 },
		{ t = 3000, type = "strike",  bearing = 120, miles = 4 },
		{ t = 3300, type = "strike",  bearing = 100, miles = 6 },
		{ t = 3600, type = "strike",  bearing = 90,  miles = 8 },
		{ t = 3610, type = "note",    text = "15:00 strike 8 miles east, still inside 10. Every close strike restarts the 30 minutes." },
		{ t = 4200, type = "strike",  bearing = 85,  miles = 12 },
		{ t = 4200, type = "weather", clouds = 0.6,  rain = 5,  temp_c = 29, humidity = 85, gust = 15 },
		{ t = 4800, type = "strike",  bearing = 80,  miles = 15 },
		{ t = 5400, type = "strike",  bearing = 78,  miles = 19 },
		{ t = 5460, type = "note",    text = "15:31 ALL CLEAR: 30 minutes with no strike inside 10 miles. Work may resume." },
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
		{ t = 2400, type = "strike",  bearing = 200, miles = 12 },
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
-- the west after 1 PM and walk in to 6 miles. Someone saw a gator by the jobsite yesterday, today it is on the road.
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
		{ t = 26100, type = "strike",  bearing = 270, miles = 15 },
		{ t = 27000, type = "strike",  bearing = 265, miles = 11 },
		{ t = 27900, type = "strike",  bearing = 260, miles = 8 },
		{ t = 27960, type = "note",    text = "14:30 strike 8 miles west. STOP WORK, 30 minute all clear, crew to the trucks." },
		{ t = 28800, type = "strike",  bearing = 255, miles = 6 },
		{ t = 29400, type = "weather", clouds = 0.95, rain = 55, temp_c = 27, humidity = 95, gust = 45 },
		{ t = 30600, type = "water",   depth_mm = 30 },
		{ t = 32400, type = "water",   depth_mm = 60 },
		{ t = 33300, type = "strike",  bearing = 250, miles = 4 },
		{ t = 37800, type = "weather", clouds = 0.6,  rain = 5,  temp_c = 28, humidity = 90, gust = 12 },
		{ t = 40500, type = "note",    text = "18:00 site time: next-day safety briefing sent to the crew, English and Spanish. Tomorrow: same heat, mats need re-leveling where the trucks sank." },
	},
}

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
