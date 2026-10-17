import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronRight, KeyRound, MapPin, OctagonAlert, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { SiteRow } from '@/api'
import { formatCountdown, useSite } from '@/site/store'
import { buildFactors, isHazard } from '@/site/factors'
import { isTakeover } from '@/site/types'
import { alertHazard, color, hazard, indexColor } from '@/tokens'
import type { HazardKey } from '@/tokens'
import { Chip } from './RankedList'
import { useDash } from './store'
import ReleaseDialog from '@/site/ReleaseDialog'

// The dashboard's left column: the selected site at a glance, for quick action and nothing
// detailed. Rank, hazard index, workers on site, the immediate hazards (each opens its factor in
// HUB), and tomorrow's briefing in one line. HUB is one tap away (the Hub tab, a row's arrow, Act). Reads the same site feed HUB uses.

export function hubHref(id: number, node?: string) {
  const q = new URLSearchParams(location.search)
  q.delete('node')
  q.delete('step')
  if (node) q.set('node', node)
  const qs = q.toString()
  return `/hub/${id}${qs ? `?${qs}` : ''}`
}

type Props = { site: SiteRow; rank: number; total: number; distance?: number }

export default function QuickView({ site, rank, total, distance }: Props) {
  const snapshot = useSite((s) => s.snapshot)
  const connect = useSite((s) => s.connect)
  useEffect(() => connect(site.site_id), [connect, site.site_id])

  const s = snapshot?.site.id === site.site_id ? snapshot : null
  const [release, setRelease] = useState(false)
  const stopAlert = site.alerts.find((a) => a.type === 'stopwork')
  const order = { danger: 0, caution: 1 } as Record<string, number>
  const hazards = s ? buildFactors(s).filter(isHazard).sort((a, b) => order[a.status] - order[b.status]) : []
  const crewIn = s ? s.crew.filter((c) => c.in).length : site.crew_on_site
  const kinds = [...new Set(site.alerts.map((a) => alertHazard[a.type]).filter(Boolean))] as HazardKey[]
  // Index and stop work come from the same row as the ranked list, so the two always agree.
  const stop = site.alerts.some((a) => a.type === 'stopwork') || (!!s && (isTakeover(s) || s.alert_type === 'stopwork'))
  const brief = s?.briefing.english ?? ''
  const idx = site.index ?? s?.index ?? null

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <section className="rounded-md p-5" style={{ background: color.chrome, color: color.chromeText }}>
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase opacity-75">
          <MapPin className="size-3.5" /> {distance !== undefined ? `Nearest site · ${Math.round(distance)} mi from you` : 'Selected site'}
        </p>
        <h2 className="mt-1 text-[24px] leading-tight font-semibold">{site.name}</h2>
        <p className="text-[13px] opacity-75">{site.county} County, {site.state} · {site.tech}</p>
        {s?.index_reasons?.length ? (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-70">Why</span>
            {s.index_reasons.map((r) => <span key={r} className="rounded-sm px-2 py-0.5" style={{ background: color.chromeSoft }}>{r}</span>)}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Rank" value={`#${rank}`} sub={`of ${total}`} />
          <Stat label="Index" value={idx == null ? '–' : String(idx)} sub="of 10" tint={idx == null ? undefined : indexColor(idx)} />
          <Stat label="Workers" value={String(crewIn)} sub={s ? (s.zone_clear ? 'zone clear' : 'in the zone') : 'on site'} />
        </div>
      </section>

      {stop && (
        <div className="flex items-stretch overflow-hidden rounded-md" style={{ background: hazard.stopwork, color: '#fff' }}>
          <Link to={hubHref(site.site_id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
            <OctagonAlert className="size-6 shrink-0" />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] tracking-wide uppercase">Stop work</b>
              <span className="block text-[13px] opacity-90">
                {s?.reason ? `${s.reason.toLowerCase().replace(/^./, (c) => c.toUpperCase())} · ` : ''}
                {s && s.countdown > 0 ? `${formatCountdown(s.countdown)} left` : s?.awaiting_clear ? 'waiting for the supervisor PIN' : 'equipment locked'}
              </span>
            </span>
            <ChevronRight className="size-5" />
          </Link>
          <button onClick={() => setRelease(true)} className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-4 text-[11px] font-bold tracking-wide uppercase" style={{ background: 'rgb(0 0 0 / 0.18)' }} title="Supervisor release with PIN">
            <KeyRound className="size-5" /> Release
          </button>
        </div>
      )}
      {release && (
        <ReleaseDialog
          alertId={stopAlert?.alert_id ?? s?.alert_id}
          site={site.name}
          onClose={() => setRelease(false)}
          onReleased={() => new URLSearchParams(location.search).has('fake') && stopAlert && useDash.getState().released(stopAlert.alert_id)}
        />
      )}

      <Card title="Immediate hazards" icon={<TriangleAlert className="size-4" />} right={kinds.length > 0 && <span className="flex gap-1">{kinds.map((k) => <Chip key={k} k={k} />)}</span>}>
        {!s && <p className="text-[13px]" style={{ color: color.muted }}>Reading the site…</p>}
        {s && hazards.length === 0 && (
          <p className="flex items-center gap-2 text-[14px]" style={{ color: color.signal }}>
            <ShieldCheck className="size-5" /> No immediate hazards
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {hazards.slice(0, 5).map((h) => (
            <li key={h.id}>
              <Link
                to={hubHref(site.site_id, h.id)}
                className="group flex items-center gap-3 rounded-sm py-2 pr-2 pl-3 hover:brightness-95"
                style={{ background: color.bg, borderLeft: `4px solid ${h.tint ?? color.muted}` }}
              >
                <span className="min-w-0 flex-1">
                  <b className="block text-[14px]">{h.label} <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: h.tint }}>{h.status}</span></b>
                  <span className="block truncate text-[12px]" style={{ color: color.muted }}>{h.note}</span>
                </span>
                <span className="flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap">Act <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            </li>
          ))}
        </ul>
        {hazards.length > 5 && <p className="mt-1 text-[12px]" style={{ color: color.muted }}>+{hazards.length - 5} more in HUB</p>}
      </Card>

      <Card title="Briefing" icon={<BookOpen className="size-4" />} right={<span className="font-mono text-[11px]" style={{ color: color.muted }}>NEXT {s?.next_briefing ?? '18:00'}</span>}>
        <p className="line-clamp-3 text-[14px] leading-snug">{brief || 'No briefing yet. It is generated at 6 PM site time, in English and Spanish.'}</p>
      </Card>

    </div>
  )
}

function Stat({ label, value, sub, tint }: { label: string; value: string; sub: string; tint?: string }) {
  return (
    <div className="rounded-sm px-3 py-2" style={{ background: color.chromeSoft }}>
      <span className="block font-mono text-[10px] tracking-[0.1em] uppercase opacity-70">{label}</span>
      <span className="block text-[26px] leading-tight font-semibold" style={{ color: tint ? `color-mix(in srgb, ${tint} 55%, #fff)` : undefined }}>{value}</span>
      <span className="block text-[11px] opacity-70">{sub}</span>
    </div>
  )
}

function Card({ title, icon, right, children }: { title: string; icon: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md p-4" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[12px] font-bold tracking-[0.04em] uppercase" style={{ color: color.muted }}>{icon} {title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}
