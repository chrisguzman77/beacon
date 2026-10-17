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
const withLcd = (s: Snapshot): Snapshot => ({ ...s, lcd: lcdFor(s), index_reasons: s.index_reasons ?? reasonsFor(s) })

type Frame = { at: number; patch: Partial<Snapshot> }
const base = script.base as Snapshot

export const beaconSiteId = fakeSites.find((s) => s.beacon)!.site_id

export function startFakeGateway(onSnapshot: (s: Snapshot) => void, mode: string, siteId: number) {
  const site = fakeSites.find((s) => s.site_id === siteId) ?? fakeSites.find((s) => s.beacon)!
  const as = { id: site.site_id, name: site.name, beacon: site.beacon }
  return mode === 'storm' ? storm(onSnapshot, as) : showcase(onSnapshot, as)
}

function showcase(onSnapshot: (s: Snapshot) => void, site: Snapshot['site']) {
  const start = new URLSearchParams(location.search).get('step')
  const step = steps[(start === null ? site.id : Number(start)) % steps.length]
  const emit = () => onSnapshot(withLcd(drift({ ...base, ...allClear, ...step.patch(), site } as Snapshot)))
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
