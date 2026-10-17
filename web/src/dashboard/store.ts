// Dashboard data: every site from GET /sites, refreshed every 15 s, plus the beacon site's
// websocket so its alerts land instantly (the live re-sort the room watches).
// `selected` is shared with HUB: whatever is picked on the dashboard is what HUB opens.
// ?fake=1 uses the real 50 sites with made up indexes and a strike on the beacon site every 30 s.
import { create } from 'zustand'
import { get, WS } from '@/api'
import type { Alert, SiteRow } from '@/api'
import fakeSites from './fake-sites.json'

type Status = 'loading' | 'ready' | 'error'

type DashStore = {
  sites: SiteRow[]
  status: Status
  error: string
  selected: number | null
  picked: boolean // a person chose `selected`; automatic picks (device location, beacon site) never override it
  select: (id: number | null, auto?: boolean) => void
  released: (alertId: number) => void // mark an alert cleared right away (fake mode; live waits for the websocket)
  connect: () => () => void
}

const isStop = (s: SiteRow) => s.alerts.some((a) => a.type === 'stopwork')

// Active stop work first, then hazard index, then crew on site.
export function rank(sites: SiteRow[]) {
  return [...sites].sort(
    (a, b) => Number(isStop(b)) - Number(isStop(a)) || (b.index ?? -1) - (a.index ?? -1) || b.crew_on_site - a.crew_on_site,
  )
}

function upsertAlert(sites: SiteRow[], a: Alert) {
  return sites.map((s) =>
    s.site_id !== a.site_id ? s : { ...s, alerts: a.cleared ? s.alerts.filter((x) => x.alert_id !== a.alert_id) : [...s.alerts.filter((x) => x.alert_id !== a.alert_id), a] },
  )
}

export const useDash = create<DashStore>((set, getState) => ({
  sites: [],
  status: 'loading',
  error: '',
  selected: null,
  picked: false,
  released: (alertId) =>
    set({ sites: getState().sites.map((s) => ({ ...s, alerts: s.alerts.filter((a) => a.alert_id !== alertId) })) }),
  select: (selected, auto = false) => {
    if (auto && getState().picked) return
    set({ selected, picked: getState().picked || !auto })
  },
  connect: () => {
    if (new URLSearchParams(location.search).has('fake')) return fake(set, getState)

    let stopped = false
    let ws: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout>

    const load = async () => {
      try {
        const sites = await get<SiteRow[]>('/sites')
        set({ sites, status: 'ready', error: '' })
        if (!ws) openBeacon(sites.find((s) => s.beacon)?.site_id)
      } catch (e) {
        if (getState().status !== 'ready') set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    }

    const openBeacon = (id?: number) => {
      if (!id || stopped) return
      ws = new WebSocket(`${WS}/ws/site/${id}`)
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.type === 'alert') set({ sites: upsertAlert(getState().sites, m.alert) })
        // The beacon's measured heat index (pod readings, or the Roblox twin's weather) for its row.
        if (m.type === 'conditions' && m.heat_index_f != null)
          set({ sites: getState().sites.map((s) => (s.site_id === id ? { ...s, measured_hi: m.heat_index_f } : s)) })
        if (m.type === 'muster' && Array.isArray(m.in))
          set({ sites: getState().sites.map((s) => (s.site_id === id ? { ...s, crew_on_site: m.in.length } : s)) })
      }
      ws.onclose = () => {
        ws = null
        if (!stopped) retry = setTimeout(() => openBeacon(id), 2000)
      }
    }

    load()
    const poll = setInterval(load, 15_000)
    return () => {
      stopped = true
      clearInterval(poll)
      clearTimeout(retry)
      ws?.close()
    }
  },
}))

type Set = (p: Partial<DashStore>) => void
function fake(set: Set, getState: () => DashStore) {
  set({ sites: (fakeSites as SiteRow[]).map((s) => (s.beacon ? { ...s, measured_hi: 96 } : s)), status: 'ready' })
  const beacon = (fakeSites as SiteRow[]).find((s) => s.beacon)!
  let n = 0
  const strike = () => {
    n += 1
    const a: Alert = {
      alert_id: n, site_id: beacon.site_id, type: 'stopwork', started: new Date().toISOString(),
      expires: new Date(Date.now() + 30 * 60_000).toISOString(), cleared: null, payload: { miles: 8 }, awaiting_clear: false,
    }
    set({ sites: upsertAlert(getState().sites, a) })
    setTimeout(() => set({ sites: upsertAlert(getState().sites, { ...a, cleared: new Date().toISOString() }) }), 12_000)
  }
  const first = setTimeout(strike, 4000)
  const every = setInterval(strike, 30_000)
  return () => {
    clearTimeout(first)
    clearInterval(every)
  }
}
