// REST and websocket access to the backend (contracts/api.md). Shapes follow what core returns.

export const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const WS = API.replace(/^http/, 'ws')

export type Alert = {
  alert_id: number
  site_id: number
  type: string // stopwork | heat_danger | heat_warning | flood_confirmed | flood_warning | beacon_unsafe | estop | wildlife
  started: string
  expires: string | null
  cleared: string | null
  cleared_by?: string | null
  payload: Record<string, unknown>
  awaiting_clear: boolean
}

export type SiteRow = {
  site_id: number
  name: string
  state: string
  county: string
  lat: number
  lon: number
  tz: string
  tech: string
  mw: number
  coastal: boolean
  river: boolean
  beacon: boolean
  index: number | null
  alerts: Alert[]
  crew_on_site: number
}

export async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`)
  if (!r.ok) throw new Error(`${path} answered ${r.status}`)
  return r.json()
}
