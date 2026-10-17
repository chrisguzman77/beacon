// The kiosk's one socket, to the gateway on the same Pi (contracts/kiosk-ws.md).
// Components read the snapshot from here and never open sockets themselves.
// Add ?fake=1 (hazard showcase) or ?fake=storm to the URL to use the fake gateway instead.
import { create } from 'zustand'
import { startFakeGateway } from './fakeGateway'
import type { Snapshot, UpMessage } from './types'

type KioskStore = {
  snapshot: Snapshot | null
  gateway: boolean // socket to the Pi gateway is open
  send: (msg: UpMessage) => void
  setSimPaused: (paused: boolean) => void // fake gateway only: the showcase advances while idle
  connect: () => () => void
}

export const useKiosk = create<KioskStore>((set) => ({
  snapshot: null,
  gateway: false,
  send: () => {},
  setSimPaused: () => {},
  connect: () => {
    const mode = new URLSearchParams(location.search).get('fake')
    if (mode !== null) {
      const fake = startFakeGateway((snapshot) => set({ snapshot, gateway: true }), mode)
      set({ send: fake.send, setSimPaused: fake.setPaused })
      return fake.stop
    }

    let ws: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout>
    let stopped = false
    const open = () => {
      ws = new WebSocket(`ws://${location.host}/ws`)
      ws.onopen = () => set({ gateway: true })
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.kind === 'snapshot') set({ snapshot: msg })
      }
      ws.onclose = () => {
        set({ gateway: false })
        if (!stopped) retry = setTimeout(open, 1000)
      }
    }
    open()
    set({ send: (msg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg)) })
    return () => {
      stopped = true
      clearTimeout(retry)
      ws?.close()
    }
  },
}))

export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
