import { useEffect, useState } from 'react'
import { get } from '@/api'
import type { SiteRow } from '@/api'
import type { Report } from '@/site/types'

// Recent crew hazard reports per site, for the pins on the dashboard map. GET /sites has no
// reports, so each site's detail is read in small batches every 3 minutes and reports from the
// last 24 hours are kept. ?fake=1 makes up a few around the demo sites.

const DAY_MS = 24 * 3_600_000
const EVERY_MS = 3 * 60_000
const BATCH = 6
const fake = new URLSearchParams(location.search).has('fake')

const recent = (rs: Report[]) => rs.filter((r) => Date.now() - new Date(r.ts).getTime() < DAY_MS)

function fakeReports(sites: SiteRow[]): Record<number, Report[]> {
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const beacon = sites.find((s) => s.beacon)?.site_id ?? 0
  const others = sites.filter((s) => !s.beacon)
  const picks: [number, Report[]][] = [
    [beacon, [{ tag: 'downed_line', description: 'Low hanging conductor across the access road.', ts: ago(3) }, { tag: 'snake', description: 'Water moccasin under the pipe rack.', ts: ago(5) }]],
    [others[4]?.site_id ?? 0, [{ tag: 'alligator', description: 'Alligator on the bank by the intake.', ts: ago(1) }]],
    [others[11]?.site_id ?? 0, [{ tag: 'standing_water', description: 'Ponding at the laydown yard after rain.', ts: ago(7) }]],
    [others[23]?.site_id ?? 0, [{ tag: 'wasp', description: 'Wasp nest inside the switchgear door.', ts: ago(10) }]],
  ]
  return Object.fromEntries(picks.filter(([id]) => id))
}

export function useRecentReports(sites: SiteRow[]) {
  const [reports, setReports] = useState<Record<number, Report[]>>({})
  const ids = sites.map((s) => s.site_id).join(',')

  useEffect(() => {
    if (!sites.length) return
    if (fake) return setReports(fakeReports(sites))
    let stop = false
    const load = async () => {
      const out: Record<number, Report[]> = {}
      for (let i = 0; i < sites.length && !stop; i += BATCH) {
        await Promise.all(
          sites.slice(i, i + BATCH).map((s) =>
            get<{ reports?: Report[] }>(`/sites/${s.site_id}`)
              .then((d) => {
                const r = recent(d.reports ?? [])
                if (r.length) out[s.site_id] = r
              })
              .catch(() => {}),
          ),
        )
      }
      if (!stop) setReports(out)
    }
    load()
    const t = setInterval(load, EVERY_MS)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  return reports
}
