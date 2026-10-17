# PlanIT Beacon

A jobsite safety platform for utility field crews, built at SwampHacks XII for the PlanIT Control challenge.

The platform watches 50 real power plant sites, merges weather, heat, lightning, flooding, soil, and wildlife data into one risk picture per site, raises stop work alerts under the challenge's rules, sends a 6 PM next day briefing, accepts crew hazard photos, ranks sites for supervisors, and scores every site 0 to 10 with a machine learning hazard index.

A physical site beacon (Raspberry Pi, RP2040 sensor pod, Arduino control box, 7 inch touchscreen) senses heat, lightning, standing water, and crew presence on its own, speaks its alerts, cuts equipment power on a stop work, and keeps working with no internet.

A Roblox experience is the digital twin of the beacon's site. Scenarios run in Luau, lightning in Roblox strikes the real device through its own sensors, judges join as crew from their phones, and the in world beacon mirrors the real one.

## Layout

| Folder | Owner | What |
|---|---|---|
| backend/app/core | Viet | database, fetchers, rules, scheduler, websockets, auth, gateway endpoint, sim ingest |
| backend/app/intel | Chris | hazard index scoring, briefing, Gemini photo tagging |
| ml | Chris | training pipeline |
| web | Cam | dashboard, crew page, beacon kiosk |
| sim/src/World, sim/place | Slavik | Roblox place, scenarios, lightning, zone, beacon visuals, scene |
| sim/src/Bridge | Viet | Luau HTTP bridge to the backend |
| firmware | Slavik | pod, control box, Pi gateway |
| contracts | Chris (changes announced in chat) | the interfaces every piece speaks |
| docs | everyone | the build guides |

## Branches

`main` is demo ready and only receives merges from `dev`. `dev` is integration. Work on `feature/<area>-<thing>` off `dev`, merge back often. See CLAUDE.md.

## Running

See `scripts/dev.sh` and each folder's CLAUDE.md.

## Hazard index (machine learning)

Every site gets a 0 to 10 hazard index for tomorrow, refreshed daily at 05:00 UTC, with the three weather reasons that pushed it up. Training code is in `ml/`, serving code in `backend/app/intel/`, and the full numbers in [`ml/report/metrics.md`](ml/report/metrics.md).

**What it predicts.** The unit is a site-day: given tomorrow's weather at one of the 50 plants, how likely is a hazard that can hurt a crew. A site-day is labeled positive (5.8% of 164,400 site-days, 2016 to 2024) if any of these happened that day:
- a [NOAA Storm Events](https://www.ncei.noaa.gov/stormevents/) record (heat, lightning, flood, flash flood, thunderstorm wind, high wind, tornado, hail, tropical storm, hurricane) with coordinates within 40 km of the site,
- a zone-based Storm Events record (mostly heat) whose county matches the site's county,
- an [OSHA severe injury report](https://www.osha.gov/severeinjury) flagged outdoor (construction or electric utility NAICS, or a narrative mentioning heat, lightning, storm, flood, mud, trench, pole, line, or bucket truck) within 25 km.

Features are tomorrow's weather from [Open-Meteo](https://open-meteo.com/) (historical reanalysis for training, the forecast for scoring): highs and lows, apparent temperature, humidity, rain today and over 3 and 7 days, soil moisture, gusts and wind, season, plus fixed site facts ([FEMA flood zone](https://www.fema.gov/flood-maps/national-flood-hazard-layer), coastal, river, location). Sites are the 25 largest plants in Florida and the 25 largest in GA, AL, MS, LA, and TX from [EIA-860M](https://www.eia.gov/electricity/data/eia860m/).

**How it is tested.** Split by time, never at random: train 2016 to 2022, validate and calibrate 2023, test 2024. A random split would let the same storm leak into training and test through neighboring sites and days. Every metric is also reported for the rule a supervisor would write by hand (heat index at least 103 F, or 3 day rain at least 75 mm, or gusts at least 60 km/h).

| 2024 test year (18,300 site-days) | Model (LightGBM, isotonic calibration) | Baseline rule |
|---|---|---|
| PR AUC | **0.246** | 0.084 |
| ROC AUC | **0.817** | 0.594 |
| Brier score (lower is better) | **0.049** | 0.136 |
| Precision / recall | 0.211 at 50% recall | 0.149 at 29% recall |

The rule catches 29% of hazard days and is right 15% of the time it fires. Set to catch half of them, the model is right 21% of the time: more hazards caught and fewer false alarms, against a 5.8% base rate.

![calibration](ml/report/calibration.png) ![SHAP importance](ml/report/shap_importance.png)

**Calibration.** Predicted probabilities track what actually happened up to about 0.3, which is where nearly every site-day falls; above 0.5 there are only a handful of days per bin and the model is overconfident.

**The 0 to 10 index** is the number of 2023 validation deciles a site's calibrated probability exceeds, so a 7 means tomorrow looks riskier than 70% of the site-days the model was validated on.

**The three reasons** are the largest positive SHAP contributions among the weather features, written as plain values ("3 day rain 111 mm", "Gusts 49 km/h"). Location features stay in the model but are never shown as a reason.

**What it is not.** The label is at county and day resolution, so the model cannot know whether a particular crew was exposed; it is a ranking tool for deciding where to look first, not a forecast of injury. Zone-based heat events are matched to counties by name and are undercounted. OSHA reports are placed by zip code, which can be several kilometers off, and the outdoor flag is a keyword match. Location ranks high in the SHAP chart, so part of what the model learned is which sites have historically been riskier, not only which weather is. The heat feature is the day's maximum apparent temperature, not the NWS heat index formula, because the daily data cannot pair the afternoon high with afternoon humidity. Training weather is reanalysis and scoring weather is a forecast, so tomorrow's index inherits the forecast's error. The baseline rule is in every table so you can see how much the model adds.

**Gemini.** The 6 PM briefings (English and Spanish), the index sentence, and hazard photo tagging use Gemini with JSON response schemas. Every number in generated text is checked against the numbers in its input; if any is new, it retries once, then falls back to a template built from the input alone, so a briefing can never state a number that is not in the data.
