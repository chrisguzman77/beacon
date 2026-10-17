// Shapes from contracts/kiosk-ws.md. The contract wins if these drift.

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
}

export type UpMessage =
  | { kind: 'checkin'; crew_id: number; action: 'in' | 'out' }
  | { kind: 'pin'; value: string }
  | { kind: 'play_briefing'; lang: 'en' | 'es' }
  | { kind: 'test_flash' }
  | { kind: 'demo_scale'; value: 1 | 10 | 60 }

export function isTakeover(s: Snapshot) {
  return s.countdown > 0 || s.interlock === 'locked' || s.awaiting_clear
}
