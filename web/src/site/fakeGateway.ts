// Fake site feed for the site page until the backend is reachable, a snapshot every 250 ms.
// ?fake=1      hazard showcase (showcase.ts): each site shows one hazard step; &step=6 picks step 6.
//              Each site starts on its own step (site id), named from the real 50 sites.
// ?fake=storm  the stop work storm replay (fake-snapshots.json); &t=12 jumps to second 12
import script from './fake-snapshots.json'
import fakeSites from '@/dashboard/fake-sites.json'
import { allClear, drift, steps } from '@/sweet-treats/showcase'
import type { Snapshot } from './types'
import { formatCountdown } from './store'
import { buildFactors, isHazard } from './factors'

// The beacon LCD1602's two 16 character lines, as the firmware would show them.
const pad = (t: string) => t.slice(0, 16).padEnd(16)
function lcdFor(s: Snapshot): string[] {
  if (s.awaiting_clear) return [pad('STOP WORK'), pad('ENTER PIN')]
  if (s.countdown > 0) return [pad('STOP WORK'), pad(`${s.reason.replace('LIGHTNING', 'LTNG')} ${formatCountdown(s.countdown)}`)]
  if (s.interlock === 'locked' || s.alert_type === 'stopwork') return [pad('STOP WORK'), pad(s.reason || 'LOCKED OUT')]
  return [pad(`ALL CLEAR IDX ${s.index}`), pad(`CREW ${s.crew.filter((c) => c.in).length}   ${s.next_briefing}`)]
}
// The model's three reasons, faked from the readings: hazards first, then the usual drivers.
function reasonsFor(s: Snapshot): string[] {
  const hz = buildFactors(s).filter(isHazard).map((f) => f.note ?? f.label)
  const usual = [`Heat index ${Math.round(s.heat_index_f)}°F`, `Gusts ${Math.round((s.wind_gust_mph ?? 0) * 1.609)} km/h`, `Soil moisture ${((s.soil_pct ?? 0) / 100).toFixed(2)}`]
  return [...new Set([...hz, ...usual])].slice(0, 3)
}
// Two past stop works for the compliance log: one released by the supervisor after three strikes,
// one that ran out yesterday.
const loaded = Date.now()
const at = (minAgo: number) => new Date(loaded - minAgo * 60_000).toISOString()
const strike = (minAgo: number, miles: number) => ({ ts: at(minAgo), source: 'beacon', distance_m: Math.round(miles * 1609) })
const fakeLog = (siteId: number) => [
  { alert_id: 9101, site_id: siteId, type: 'stopwork', started: at(190), expires: at(132), cleared: at(150), cleared_by: 'Maria Lopez', awaiting_clear: false,
    payload: { resets: 2, history: [strike(190, 8), strike(176, 6), strike(162, 4)] } },
  { alert_id: 9102, site_id: siteId, type: 'stopwork', started: at(1500), expires: at(1470), cleared: null, cleared_by: null, awaiting_clear: false,
    payload: { resets: 0, history: [strike(1500, 9)] } },
]
// What the Roblox twin's storm scenario sent, for the scenario panel.
const fakeSim: Snapshot['sim'] = [
  { ts: at(162), kind: 'strike', text: 'Strike 4 mi from the site' },
  { ts: at(176), kind: 'strike', text: 'Strike 6 mi from the site' },
  { ts: at(180), kind: 'weather', text: '88°F, 74% humidity, gusts 31 mph, 6 mm rain' },
  { ts: at(190), kind: 'strike', text: 'Strike 8 mi from the site' },
]
const withLcd = (s: Snapshot): Snapshot => ({ ...s, lcd: lcdFor(s), index_reasons: s.index_reasons ?? reasonsFor(s), alert_log: s.alert_log ?? fakeLog(s.site.id), sim: s.sim ?? fakeSim })

type Frame = { at: number; patch: Partial<Snapshot> }
const base = script.base as Snapshot

export const beaconSiteId = fakeSites.find((s) => s.beacon)!.site_id

export function startFakeGateway(onSnapshot: (s: Snapshot) => void, mode: string, siteId: number) {
  const site = fakeSites.find((s) => s.site_id === siteId) ?? fakeSites.find((s) => s.beacon)!
  const as = { id: site.site_id, name: site.name, beacon: site.beacon, lat: site.lat, lon: site.lon }
  return mode === 'storm' ? storm(onSnapshot, as) : showcase(onSnapshot, as)
}

// Located demo reports around the site: the step's own (the wildlife step's alligator) plus two older
// ones (past the 2 h wildlife window, so they pin but do not raise a hazard).
function located(site: Snapshot['site'], reports: Snapshot['reports']): Snapshot['reports'] {
  const lat = site.lat ?? 0
  const lon = site.lon ?? 0
  const at = (north_m: number, east_m: number) => ({ lat: lat + north_m / 110540, lon: lon + east_m / (111320 * Math.cos((lat * Math.PI) / 180)) })
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  return [
    ...reports.map((r, i) => ({ report_id: 950 + i, confidence: 0.91, ...at(95, 120), ...r })),
    { report_id: 901, tag: 'downed_line', description: 'Low hanging conductor across the access road after last night’s wind.', ts: ago(3), confidence: 0.84, ...at(210, -70) },
    { report_id: 902, tag: 'snake', description: 'Water moccasin under the pipe rack, moved off toward the ditch.', ts: ago(5), confidence: 0.77, ...at(-140, 160) },
  ]
}

function showcase(onSnapshot: (s: Snapshot) => void, site: Snapshot['site']) {
  const start = new URLSearchParams(location.search).get('step')
  const step = steps[(start === null ? site.id : Number(start)) % steps.length]
  const emit = () => {
    const s = { ...base, ...allClear, ...step.patch(), site } as Snapshot
    onSnapshot(withLcd(drift({ ...s, reports: located(site, s.reports) })))
  }
  const timer = setInterval(emit, 250)
  emit()
  return { stop: () => clearInterval(timer) }
}

function storm(onSnapshot: (s: Snapshot) => void, site: Snapshot['site']) {
  const frames = script.frames as Frame[]
  const offset = Number(new URLSearchParams(location.search).get('t') ?? 0)
  const start = Date.now() - offset * 1000

  function snapshotAt(t: number): Snapshot {
    let s = { ...base }
    let setCountdown = 0
    let setAt = 0
    for (const f of frames) {
      if (f.at > t) break
      s = { ...s, ...f.patch }
      if (f.patch.countdown !== undefined) {
        setCountdown = f.patch.countdown
        setAt = f.at
      }
    }
    s.countdown = Math.max(0, setCountdown - Math.floor((t - setAt) * s.demo_scale))
    return s
  }

  const timer = setInterval(() => onSnapshot(withLcd({ ...snapshotAt(((Date.now() - start) / 1000) % script.loop_s), site })), 250)
  return {
    stop: () => clearInterval(timer),
  }
}
