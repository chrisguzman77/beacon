# Roblox bridge

The Roblox experience is a client of the backend. It uses HttpService from server scripts only. The backend must be public (HttpService cannot reach localhost). All requests send header X-Token: SIM_TOKEN.

Roblox to backend
POST /sim/strike      {site_id, bearing, miles}       on every scenario or free play strike, after the in world bolt and flash have fired
POST /sim/weather     {site_id, temp_c, humidity, precip_mm, gust}   on scenario weather events; gust in mph (the backend stores km/h)
POST /sim/water       {site_id, depth_mm}
POST /sim/presence    {site_id, count, users}         whenever the set of players inside the ZonePart changes, and every 5 s while nonzero
POST /sim/reset       {site_id}                       when SimEvents.Reset fires (a scenario starts, or Reset to calm)
POST /sim/wildlife    {site_id, species}              when SimEvents.Wildlife fires (a gator in the scenario or the gator button)

Backend to Roblox (polled)
GET /sites/{site_id}/device   once per second. Returns the last gateway state:
  {led, countdown, index, interlock, presence, online, lcd}
  led drives the in world beacon light (green, yellow, red, strobe). countdown drives the in world display. presence true spawns the NPC worker in the zone. interlock "locked" stops the excavator animation.
GET /sites/{site_id}          every 10 s for the index and active alerts to show on an in world billboard.

Physical path (no HTTP)
- The flash is a full screen white ScreenGui Frame on every client for about 50 ms (3 render frames). The pod's photoresistor is aimed at the demo laptop's screen.
- Thunder is a Sound from the Roblox library played with delay = miles * 4.69 s (sound at 343 m/s). The laptop's speakers play it, the mic listener page hears it and posts /sim/bang.

Scenario format (Luau table, mirrors the JSON in the simulator guide)
{ name = "Storm from the west", clockStart = "13:00", speed = 60,
  events = {
    { t = 0,    type = "weather", clouds = 0.2, rain = 0, temp_c = 33, humidity = 70, gust = 15 },
    { t = 900,  type = "strike",  bearing = 270, miles = 15 },
    { t = 1200, type = "strike",  bearing = 265, miles = 11 },
    { t = 1500, type = "strike",  bearing = 260, miles = 8 },
    { t = 1800, type = "strike",  bearing = 250, miles = 6 },
  } }
t is simulated seconds from clockStart. Bearing 270 is west.

Inside Roblox (World <-> Bridge)

ReplicatedStorage.SimEvents, a Folder of BindableEvents. The World fires, the Bridge listens.
  Strike(bearing: number, miles: number)
  Weather(t: {temp_c, humidity, precip_mm, gust})
  Water(depth_mm: number)
  PresenceChanged(count: number, users: {string})
  Reset()   fired when a scenario starts or on Reset to calm; the World also clears its own sim hazard state
  Wildlife(species: string)   e.g. "American alligator", when the World spawns wildlife at the site

workspace.Beacon attributes. The Bridge writes, the World reads with GetAttributeChangedSignal.
  Led: "green" | "yellow" | "red" | "strobe"
  Countdown: number (seconds, 0 when none)
  Index: number 0..10
  Interlock: "running" | "locked"
  Presence: boolean
  Online: boolean (false when the backend is unreachable)
  Lcd1, Lcd2: string (16 chars)
  Alerts: string (JSON array of active alert types)

Bridge script attributes, set in Studio: BACKEND_URL, SIM_TOKEN, SITE_ID.

Flash and thunder stay on the World side (ReplicatedStorage.FlashEvent, a RemoteEvent the Lightning script fires with miles, handled by a LocalScript in StarterPlayerScripts). The Bridge never touches the screen or audio.
