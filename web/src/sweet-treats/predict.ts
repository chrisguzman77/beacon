// Short range prediction for a factor's trend: a least squares line through the last minute of
// readings, projected forward. Tells the detail panel which way a reading is heading and when it
// would cross the next limit at this rate. A local extrapolation, not the trained model.
import type { Point } from '@/site/FactorDetail'

export const FIT_MS = 60_000

export type Projection = { slopePerMin: number; at: (t: number) => number }

export function project(points: Point[]): Projection | null {
  if (points.length < 5) return null
  const t1 = points[points.length - 1].t
  const ps = points.filter((p) => p.t >= t1 - FIT_MS)
  if (ps.length < 5) return null
  const n = ps.length
  const mt = ps.reduce((a, p) => a + p.t, 0) / n
  const mv = ps.reduce((a, p) => a + p.v, 0) / n
  const den = ps.reduce((a, p) => a + (p.t - mt) ** 2, 0)
  const slope = den ? ps.reduce((a, p) => a + (p.t - mt) * (p.v - mv), 0) / den : 0
  return { slopePerMin: slope * 60_000, at: (t) => mv + slope * (t - mt) }
}

// Minutes until the projection reaches `limit` from the current reading, or null if it is not heading there.
export function minutesTo(p: Projection, now: number, limit: number) {
  const v = p.at(now)
  if (v >= limit || p.slopePerMin <= 0) return null
  return (limit - v) / p.slopePerMin
}
