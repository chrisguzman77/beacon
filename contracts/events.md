# Event shape

Every source (feed, beacon, sim, crew) writes this shape into the events hypertable. The rules engine reads events and never checks source.

{
  "site_id": 17,
  "ts": "2026-10-17T14:02:11Z",
  "source": "feed" | "beacon" | "sim" | "crew",
  "type": "strike" | "conditions" | "presence" | "water" | "tilt" | "checkin" | "hazard_report" | "estop" | "nws_alert" | "wildlife" | "local_stopwork",
  "payload": { }
}

Payloads by type
- strike: { lat, lon, distance_m }
- conditions: { temp_c, humidity, heat_index_f, precip_mm, soil, discharge, water_depth_mm, wind_gust_kmh }
- presence: { count: 0..3, still_energy, moving_energy, distance_cm }
- water: { depth_mm }
- tilt: { value: 0 | 1 }
- checkin: { crew_id, action: "in" | "out", via: "phone" | "remote" | "roblox", plus lat, lon (phone), crew_number (remote, the IR digit), or roblox_user (roblox) }
- hazard_report: { report_id, tag, description, lat, lon }
- estop: {}
- nws_alert: { event, severity, headline }
- wildlife: { species, observed_on, lat, lon }   source feed (iNaturalist) or sim (POST /sim/wildlife, which also files a no photo hazard report so the dashboard shows it)
- local_stopwork: { distance_m, flash_ts_us, bang_ts_us }

Rules (same on backend and Pi)
- stopwork: strike.distance_m < 16093 opens or extends a stopwork alert, expires = now + 1800 s. After expiry the alert is awaiting_clear until a supervisor clears it.
- flood_warning: site.river and (precip_24h > 50 mm or discharge > 2.5 x 90 day mean). flood_confirmed while the latest beacon or sim water_depth_mm in the last 10 min is > 0; cleared when it reads 0 again.
- heat_warning: heat_index_f >= 103. heat_danger: >= 115, sends REST 900 (with heat_index_f) to the beacon.
- wind_warning: site twin gust >= 28 mph (aerial lifts and bucket trucks grounded). wind_danger: >= 40 mph (the job stops). Dashboard only, nothing to the beacon.
- beacon_unsafe: tilt 1 until tilt 0.
- zone_clear: during stopwork, presence count 0 for 10 s.
