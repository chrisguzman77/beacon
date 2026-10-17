// Stands in for the Pi gateway until it exists: replays fake-snapshots.json and
// sends a snapshot every 250 ms, as the contract requires while counting.
import script from './fake-snapshots.json'
import type { Snapshot, UpMessage } from './types'

type Frame = { at: number; patch: Partial<Snapshot> }

export function startFakeGateway(onSnapshot: (s: Snapshot) => void) {
  const frames = script.frames as Frame[]
  // ?fake=1&t=12 starts the replay at second 12, handy for jumping to a screen.
  const offset = Number(new URLSearchParams(location.search).get('t') ?? 0)
  const start = Date.now() - offset * 1000

  function snapshotAt(t: number): Snapshot {
    let s = { ...(script.base as Snapshot) }
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

  const timer = setInterval(() => {
    const t = ((Date.now() - start) / 1000) % script.loop_s
    onSnapshot(snapshotAt(t))
  }, 250)

  return {
    send(msg: UpMessage) {
      console.info('[fake gateway] up', msg)
    },
    stop() {
      clearInterval(timer)
    },
  }
}
