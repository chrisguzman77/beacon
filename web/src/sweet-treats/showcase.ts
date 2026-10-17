// Hazard showcase for the fake gateway: every hazard display the screen can show, one per
// 10 s step, advancing only while the screen is idle. Lightning here is display only
// (no countdown, interlock running) so the stop work takeover does not fire.
import type { Snapshot } from '@/site/types'

type Step = { name: string; patch: () => Partial<Snapshot> }

const now = () => new Date().toISOString()

export const STEP_MS = 10_000

export const allClear: Partial<Snapshot> = {
  led: 'green', countdown: 0, reason: '', alert_type: '', interlock: 'running', awaiting_clear: false,
  presence: false, zone_clear: true, index: 2, index_reason: 'Calm, no hazards in the next 24 hours',
  heat_index_f: 84, temp_c: 28, humidity: 55, water_pct: 0, tilt: 0, online: true, reports: [],
  radar: { d: 0, s: 0, m: 0 },
  wind_gust_mph: 9, precip_24h_in: 0.1, soil_pct: 35, river_stage_ft: 4.2, river_flood_ft: 9, flood_zone: 'X',
}

const alligator = () => [{ tag: 'alligator', description: 'near the north gate culvert', ts: now() }]

export const steps: Step[] = [
  { name: 'All clear', patch: () => ({}) },
  { name: 'Heat caution', patch: () => ({ heat_index_f: 96, temp_c: 33, humidity: 62, index: 5, index_reason: 'Heat index 96, extreme caution' }) },
  { name: 'Heat danger', patch: () => ({ alert_type: 'heat_danger', reason: 'HEAT INDEX 108', led: 'yellow', heat_index_f: 108, temp_c: 37, humidity: 58, index: 8, index_reason: 'Heat index 108, heat danger' }) },
  { name: 'Flood caution', patch: () => ({ water_pct: 12, precip_24h_in: 1.4, soil_pct: 78, river_stage_ft: 8.3, index: 5, index_reason: 'Standing water rising after rain' }) },
  { name: 'Flood danger', patch: () => ({ alert_type: 'flood_confirmed', reason: 'FLOOD CONFIRMED', led: 'yellow', water_pct: 45, precip_24h_in: 3.6, soil_pct: 96, river_stage_ft: 10.4, flood_zone: 'AE', index: 8, index_reason: 'Flood confirmed, river above flood stage' }) },
  { name: 'High wind', patch: () => ({ wind_gust_mph: 38, index: 7, index_reason: 'Gusts to 38 mph, no work at height' }) },
  { name: 'Wildlife', patch: () => ({ reports: alligator(), index: 6, index_reason: 'Alligator reported near the north gate' }) },
  { name: 'Lightning', patch: () => ({ alert_type: 'stopwork', reason: 'LIGHTNING 8 MI', led: 'red', presence: true, zone_clear: false, radar: { d: 182, s: 41, m: 12 }, last_flash_ts: now(), index: 9, index_reason: 'Lightning 8 mi west' }) },
  { name: 'Beacon unsafe', patch: () => ({ alert_type: 'beacon_unsafe', reason: 'BEACON TILTED', led: 'strobe', tilt: 22, index: 7, index_reason: 'Beacon tilted 22°, check the mount' }) },
  { name: 'Offline', patch: () => ({ online: false, index: 3, index_reason: 'Cloud link lost, local rules active' }) },
  {
    name: 'Combined',
    patch: () => ({ alert_type: 'heat_danger', reason: 'HEAT INDEX 106', heat_index_f: 106, temp_c: 36, water_pct: 8, wind_gust_mph: 27, soil_pct: 74, reports: alligator(), online: false, index: 9, index_reason: 'Heat, standing water and wildlife together' }),
  },
]
