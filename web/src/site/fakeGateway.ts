// Fake site feed for the site page until the backend is reachable, a snapshot every 250 ms.
// ?fake=1      hazard showcase (showcase.ts), advances only while the screen is idle; &step=6 starts at step 6.
//              Each site starts on its own step (site id), named from the real 50 sites.
// ?fake=storm  the stop work storm replay (fake-snapshots.json); &t=12 jumps to second 12
import script from './fake-snapshots.json'
import fakeSites from '@/dashboard/fake-sites.json'
import { allClear, drift, steps, STEP_MS } from '@/sweet-treats/showcase'
import type { Snapshot } from './types'
import { formatCountdown } from './store'

// The beacon LCD1602's two 16 character lines, as the firmware would show them.
const pad = (t: string) => t.slice(0, 16).padEnd(16)
function lcdFor(s: Snapshot): string[] {
  if (s.awaiting_clear) return [pad('STOP WORK'), pad('ENTER PIN')]
  if (s.countdown > 0) return [pad('STOP WORK'), pad(`${s.reason.replace('LIGHTNING', 'LTNG')} ${formatCountdown(s.countdown)}`)]
  if (s.interlock === 'locked' || s.alert_type === 'stopwork') return [pad('STOP WORK'), pad(s.reason || 'LOCKED OUT')]
  return [pad(`ALL CLEAR IDX ${s.index}`), pad(`CREW ${s.crew.filter((c) => c.in).length}   ${s.next_briefing}`)]
}
const withLcd = (s: Snapshot): Snapshot => ({ ...s, lcd: lcdFor(s) })

type Frame = { at: number; patch: Partial<Snapshot> }
const base = script.base as Snapshot

export const beaconSiteId = fakeSites.find((s) => s.beacon)!.site_id

export function startFakeGateway(onSnapshot: (s: Snapshot) => void, mode: string, siteId: number) {
  const site = fakeSites.find((s) => s.site_id === siteId) ?? fakeSites.find((s) => s.beacon)!
  return mode === 'storm' ? storm(onSnapshot) : showcase(onSnapshot, { id: site.site_id, name: site.name, beacon: site.beacon })
}

function showcase(onSnapshot: (s: Snapshot) => void, site: Snapshot['site']) {
  const start = new URLSearchParams(location.search).get('step')
  let elapsed = (start === null ? site.id % steps.length : Number(start)) * STEP_MS
  let paused = true
  let last = Date.now()
  const emit = () => {
    const step = steps[Math.floor(elapsed / STEP_MS) % steps.length]
    onSnapshot(withLcd(drift({ ...base, ...allClear, ...step.patch(), site } as Snapshot)))
  }
  const timer = setInterval(() => {
    const t = Date.now()
    if (!paused) elapsed += t - last
    last = t
    emit()
  }, 250)
  emit()
  return {
    stop: () => clearInterval(timer),
    setPaused(p: boolean) {
      // Resuming jumps to the next step so the idle caution flash lines up with it.
      if (paused && !p && elapsed > 0) elapsed = Math.ceil(elapsed / STEP_MS) * STEP_MS
      paused = p
      last = Date.now()
      emit()
    },
  }
}

function storm(onSnapshot: (s: Snapshot) => void) {
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

  const timer = setInterval(() => onSnapshot(withLcd(snapshotAt(((Date.now() - start) / 1000) % script.loop_s))), 250)
  return {
    stop: () => clearInterval(timer),
    setPaused: () => {},
  }
}
