// Live feed for HUB: GET /sites/{id}, /muster and /index/explain once, then the site websocket keeps the view
// current (contracts/api.md, gateway-ws.md). Readings the backend has not sent yet stay NaN
// and their factors are left out rather than shown as zero.
import { get, WS } from '@/api'
import type { Alert } from '@/api'
import type { Report, Snapshot } from './types'

type Device = { led?: Snapshot['led']; countdown?: number; index?: number; interlock?: Snapshot['interlock']; presence?: boolean; online?: boolean; lcd?: string[] }
type Muster = { in: string[]; out: string[]; zone_clear: boolean }
type Explain = { index: number; top_features: { label: string }[]; sentence: string }
type Detail = {
  site_id: number
  name: string
  beacon: boolean
  lat: number
  lon: number
  alerts: Alert[]
  alert_history?: Alert[]
  index: { index: number; top_features?: { label: string }[] } | null
  briefing: { english: string; spanish: string; for_date: string; payload?: Record<string, number | string> } | null
  reports: Report[]
  device: Device
}

// Highest priority open alert decides the alarm reason and color.
const ORDER = ['stopwork', 'estop', 'beacon_unsafe', 'flood_confirmed', 'heat_danger', 'flood_warning', 'heat_warning']

function reasonOf(a?: Alert) {
  if (!a) return ''
  const p = a.payload as Record<string, number | undefined>
  if (a.type === 'stopwork') return p.distance_m ? `LIGHTNING ${Math.round(p.distance_m / 1609)} MI` : 'LIGHTNING'
  if (a.type === 'heat_danger') return p.heat_index_f ? `HEAT INDEX ${Math.round(p.heat_index_f)}` : 'HEAT DANGER'
  if (a.type === 'flood_confirmed') return 'FLOOD CONFIRMED'
  if (a.type === 'flood_warning') return 'FLOOD WARNING'
  if (a.type === 'heat_warning') return p.heat_index_f ? `HEAT INDEX ${Math.round(p.heat_index_f)}` : 'HEAT WARNING'
  if (a.type === 'estop') return 'E-STOP PRESSED'
  return a.type.replace(/_/g, ' ').toUpperCase()
}

export function startLiveSite(siteId: number, onSnapshot: (s: Snapshot) => void, onStatus: (live: boolean) => void) {
  let stopped = false
  let ws: WebSocket | null = null
  let retry: ReturnType<typeof setTimeout>
  let detail: Detail | null = null
  let device: Device = {}
  let muster: Muster = { in: [], out: [], zone_clear: true }
  let cond: Partial<Snapshot> = {}
  let explain: Explain | null = null

  const emit = () => {
    if (!detail) return
    const alerts = detail.alerts.filter((a) => !a.cleared)
    const top = ORDER.map((t) => alerts.find((a) => a.type === t)).find(Boolean)
    const crew = [...muster.in.map((name) => ({ name, in: true })), ...muster.out.map((name) => ({ name, in: false }))].map((c, i) => ({ id: i + 1, ...c }))
    onSnapshot({
      kind: 'snapshot',
      site: { id: detail.site_id, name: detail.name, beacon: detail.beacon, lat: detail.lat, lon: detail.lon },
      online: device.online ?? false,
      led: device.led ?? 'green',
      countdown: detail.beacon ? (device.countdown ?? 0) : 0,
      reason: reasonOf(top),
      alert_type: (top?.type ?? '') as Snapshot['alert_type'],
      alert_id: top?.alert_id,
      interlock: detail.beacon ? (device.interlock ?? 'running') : 'running',
      awaiting_clear: alerts.some((a) => a.type === 'stopwork' && a.awaiting_clear),
      presence: device.presence ?? false,
      zone_clear: muster.zone_clear,
      index: explain?.index ?? detail.index?.index ?? device.index ?? 0,
      index_reason: explain?.sentence || (top ? reasonOf(top).toLowerCase().replace(/^./, (c) => c.toUpperCase()) : 'From the trained model, updated daily'),
      index_reasons: (explain?.top_features ?? detail.index?.top_features ?? []).map((f) => f.label).slice(0, 3),
      heat_index_f: NaN, temp_c: NaN, humidity: NaN, water_pct: NaN, tilt: NaN, light: NaN,
      radar: { d: 0, s: 0, m: 0 },
      last_flash_ts: '',
      crew,
      briefing: detail.briefing ?? { english: '', spanish: '', for_date: '' },
      next_briefing: '18:00',
      reports: detail.reports,
      report_url: '',
      demo_scale: 1,
      lcd: device.lcd,
      // Open alerts (kept current by the websocket) over the history from GET /sites/{id}, newest first.
      alert_log: [...new Map([...(detail.alert_history ?? []), ...detail.alerts].map((a) => [a.alert_id, a])).values()].sort((a, b) => b.started.localeCompare(a.started)),
      ...cond,
    })
  }

  const open = () => {
    if (stopped) return
    ws = new WebSocket(`${WS}/ws/site/${siteId}`)
    ws.onopen = () => onStatus(true)
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (!detail) return
      if (m.type === 'alert') detail.alerts = [...detail.alerts.filter((a) => a.alert_id !== m.alert.alert_id), m.alert]
      else if (m.type === 'device') device = { ...device, ...m }
      else if (m.type === 'count') device = { ...device, countdown: m.seconds ?? 0 }
      else if (m.type === 'report') detail.reports = [m as Report, ...detail.reports.filter((r) => r.report_id !== m.report_id)]
      else if (m.type === 'briefing') detail.briefing = { english: m.english ?? '', spanish: m.spanish ?? '', for_date: m.for_date ?? '', payload: m.payload }
      else if (m.type === 'muster') muster = { in: m.in ?? [], out: m.out ?? [], zone_clear: !!m.zone_clear }
      else if (m.type === 'conditions')
        cond = {
          ...cond,
          ...(m.heat_index_f != null && { heat_index_f: m.heat_index_f }),
          ...(m.temp_c != null && { temp_c: m.temp_c }),
          ...(m.humidity != null && { humidity: m.humidity }),
          ...(m.water_depth_mm != null && { water_pct: m.water_depth_mm }),
          ...(m.wind_gust_kmh != null && { wind_gust_mph: m.wind_gust_kmh / 1.609 }),
          ...(m.gust != null && { wind_gust_mph: m.gust }),
        }
      emit()
    }
    ws.onclose = () => {
      onStatus(false)
      if (!stopped) retry = setTimeout(open, 2000)
    }
  }

  Promise.all([
    get<Detail>(`/sites/${siteId}`),
    get<Muster>(`/sites/${siteId}/muster`).catch(() => muster),
    get<Explain>(`/sites/${siteId}/index/explain`).catch(() => null),
  ])
    .then(([d, m, x]) => {
      if (stopped) return
      detail = d
      explain = x
      device = d.device ?? {}
      muster = m
      emit()
      open()
    })
    .catch(() => onStatus(false))

  return () => {
    stopped = true
    clearTimeout(retry)
    ws?.close()
  }
}
