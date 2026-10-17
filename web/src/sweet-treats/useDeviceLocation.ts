import { useEffect, useState } from 'react'
import type { SiteRow } from '@/api'

// The browser's location (asked once per visit) and the site nearest to it, so the dashboard
// opens on where the supervisor is. Null until the browser answers; stays null if refused.

export type LatLon = { lat: number; lon: number }
let known: LatLon | null = null
let asked = false
const listeners = new Set<(p: LatLon) => void>()

export function useDeviceLocation() {
  const [pos, setPos] = useState<LatLon | null>(known)
  useEffect(() => {
    listeners.add(setPos)
    if (!asked && 'geolocation' in navigator) {
      asked = true
      navigator.geolocation.getCurrentPosition(
        (p) => {
          known = { lat: p.coords.latitude, lon: p.coords.longitude }
          listeners.forEach((l) => l(known!))
        },
        () => {},
        { timeout: 10_000, maximumAge: 600_000 },
      )
    }
    return () => void listeners.delete(setPos)
  }, [])
  return pos
}

// Great circle distance in miles.
export function miles(a: LatLon, b: LatLon) {
  const rad = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2
  return 7918 * Math.asin(Math.sqrt(h))
}

export function nearest(sites: SiteRow[], p: LatLon) {
  return sites.reduce<SiteRow | undefined>((best, s) => (!best || miles(p, s) < miles(p, best) ? s : best), undefined)
}
