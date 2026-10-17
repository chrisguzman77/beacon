import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BookOpen, Database, OctagonAlert, Radio, Sun } from 'lucide-react'
import { get } from '@/api'
import type { SiteRow } from '@/api'
import { color, hazard } from '@/tokens'

// The dashboard's status bar (web guide section 6): sites in stop work and heat danger, whether
// the data feeds are current (GET /health, every 30 s), whether the beacon is connected, and when
// the next 6 PM briefing runs at the beacon site.

type Health = { ok: boolean; gateway: Record<string, boolean>; fetchers: Record<string, string | null> }

// Each feed's schedule (backend scheduler); a feed is stale after missing about two and a half runs.
const FEEDS: Record<string, { label: string; every_min: number }> = {
  open_meteo: { label: 'Weather', every_min: 15 },
  nws: { label: 'NWS alerts', every_min: 15 },
  flood: { label: 'River flood', every_min: 60 },
  inaturalist: { label: 'Wildlife', every_min: 360 },
}

const fake = new URLSearchParams(location.search).has('fake')
const minsAgo = (ts: string | null) => (ts ? (Date.now() - new Date(ts).getTime()) / 60_000 : Infinity)
const ago = (m: number) => (m === Infinity ? 'never' : m < 1 ? 'just now' : m < 60 ? `${Math.round(m)} min ago` : `${Math.round(m / 60)} h ago`)

function fakeHealth(beacon?: number): Health {
  const t = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
  return { ok: true, gateway: beacon ? { [beacon]: true } : {}, fetchers: { open_meteo: t(4), nws: t(6), flood: t(22), inaturalist: t(95) } }
}

// Minutes until the next 18:00 in a time zone.
function untilSix(tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')?.value) % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value)
  const left = 18 * 60 - (h * 60 + m)
  return left > 0 ? left : left + 24 * 60
}

export default function StatusBar({ sites }: { sites: SiteRow[] }) {
  const beacon = sites.find((s) => s.beacon)
  const [health, setHealth] = useState<Health | null>(null)
  const [failed, setFailed] = useState(false)
  const [, tick] = useState(0)

  useEffect(() => {
    if (fake) return setHealth(fakeHealth(beacon?.site_id))
    let stop = false
    const load = () =>
      get<Health>('/health')
        .then((h) => !stop && (setHealth(h), setFailed(false)))
        .catch(() => !stop && setFailed(true))
    load()
    const t = setInterval(load, 30_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [beacon?.site_id])
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const stops = sites.filter((s) => s.alerts.some((a) => a.type === 'stopwork')).length
  const heat = sites.filter((s) => s.alerts.some((a) => a.type === 'heat_danger')).length
  const feeds = Object.entries(FEEDS).map(([k, f]) => {
    const m = minsAgo(health?.fetchers[k] ?? null)
    return { ...f, key: k, m, ok: m < f.every_min * 2.5 }
  })
  const healthy = feeds.filter((f) => f.ok).length
  const linked = beacon && health ? health.gateway[String(beacon.site_id)] : undefined
  const left = beacon ? untilSix(beacon.tz) : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill icon={<OctagonAlert className="size-4" />} tint={stops ? hazard.stopwork : undefined} strong={stops > 0}>
        Stop work <b>{stops}</b>
      </Pill>
      <Pill icon={<Sun className="size-4" />} tint={heat ? hazard.heat : undefined} strong={heat > 0}>
        Heat danger <b>{heat}</b>
      </Pill>
      <Pill
        icon={<Database className="size-4" />}
        tint={failed ? hazard.stopwork : !health ? undefined : healthy === feeds.length ? color.signal : color.offline}
        title={failed ? 'The backend health check did not answer' : feeds.map((f) => `${f.label}: ${ago(f.m)}${f.ok ? '' : ' (late)'}`).join('\n')}
      >
        {failed ? 'Backend not answering' : !health ? 'Checking feeds…' : healthy === feeds.length ? `Feeds ${healthy} of ${feeds.length} healthy` : `Feeds late: ${feeds.filter((f) => !f.ok).map((f) => f.label).join(', ')}`}
      </Pill>
      {beacon && (
        <Pill icon={<Radio className="size-4" />} tint={linked === undefined ? undefined : linked ? color.signal : color.offline}>
          Beacon {linked === undefined ? '…' : linked ? 'online' : 'offline · local rules active'}
        </Pill>
      )}
      {left !== null && (
        <Pill icon={<BookOpen className="size-4" />}>
          Next briefing 18:00 site time · in {left >= 60 ? `${Math.floor(left / 60)} h ${left % 60} min` : `${left} min`}
        </Pill>
      )}
    </div>
  )
}

function Pill({ icon, tint, strong, title, children }: { icon: ReactNode; tint?: string; strong?: boolean; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className="flex h-8 items-center gap-2 rounded-full px-3 text-[13px]"
      style={{
        background: strong && tint ? tint : color.surface,
        color: strong ? '#fff' : color.text,
        boxShadow: strong ? undefined : `inset 0 0 0 1px ${color.border}`,
      }}
    >
      <span style={{ color: strong ? '#fff' : (tint ?? color.muted) }}>{icon}</span>
      {tint && !strong && <span className="size-2 rounded-full" style={{ background: tint }} />}
      {children}
    </span>
  )
}
