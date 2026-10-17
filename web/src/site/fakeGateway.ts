// Fake site feed for the site page until the backend is reachable, a snapshot every 250 ms.
// ?fake=1      hazard showcase (showcase.ts), advances only while the screen is idle; &step=6 starts at step 6
// ?fake=storm  the stop work storm replay (fake-snapshots.json); &t=12 jumps to second 12
import script from './fake-snapshots.json'
import { allClear, steps, STEP_MS } from './showcase'
import type { Snapshot } from './types'

type Frame = { at: number; patch: Partial<Snapshot> }
const base = script.base as Snapshot

export function startFakeGateway(onSnapshot: (s: Snapshot) => void, mode: string) {
  return mode === 'storm' ? storm(onSnapshot) : showcase(onSnapshot)
}

function showcase(onSnapshot: (s: Snapshot) => void) {
  let elapsed = Number(new URLSearchParams(location.search).get('step') ?? 0) * STEP_MS
  let paused = true
  let last = Date.now()
  const emit = () => {
    const step = steps[Math.floor(elapsed / STEP_MS) % steps.length]
    onSnapshot({ ...base, ...allClear, ...step.patch() } as Snapshot)
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

  const timer = setInterval(() => onSnapshot(snapshotAt(((Date.now() - start) / 1000) % script.loop_s)), 250)
  return {
    stop: () => clearInterval(timer),
    setPaused: () => {},
  }
}
