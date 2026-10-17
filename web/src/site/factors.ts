// Every factor the site view can determine, with its condition, cluster, limits and what it
// means for the crew. "info" is neutral data, "ok" is a monitored factor that is fine,
// "caution" and "danger" are hazards and carry the hazard's color.
// To add a factor: push it here with a group; the web places it automatically.
import { color, hazard } from '@/tokens'
import type { Snapshot } from './types'

export type Status = 'info' | 'ok' | 'caution' | 'danger'
export type Group = 'weather' | 'water' | 'wildlife' | 'equipment' | 'site' | 'crew'

export const groups: { id: Group; label: string }[] = [
  { id: 'weather', label: 'Weather' },
  { id: 'water', label: 'Water' },
  { id: 'wildlife', label: 'Wildlife' },
  { id: 'crew', label: 'Crew' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'site', label: 'Site' },
]

// Caution and danger limits on a 0..max scale, for the detail band and trend.
export type Bands = { caution: number; danger: number; max: number; unit: string }

export type Factor = {
  id: string
  group: Group
  label: string
  value: string
  status: Status
  tint?: string // hazard color when caution or danger
  note?: string // one line shown on the caution screen
  raw?: number // numeric reading, kept as history for the trend
  bands?: Bands
  guide: string // what it means for the crew
}

// Report tags that count as wildlife; the first list is dangerous on contact.
const DANGEROUS = ['alligator', 'snake', 'bear', 'wasp', 'hornet', 'bees']
const WILDLIFE = [...DANGEROUS, 'wildlife', 'animal', 'raccoon', 'boar', 'hog', 'deer', 'spider', 'fire ants']
const RECENT_MS = 2 * 60 * 60 * 1000

const f = (n: number) => Math.round(n)
const rank: Record<Status, number> = { info: 0, ok: 1, caution: 2, danger: 3 }
export const worst = (xs: Factor[]) => xs.reduce<Factor | undefined>((w, x) => (!w || rank[x.status] > rank[w.status] ? x : w), undefined)
const level = (v: number, b: Bands): Status => (v >= b.danger ? 'danger' : v >= b.caution ? 'caution' : 'ok')

