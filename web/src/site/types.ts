import type { Alert } from '@/api'

// The site page's view of one site: live device state plus conditions, crew and reports.
// Filled by the fake (?fake=1) today and from GET /sites/{id} plus the site websocket next.

// A crew hazard photo report (POST /reports), tagged by the AI. lat/lon pin it on the site plot.
export type Report = { report_id?: number; tag: string; description: string; ts: string; lat?: number | null; lon?: number | null; photo_path?: string | null; confidence?: number; note?: string }

// Something the site twin did (backend source 'sim'): a strike, weather or water, newest first.
export type SimEvent = { ts: string; kind: 'strike' | 'weather' | 'water'; text: string }

export type CrewMember = { id: number; name: string; in: boolean; twin?: boolean } // twin: joined through the site twin

export type Snapshot = {
  kind: 'snapshot'
  site: { id: number; name: string; beacon?: boolean; lat?: number; lon?: number }
  online: boolean
  led: 'green' | 'yellow' | 'red' | 'strobe'
  countdown: number
  reason: string
  alert_id?: number // the open alert behind alert_type, for the supervisor release (POST /alerts/{id}/clear)
  alert_type: 'stopwork' | 'heat_danger' | 'flood_confirmed' | 'beacon_unsafe' | 'estop' | 'flood_warning' | 'heat_warning' | 'wind_danger' | 'wind_warning' | ''
  interlock: 'running' | 'locked'
  awaiting_clear: boolean
  presence: boolean
  zone_clear: boolean
  index: number
  index_reason: string // one sentence on why the index is what it is
  index_reasons?: string[] // the model's top features as short labels, e.g. "Gusts 49 km/h" (up to three)
  heat_index_f: number
  temp_c: number
  humidity: number
  water_pct: number
  tilt: number
  light: number
  radar: { d: number; s: number; m: number }
  last_flash_ts: string
  crew: CrewMember[]
  briefing: { english: string; spanish: string; for_date: string; payload?: Record<string, number | string> }
  next_briefing: string
  reports: Report[]
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
  lcd?: string[] // the beacon LCD1602's two lines, exactly as shown
  alert_log?: Alert[] // open and past alerts, newest first, for the compliance log
  sim?: SimEvent[] // the site twin's recent events, for the scenario panel
}

export function isTakeover(s: Snapshot) {
  return s.countdown > 0 || s.interlock === 'locked' || s.awaiting_clear
}
