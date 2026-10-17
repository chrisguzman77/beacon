// Every factor the beacon snapshot can determine, with its condition and cluster.
// "info" is neutral data, "ok" is a monitored factor that is fine,
// "caution" and "danger" are hazards and carry the hazard's color.
// To add a factor: push it here with a group; the web places it automatically.
import { color, hazard } from '@/tokens'
import type { Snapshot } from './types'

export type Status = 'info' | 'ok' | 'caution' | 'danger'
export type Group = 'weather' | 'water' | 'wildlife' | 'equipment' | 'site'

export const groups: { id: Group; label: string }[] = [
  { id: 'weather', label: 'Weather' },
  { id: 'water', label: 'Water' },
  { id: 'wildlife', label: 'Wildlife' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'site', label: 'Site' },
]

export type Factor = {
  id: string
  group: Group
  label: string
  value: string
  status: Status
  tint?: string // hazard color when caution or danger
  note?: string // one line shown on the caution screen
}

// Report tags that count as wildlife; the first list is dangerous on contact.
const DANGEROUS = ['alligator', 'snake', 'bear', 'wasp', 'hornet', 'bees']
const WILDLIFE = [...DANGEROUS, 'wildlife', 'animal', 'raccoon', 'boar', 'hog', 'deer', 'spider', 'fire ants']
const RECENT_MS = 2 * 60 * 60 * 1000

const f = (n: number) => Math.round(n)
const rank: Record<Status, number> = { info: 0, ok: 1, caution: 2, danger: 3 }
export const worst = (xs: Factor[]) => xs.reduce<Factor | undefined>((w, x) => (!w || rank[x.status] > rank[w.status] ? x : w), undefined)

export function buildFactors(s: Snapshot): Factor[] {
  const out: Factor[] = []
  const lightning = s.alert_type === 'stopwork'
  const miles = s.reason.match(/(\d+)\s*MI/)?.[1]

  // Weather. Heat index, NWS bands: 91+ extreme caution, 103+ danger.
  const hi = s.heat_index_f
  const heatStatus: Status = s.alert_type === 'heat_danger' || hi >= 103 ? 'danger' : hi >= 91 ? 'caution' : 'ok'
  out.push({ id: 'heat', group: 'weather', label: 'Heat index', value: `${f(hi)}°F`, status: heatStatus, tint: hazard.heat, note: `Heat index ${f(hi)}°F` })
  const tempF = s.temp_c * 9 / 5 + 32
  out.push({ id: 'temp', group: 'weather', label: 'Temperature', value: `${f(tempF)}°F`, status: tempF >= 95 ? 'caution' : 'info', tint: hazard.heat, note: `Air temperature ${f(tempF)}°F` })
  out.push({ id: 'humidity', group: 'weather', label: 'Humidity', value: `${f(s.humidity)}%`, status: 'info' })
  out.push({
    id: 'lightning', group: 'weather', label: 'Lightning', value: lightning ? `${miles ?? '?'} MI` : 'NONE',
    status: lightning ? 'danger' : 'ok', tint: hazard.stopwork, note: `Lightning ${miles ?? ''} mi, stop work`,
  })
  const flash = s.last_flash_ts ? new Date(s.last_flash_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NONE'
  out.push({ id: 'flash', group: 'weather', label: 'Last flash', value: flash, status: 'info' })

  // Water.
  const water = s.water_pct
  const waterStatus: Status = s.alert_type === 'flood_confirmed' || water >= 30 ? 'danger' : water > 0 ? 'caution' : 'ok'
  out.push({ id: 'water', group: 'water', label: 'Standing water', value: `${f(water)}%`, status: waterStatus, tint: hazard.flood, note: `Standing water ${f(water)}%` })
  out.push({
    id: 'flood', group: 'water', label: 'Flood warning', value: s.alert_type === 'flood_confirmed' ? 'ACTIVE' : 'NONE',
    status: s.alert_type === 'flood_confirmed' ? 'danger' : 'ok', tint: hazard.flood, note: 'Flood warning active',
  })

  // Wildlife, from hazard photo reports tagged with an animal in the last two hours.
  const sightings = s.reports.filter(
    (r) => WILDLIFE.includes(r.tag.toLowerCase()) && Date.now() - new Date(r.ts).getTime() < RECENT_MS,
  )
  const latest = sightings[0]
  const dangerous = sightings.some((r) => DANGEROUS.includes(r.tag.toLowerCase()))
  out.push({
    id: 'wildlife', group: 'wildlife', label: 'Sightings', value: latest ? latest.tag.toUpperCase() : 'NONE',
    status: dangerous ? 'danger' : latest ? 'caution' : 'ok', tint: hazard.wildlife,
    note: latest ? `${latest.tag[0].toUpperCase()}${latest.tag.slice(1)}: ${latest.description}` : '',
  })
  out.push({ id: 'reports', group: 'wildlife', label: 'Reports 2h', value: String(sightings.length), status: 'info' })

  // Equipment.
  const unsafe = s.alert_type === 'beacon_unsafe' || s.alert_type === 'estop'
  out.push({
    id: 'equipment', group: 'equipment', label: 'Equipment', value: s.interlock === 'locked' ? 'LOCKED' : 'RUNNING',
    status: s.interlock === 'locked' ? 'danger' : 'ok', tint: unsafe ? hazard.unsafe : hazard.stopwork,
    note: s.alert_type === 'estop' ? 'E-stop pressed, equipment locked' : 'Equipment power cut',
  })
  const tiltStatus: Status = s.alert_type === 'beacon_unsafe' || s.tilt > 15 ? 'danger' : s.tilt > 5 ? 'caution' : 'ok'
  out.push({ id: 'tilt', group: 'equipment', label: 'Beacon tilt', value: `${f(s.tilt)}°`, status: tiltStatus, tint: hazard.unsafe, note: `Beacon tilted ${f(s.tilt)}°` })
  out.push({ id: 'light', group: 'equipment', label: 'Light sensor', value: String(s.light), status: 'info' })

  // Site.
  out.push({
    id: 'zone', group: 'site', label: 'Work zone', value: s.zone_clear ? 'CLEAR' : 'OCCUPIED',
    status: !s.zone_clear && lightning ? 'danger' : 'info', tint: hazard.stopwork, note: 'Work zone occupied during stop work',
  })
  out.push({ id: 'radar', group: 'site', label: 'Radar range', value: s.radar.d ? `${f(s.radar.d)} cm` : 'NONE', status: 'info' })
  const crewIn = s.crew.filter((c) => c.in).length
  out.push({ id: 'crew', group: 'site', label: 'Crew on site', value: `${crewIn}/${s.crew.length}`, status: 'info' })
  out.push({
    id: 'link', group: 'site', label: 'Cloud link', value: s.online ? 'ONLINE' : 'OFFLINE',
    status: s.online ? 'ok' : 'caution', tint: color.offline, note: 'Offline, local rules active',
  })
  out.push({ id: 'briefing', group: 'site', label: 'Next briefing', value: s.next_briefing, status: 'info' })
  return out
}

export const isHazard = (x: Factor) => x.status === 'caution' || x.status === 'danger'
