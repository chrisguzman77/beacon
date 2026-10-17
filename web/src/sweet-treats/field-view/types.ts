// The site page's view of one site: live device state plus conditions, crew and reports.
// Filled by the fake (?fake=1) today and from GET /sites/{id} plus the site websocket next.

export type CrewMember = { id: number; name: string; in: boolean }

export type Snapshot = {
  kind: 'snapshot'
  site: { id: number; name: string }
  online: boolean
  led: 'green' | 'yellow' | 'red' | 'strobe'
  countdown: number
  reason: string
  alert_type: 'stopwork' | 'heat_danger' | 'flood_confirmed' | 'beacon_unsafe' | 'estop' | ''
  interlock: 'running' | 'locked'
  awaiting_clear: boolean
  presence: boolean
  zone_clear: boolean
  index: number
  index_reason: string
  heat_index_f: number
  temp_c: number
  humidity: number
  water_pct: number
  tilt: number
  light: number
  radar: { d: number; s: number; m: number }
  last_flash_ts: string
  crew: CrewMember[]
  briefing: { english: string; spanish: string; for_date: string }
  next_briefing: string
  reports: { tag: string; description: string; ts: string }[]
  report_url: string
  demo_scale: number
  pin_error?: boolean
  // Site conditions from the feeds (GET /sites/{id}/conditions). Optional: a factor only shows when present.
  wind_gust_mph?: number
  precip_24h_in?: number
  soil_pct?: number
  river_stage_ft?: number
  river_flood_ft?: number
  flood_zone?: string
}

export function isTakeover(s: Snapshot) {
  return s.countdown > 0 || s.interlock === 'locked' || s.awaiting_clear
}
