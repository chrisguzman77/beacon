import { useEffect, useRef } from 'react'
import { buildFactors } from '@/site/factors'
import type { Point } from '@/site/FactorDetail'
import type { Snapshot } from '@/site/types'

// Keeps one reading a second per numeric factor for the detail trend (last 3 minutes),
// starting over when the site changes.
export function useFactorHistory(siteId: number, snapshot: Snapshot | null) {
  const history = useRef<Record<string, Point[]>>({})

  useEffect(() => {
    history.current = {}
  }, [siteId])

  useEffect(() => {
    if (!snapshot) return
    const t = Date.now()
    for (const f of buildFactors(snapshot)) {
      if (f.raw === undefined) continue
      const h = (history.current[f.id] ??= [])
      if (!h.length || t - h[h.length - 1].t >= 1000) h.push({ t, v: f.raw })
      if (h.length > 180) h.shift()
    }
  }, [snapshot])

  return history.current
}
