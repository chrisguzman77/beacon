// The site page's live view. Components read the snapshot from here and never open sockets.
// ?fake=1 (hazard showcase) or ?fake=storm feeds it from the fake; the site API and
// websocket wiring replaces the empty branch when the site page is built.
import { create } from 'zustand'
import { startFakeGateway } from './fakeGateway'
import type { Snapshot } from './types'

type SiteStore = {
  snapshot: Snapshot | null
  live: boolean // a feed is connected
  setSimPaused: (paused: boolean) => void // fake only: the showcase advances while idle
  connect: (siteId: number) => () => void
}

export const useSite = create<SiteStore>((set) => ({
  snapshot: null,
  live: false,
  setSimPaused: () => {},
  connect: (siteId) => {
    const mode = new URLSearchParams(location.search).get('fake')
    if (mode === null) return () => {}
    const fake = startFakeGateway((snapshot) => set({ snapshot, live: true }), mode, siteId)
    set({ setSimPaused: fake.setPaused })
    return fake.stop
  },
}))

export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
