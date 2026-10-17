// The site page's live view. Components read the snapshot from here and never open sockets.
// ?fake=1 (hazard showcase) or ?fake=storm feeds it from the fake; otherwise the backend
// (GET /sites/{id}, /muster and the site websocket, see live.ts).
import { create } from 'zustand'
import { startFakeGateway } from './fakeGateway'
import { startLiveSite } from './live'
import type { Snapshot } from './types'

type SiteStore = {
  snapshot: Snapshot | null
  live: boolean // a feed is connected
  connect: (siteId: number) => () => void
}

export const useSite = create<SiteStore>((set) => ({
  snapshot: null,
  live: false,
  connect: (siteId) => {
    const mode = new URLSearchParams(location.search).get('fake')
    set({ snapshot: null, live: false })
    if (mode === null) return startLiveSite(siteId, (snapshot) => set({ snapshot }), (live) => set({ live }))
    const fake = startFakeGateway((snapshot) => set({ snapshot, live: true }), mode, siteId)
    return fake.stop
  },
}))

export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
