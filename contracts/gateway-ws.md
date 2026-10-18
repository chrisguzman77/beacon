# Gateway websocket (Pi to backend)

URL: wss://PUBLIC/ws/gateway/{site_id}?token=GATEWAY_TOKEN
Ping every 5 s. JSON per message. The Pi queues messages while disconnected and replays them with their original ts on reconnect.

Up (Pi to backend)
{"kind":"pod","ts":"...","P":1,"D":182,"S":41,"M":12,"T":33.1,"H":78,"W":0,"TILT":0}
{"kind":"flash","ts_us":1729170131045123}
{"kind":"local_stopwork","ts":"...","distance_m":1030,"flash_ts_us":...,"bang_ts_us":...}
{"kind":"count","seconds":1793}
{"kind":"checkin","ts":"...","crew_number":3,"action":"in","via":"remote"}        IR remote digit 1..9 toggles crew N; arrives here so it works offline
{"kind":"estop","ts":"..."}
{"kind":"pin","value":"1234","ok":true}                                        the Pi already checked SUPERVISOR_PIN and cleared locally; ok false is logged only
{"kind":"state","led":"strobe","countdown":1793,"index":7,"interlock":"locked","presence":true,"online":true,"lcd":["LOCKED OUT","LIGHTNING 8MI 29:53"]}

Down (backend to Pi)
{"cmd":"STOPWORK","seconds":1800,"distance_m":12874,"source":"sim"}
{"cmd":"CLEAR","by":"J. Smith"}
{"cmd":"INDEX","value":7,"reason":"Heat index 108"}
{"cmd":"REST","seconds":900,"heat_index_f":129.5}   heat_index_f is the reading behind it, for the beacon's voice and LCD
{"cmd":"MUSTER","in":["Alice","Bob"],"out":[]}
{"cmd":"BRIEFING","english":"...","spanish":"...","for_date":"2026-10-18"}
{"cmd":"BANG","ts_us":...}            relayed from POST /sim/bang (the laptop mic listener) so the Pi can pair it with its FLASH
{"cmd":"DEMO_SCALE","value":60}
{"cmd":"WATER","pct":50}              the site twin's water depth (POST /sim/water) as the probe's 0..100, pct = depth_mm x 2.5 capped at 100; the Pi takes the higher of this and its own probe

The backend keeps the last "state" message per site in memory and serves it at GET /sites/{id}/device for pollers (Roblox, dashboard). It also pushes it on WS /ws/site/{id}.

Change log
- contract: checkin carries ts for replay
- contract: pin carries ok so the backend records who released without re-checking the PIN
- contract: WATER carries the site twin's flood to the beacon; REST carries heat_index_f; two backend STOPWORKs are always two strikes (the 5 s same strike rule is only between the backend and the Pi's own flash to bang)
- contract: touchscreen and kiosk removed; checkin is crew_number via remote only (the crew_id kiosk checkin and the CREW roster command are gone)
