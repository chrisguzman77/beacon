// Every factor the beacon snapshot can determine, with its condition.
// "info" is neutral data, "ok" is a monitored factor that is fine,
// "caution" and "danger" are hazards and carry the hazard's color.
import { color, hazard } from '@/tokens'
import type { Snapshot } from './types'

export type Status = 'info' | 'ok' | 'caution' | 'danger'

export type Factor = {
  id: string
  label: string
  value: string
  status: Status
  tint?: string // hazard color when caution or danger
  note?: string // one line shown on the caution screen
}

const f = (n: number) => Math.round(n)

export function buildFactors(s: Snapshot): Factor[] {
  const out: Factor[] = []
  const lightning = s.alert_type === 'stopwork'
  const miles = s.reason.match(/(\d+)\s*MI/)?.[1]

  // Heat index, NWS bands: 91+ extreme caution, 103+ danger.
  const hi = s.heat_index_f
  const heatStatus: Status = s.alert_type === 'heat_danger' || hi >= 103 ? 'danger' : hi >= 91 ? 'caution' : 'ok'
  out.push({ id: 'heat', label: 'Heat index', value: `${f(hi)}°F`, status: heatStatus, tint: hazard.heat, note: `Heat index ${f(hi)}°F` })

  const tempF = s.temp_c * 9 / 5 + 32
  out.push({ id: 'temp', label: 'Temperature', value: `${f(tempF)}°F`, status: tempF >= 95 ? 'caution' : 'info', tint: hazard.heat, note: `Air temperature ${f(tempF)}°F` })
  out.push({ id: 'humidity', label: 'Humidity', value: `${f(s.humidity)}%`, status: 'info' })

  const water = s.water_pct
  const waterStatus: Status = s.alert_type === 'flood_confirmed' || water >= 30 ? 'danger' : water > 0 ? 'caution' : 'ok'
  out.push({ id: 'water', label: 'Standing water', value: `${f(water)}%`, status: waterStatus, tint: hazard.flood, note: `Standing water ${f(water)}%` })

  out.push({
    id: 'lightning', label: 'Lightning', value: lightning ? `${miles ?? '?'} MI` : 'NONE',
    status: lightning ? 'danger' : 'ok', tint: hazard.stopwork, note: `Lightning ${miles ?? ''} mi, stop work`,
  })

  const unsafe = s.alert_type === 'beacon_unsafe' || s.alert_type === 'estop'
  const tiltStatus: Status = s.alert_type === 'beacon_unsafe' || s.tilt > 15 ? 'danger' : s.tilt > 5 ? 'caution' : 'ok'
  out.push({ id: 'tilt', label: 'Beacon tilt', value: `${f(s.tilt)}°`, status: tiltStatus, tint: hazard.unsafe, note: `Beacon tilted ${f(s.tilt)}°` })

  out.push({
    id: 'equipment', label: 'Equipment', value: s.interlock === 'locked' ? 'LOCKED' : 'RUNNING',
    status: s.interlock === 'locked' ? 'danger' : 'ok', tint: unsafe ? hazard.unsafe : hazard.stopwork,
    note: s.alert_type === 'estop' ? 'E-stop pressed, equipment locked' : 'Equipment power cut',
  })

  out.push({
    id: 'zone', label: 'Work zone', value: s.zone_clear ? 'CLEAR' : 'OCCUPIED',
    status: !s.zone_clear && lightning ? 'danger' : 'info', tint: hazard.stopwork, note: 'Work zone occupied during stop work',
  })

  const crewIn = s.crew.filter((c) => c.in).length
  out.push({ id: 'crew', label: 'Crew on site', value: `${crewIn}/${s.crew.length}`, status: 'info' })
  out.push({ id: 'light', label: 'Light level', value: String(s.light), status: 'info' })
  out.push({
    id: 'link', label: 'Cloud link', value: s.online ? 'ONLINE' : 'OFFLINE',
    status: s.online ? 'ok' : 'caution', tint: color.offline, note: 'Offline, local rules active',
  })
  out.push({ id: 'briefing', label: 'Next briefing', value: s.next_briefing, status: 'info' })
  return out
}

export const isHazard = (x: Factor) => x.status === 'caution' || x.status === 'danger'
