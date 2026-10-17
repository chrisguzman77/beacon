# Gateway websocket (Pi to backend)

URL: wss://PUBLIC/ws/gateway/{site_id}?token=GATEWAY_TOKEN
Ping every 15 s. JSON per message. The Pi queues messages while disconnected and replays them with their original ts on reconnect.

Up (Pi to backend)
{"kind":"pod","ts":"...","P":1,"D":182,"S":41,"M":12,"T":33.1,"H":78,"W":0,"TILT":0}
{"kind":"flash","ts_us":1729170131045123}
{"kind":"local_stopwork","ts":"...","distance_m":1030,"flash_ts_us":...,"bang_ts_us":...}
{"kind":"count","seconds":1793}
{"kind":"checkin","crew_number":7,"action":"in","via":"remote"}         (remote fallback; kiosk check ins go through the backend API directly)
{"kind":"estop","ts":"..."}
{"kind":"pin","value":"1234"}
{"kind":"state","led":"strobe","countdown":1793,"index":7,"interlock":"locked","presence":true,"online":true,"lcd":["LOCKED OUT","LIGHTNING 8MI 29:53"]}

Down (backend to Pi)
{"cmd":"STOPWORK","seconds":1800,"distance_m":12874,"source":"sim"}
{"cmd":"CLEAR","by":"J. Smith"}
{"cmd":"INDEX","value":7,"reason":"Heat index 108"}
{"cmd":"REST","seconds":900}
{"cmd":"MUSTER","in":["Alice","Bob"],"out":[]}
{"cmd":"BRIEFING","english":"...","spanish":"..."}
{"cmd":"BANG","ts_us":...}            relayed from the laptop mic listener so the Pi can pair it with its FLASH
{"cmd":"DEMO_SCALE","value":60}

The backend exposes the last "state" message at GET /sites/{id}/device for pollers (Roblox, dashboard).
