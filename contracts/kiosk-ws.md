# Kiosk websocket (gateway on the Pi <-> kiosk page)

The kiosk page (web, built with VITE_MODE=beacon) talks only to the gateway on the same Pi. Nothing here touches the cloud, so the kiosk works offline.

URL: ws://localhost:8080/ws
Static files: the gateway serves the kiosk build at http://localhost:8080/beacon/
Owners: Slavik sends the snapshot and handles the up messages in firmware/gateway. Cam renders the snapshot and sends the up messages from web.

Down (gateway to kiosk). One message type. Sent on connect, on every change, and at least every 250 ms while anything is counting.

{
  "kind": "snapshot",
  "site": {"id": 1, "name": "Crystal River"},
  "online": true,                       false shows OFFLINE LOCAL RULES ACTIVE
  "led": "green" | "yellow" | "red" | "strobe",
  "countdown": 1793,                    seconds from the UNO's COUNT line, 0 when none
  "reason": "LIGHTNING 8 MI",           one line, empty when no alert
  "alert_type": "stopwork" | "heat_danger" | "flood_confirmed" | "beacon_unsafe" | "estop" | "",
  "interlock": "running" | "locked",
  "awaiting_clear": false,              true when the countdown has finished and a PIN is needed
  "presence": true,
  "zone_clear": false,
  "index": 7,
  "index_reason": "Heat index 108",
  "heat_index_f": 104.2, "temp_c": 33.1, "humidity": 78,
  "water_pct": 0, "tilt": 0, "light": 512,
  "radar": {"d": 182, "s": 41, "m": 12},
  "last_flash_ts": "2026-10-17T14:02:11Z",
  "crew": [{"id": 1, "name": "Alice", "in": true}, {"id": 2, "name": "Bob", "in": false}],
  "briefing": {"english": "...", "spanish": "...", "for_date": "2026-10-18"},
  "next_briefing": "18:00",
  "reports": [{"tag": "alligator", "description": "...", "ts": "..."}],
  "report_url": "https://PUBLIC/crew?site=1",
  "demo_scale": 1
}

Up (kiosk to gateway)
{"kind": "checkin", "crew_id": 1, "action": "in" | "out"}      gateway forwards up its backend socket with via kiosk, queues if offline
{"kind": "pin", "value": "1234"}                                gateway checks SUPERVISOR_PIN, clears locally, forwards up
{"kind": "play_briefing", "lang": "en" | "es"}                  gateway speaks the stored briefing
{"kind": "test_flash"}                                          gateway logs the next FLASH line; the page itself draws the white overlay
{"kind": "demo_scale", "value": 1 | 10 | 60}                    gateway scales countdowns and forwards up

Rules
- The kiosk never runs its own countdown timer. It renders countdown from the snapshot.
- The stop work screen is shown whenever countdown > 0 or interlock == "locked" or awaiting_clear, and is never dismissible by touch.
- The crew list in the snapshot comes from the backend's CREW message, cached by the gateway, so it survives offline.
- The gateway replies to a bad pin with a snapshot carrying "pin_error": true once, so the pad can shake.