export function buildFactors(s: Snapshot): Factor[] {
  const out: Factor[] = []
  const lightning = s.alert_type === 'stopwork'
  const miles = s.reason.match(/(\d+)\s*MI/)?.[1]

  // Weather. Heat index, NWS bands: 91+ extreme caution, 103+ danger.
  const hi = s.heat_index_f
  const heatB: Bands = { caution: 91, danger: 103, max: 130, unit: '°F' }
  if (Number.isFinite(hi)) out.push({
    id: 'heat', group: 'weather', label: 'Heat index', value: `${f(hi)}°F`, raw: hi, bands: heatB, tint: hazard.heat, note: `Heat index ${f(hi)}°F`,
    status: s.alert_type === 'heat_danger' ? 'danger' : s.alert_type === 'heat_warning' && level(hi, heatB) === 'ok' ? 'caution' : level(hi, heatB),
    guide: 'Above 91°F, water, rest and shade every hour. Above 103°F, heavy work stops in the hottest hours and buddies check each other every 15 minutes.',
  })
  const tempF = s.temp_c * 9 / 5 + 32
  if (Number.isFinite(tempF)) out.push({
    id: 'temp', group: 'weather', label: 'Temperature', value: `${f(tempF)}°F`, raw: tempF, status: tempF >= 95 ? 'caution' : 'info', tint: hazard.heat, note: `Air temperature ${f(tempF)}°F`,
    guide: 'Air temperature alone. The heat index, which adds humidity, is what sets work and rest cycles.',
  })
  if (Number.isFinite(s.humidity)) out.push({ id: 'humidity', group: 'weather', label: 'Humidity', value: `${f(s.humidity)}%`, raw: s.humidity, status: 'info', guide: 'High humidity stops sweat from cooling the body and pushes the heat index up.' })
  out.push({
    id: 'lightning', group: 'weather', label: 'Lightning', value: lightning ? `${miles ?? '?'} MI` : 'NONE',
    status: lightning ? 'danger' : 'ok', tint: hazard.stopwork, note: `Lightning ${miles ?? ''} mi, stop work`,
    guide: 'A strike within 10 miles stops work for 30 minutes and every new strike restarts the clock. Shelter in a vehicle or building, never under trees or equipment.',
  })
  if (s.wind_gust_mph !== undefined) {
    const b: Bands = { caution: 25, danger: 35, max: 60, unit: 'mph' }
    out.push({
      id: 'wind', group: 'weather', label: 'Wind gust', value: `${f(s.wind_gust_mph)} MPH`, raw: s.wind_gust_mph, bands: b, status: level(s.wind_gust_mph, b), tint: hazard.heat, note: `Wind gusts ${f(s.wind_gust_mph)} mph`,
      guide: 'Above 25 mph, secure loose material and stop aerial lift work. Above 35 mph, no crane picks or work at height.',
    })
  }
  if (s.precip_24h_in !== undefined) {
    const b: Bands = { caution: 1, danger: 3, max: 6, unit: 'in' }
    out.push({
      id: 'rain', group: 'weather', label: 'Rain 24h', value: `${s.precip_24h_in.toFixed(1)} IN`, raw: s.precip_24h_in, bands: b, status: level(s.precip_24h_in, b), tint: hazard.flood, note: `${s.precip_24h_in.toFixed(1)} in of rain in 24 h`,
      guide: 'Heavy rain saturates soil and floods low access roads. Check trenches and the way out before anyone goes in.',
    })
  }
  const flash = s.last_flash_ts ? new Date(s.last_flash_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NONE'
  out.push({ id: 'flash', group: 'weather', label: 'Last flash', value: flash, status: 'info', guide: "When the beacon's light sensor last saw a lightning flash." })

  // Water.
  const waterB: Bands = { caution: 1, danger: 30, max: 100, unit: '%' }
  if (Number.isFinite(s.water_pct)) out.push({
    id: 'water', group: 'water', label: 'Standing water', value: `${f(s.water_pct)}%`, raw: s.water_pct, bands: waterB, tint: hazard.flood, note: `Standing water ${f(s.water_pct)}%`,
    status: s.alert_type === 'flood_confirmed' ? 'danger' : level(s.water_pct, waterB),
    guide: 'Water at the beacon. Any water is a slip and electrical risk near equipment; above 30% treat it as flooding.',
  })
  out.push({
    id: 'flood', group: 'water', label: 'Flood warning', value: s.alert_type === 'flood_confirmed' ? 'CONFIRMED' : s.alert_type === 'flood_warning' ? 'WARNING' : 'NONE',
    status: s.alert_type === 'flood_confirmed' ? 'danger' : s.alert_type === 'flood_warning' ? 'caution' : 'ok', tint: hazard.flood,
    note: s.alert_type === 'flood_confirmed' ? 'Flood confirmed at the site' : 'Flood warning: heavy rain and a rising river',
    guide: 'A confirmed flood means moving equipment to high ground and keeping crews out of low areas.',
  })
  if (s.soil_pct !== undefined) {
    const b: Bands = { caution: 70, danger: 90, max: 100, unit: '%' }
    out.push({
      id: 'soil', group: 'water', label: 'Soil saturation', value: `${f(s.soil_pct)}%`, raw: s.soil_pct, bands: b, status: level(s.soil_pct, b), tint: hazard.flood, note: `Soil ${f(s.soil_pct)}% saturated`,
      guide: 'Saturated soil collapses trench walls and softens outrigger footing. Above 70%, inspect shoring; above 90%, no trench entry.',
    })
  }
  if (s.river_stage_ft !== undefined && s.river_flood_ft !== undefined) {
    const b: Bands = { caution: s.river_flood_ft - 1, danger: s.river_flood_ft, max: s.river_flood_ft + 5, unit: 'ft' }
    out.push({
      id: 'river', group: 'water', label: 'River stage', value: `${s.river_stage_ft.toFixed(1)} FT`, raw: s.river_stage_ft, bands: b, status: level(s.river_stage_ft, b), tint: hazard.flood,
      note: `River ${s.river_stage_ft.toFixed(1)} ft, flood stage ${s.river_flood_ft} ft`,
      guide: `Flood stage here is ${s.river_flood_ft} ft. Within a foot of it, watch for rising water; at flood stage, clear the low areas.`,
    })
  }
  if (s.flood_zone) {
    const high = /^(A|V)/i.test(s.flood_zone)
    out.push({
      id: 'zone_fema', group: 'water', label: 'Flood zone', value: s.flood_zone.toUpperCase(), status: high ? 'caution' : 'ok', tint: hazard.flood, note: `FEMA flood zone ${s.flood_zone}`,
      guide: 'FEMA flood zone for the site. Zones starting with A or V are high risk: plan the escape route before work starts.',
    })
  }

  // Wildlife, from hazard photo reports tagged with an animal in the last two hours.
  const sightings = s.reports.filter((r) => WILDLIFE.includes(r.tag.toLowerCase()) && Date.now() - new Date(r.ts).getTime() < RECENT_MS)
  const latest = sightings[0]
  const dangerous = sightings.some((r) => DANGEROUS.includes(r.tag.toLowerCase()))
  out.push({
    id: 'wildlife', group: 'wildlife', label: 'Sightings', value: latest ? latest.tag.toUpperCase() : 'NONE',
    status: dangerous ? 'danger' : latest ? 'caution' : 'ok', tint: hazard.wildlife,
    note: latest ? `${latest.tag[0].toUpperCase()}${latest.tag.slice(1)}: ${latest.description}` : '',
    guide: latest
      ? `Latest report: ${latest.tag}, ${latest.description}. Keep your distance, report it, and never work alone near water edges.`
      : 'Animal reports from crew photos in the last two hours. Alligators, snakes and stinging insects count as danger.',
  })
  out.push({ id: 'reports', group: 'wildlife', label: 'Reports 2h', value: String(sightings.length), raw: sightings.length, status: 'info', guide: 'Wildlife photo reports filed for this site in the last two hours.' })

  // Crew: the count plus one node per member.
  const crewIn = s.crew.filter((c) => c.in).length
  out.push({ id: 'crew', group: 'crew', label: 'Checked in', value: `${crewIn}/${s.crew.length}`, raw: crewIn, status: 'info', guide: "Crew checked in today, on the phone crew page or with the beacon's remote." })
  for (const c of s.crew) {
    const exposed = c.in && lightning
    out.push({
      id: `crew:${c.id}`, group: 'crew', label: c.name, value: c.in ? 'IN' : 'OUT',
      status: exposed ? 'danger' : c.in ? 'ok' : 'info', tint: hazard.stopwork, note: `${c.name} still checked in during stop work`,
      guide: c.in
        ? 'Checked in on site. During stop work, everyone checked in has to be out of the zone and accounted for.'
        : 'Not on site. Check in on the phone crew page, or press your number on the beacon remote.',
    })
  }

  // Equipment.
  const unsafe = s.alert_type === 'beacon_unsafe' || s.alert_type === 'estop'
  out.push({
    id: 'equipment', group: 'equipment', label: 'Equipment', value: s.interlock === 'locked' ? 'LOCKED' : 'RUNNING',
    status: s.interlock === 'locked' ? 'danger' : 'ok', tint: unsafe ? hazard.unsafe : hazard.stopwork,
    note: s.alert_type === 'estop' ? 'E-stop pressed, equipment locked' : 'Equipment power cut',
    guide: 'Equipment power. LOCKED means the beacon has cut the motor; only the supervisor PIN on the remote restores it.',
  })
  const tiltB: Bands = { caution: 5, danger: 15, max: 45, unit: '°' }
  if (Number.isFinite(s.tilt)) out.push({
    id: 'tilt', group: 'equipment', label: 'Beacon tilt', value: `${f(s.tilt)}°`, raw: s.tilt, bands: tiltB, tint: hazard.unsafe, note: `Beacon tilted ${f(s.tilt)}°`,
    status: s.alert_type === 'beacon_unsafe' ? 'danger' : level(s.tilt, tiltB),
    guide: 'The beacon should stand level. Above 5°, check the mount; above 15°, its sensors cannot be trusted.',
  })
  if (Number.isFinite(s.light)) out.push({ id: 'light', group: 'equipment', label: 'Light sensor', value: String(s.light), raw: s.light, status: 'info', guide: 'Raw light sensor reading the beacon uses to catch lightning flashes.' })

  // Site.
  out.push({
    id: 'zone', group: 'site', label: 'Work zone', value: s.zone_clear ? 'CLEAR' : 'OCCUPIED',
    status: !s.zone_clear && lightning ? 'danger' : 'info', tint: hazard.stopwork, note: 'Work zone occupied during stop work',
    guide: "The radar's view of the work zone. During stop work it has to read CLEAR.",
  })
  out.push({ id: 'radar', group: 'site', label: 'Radar range', value: s.radar.d ? `${f(s.radar.d)} cm` : 'NONE', raw: s.radar.d, status: 'info', guide: 'Distance to the nearest person the radar sees.' })
  out.push({
    id: 'link', group: 'site', label: 'Cloud link', value: s.online ? 'ONLINE' : 'OFFLINE',
    status: s.online ? 'ok' : 'caution', tint: color.offline, note: 'Offline, local rules active',
    guide: 'The beacon’s link to the cloud. Offline, it keeps enforcing stop work on its own and sends the events when it reconnects.',
  })
  out.push({ id: 'briefing', group: 'site', label: 'Next briefing', value: s.next_briefing, status: 'info', guide: "Tomorrow's briefing, in English and Spanish, is generated at 6 PM site time." })
  return out
}

export const isHazard = (x: Factor) => x.status === 'caution' || x.status === 'danger'
