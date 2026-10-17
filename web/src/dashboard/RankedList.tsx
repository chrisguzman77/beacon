import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Users } from 'lucide-react'
import type { SiteRow } from '@/api'
import { alertHazard, color, hazard, hazardLabel, indexColor, motion } from '@/tokens'
import type { HazardKey } from '@/tokens'

type Props = { sites: SiteRow[]; selected: number | null; onSelect: (id: number) => void; rankOf: Map<number, number> }

// Site rows. When the order changes (an alert arrives) each row slides to its new place.
// The number on each row is the site's overall rank, whatever the list's sort.
export default function RankedList({ sites, selected, onSelect, rankOf }: Props) {
  const rows = useRef(new Map<number, HTMLElement>())
  const tops = useRef(new Map<number, number>())

  useLayoutEffect(() => {
    rows.current.forEach((el, id) => {
      const top = el.offsetTop
      const was = tops.current.get(id)
      if (was !== undefined && was !== top)
        el.animate([{ transform: `translateY(${was - top}px)` }, { transform: 'none' }], { duration: 600, easing: motion.ease })
      tops.current.set(id, top)
    })
  })

  return (
    <ol className="flex flex-col gap-2">
      {sites.map((s) => (
        <li
          key={s.site_id}
          ref={(el) => {
            if (el) rows.current.set(s.site_id, el)
            else rows.current.delete(s.site_id)
          }}
        >
          <Row s={s} rank={rankOf.get(s.site_id) ?? 0} active={selected === s.site_id} onSelect={() => onSelect(s.site_id)} />
        </li>
      ))}
    </ol>
  )
}

function Row({ s, rank, active, onSelect }: { s: SiteRow; rank: number; active: boolean; onSelect: () => void }) {
  const stop = s.alerts.some((a) => a.type === 'stopwork')
  const kinds = [...new Set(s.alerts.map((a) => alertHazard[a.type]).filter(Boolean))] as HazardKey[]

  return (
    <div
      className="press relative grid grid-cols-[26px_48px_1fr_auto] items-center gap-3 rounded-md py-2 pr-2 pl-3 hover:shadow-md"
      style={{
        background: stop ? `color-mix(in srgb, ${hazard.stopwork} 10%, ${color.surface})` : active ? color.accentPale : color.surface,
        boxShadow: `inset 0 0 0 ${active || stop ? 2 : 1}px ${stop ? hazard.stopwork : active ? color.accent : color.border}`,
      }}
    >
      <button onClick={onSelect} className="absolute inset-0 rounded-md" aria-label={`Show ${s.name}`} aria-pressed={active} />
      <span className="font-mono text-[11px]" style={{ color: color.muted }}>{String(rank).padStart(2, '0')}</span>
      <span className="flex h-11 items-center justify-center rounded-sm text-[24px] font-semibold" style={{ color: s.index == null ? color.muted : indexColor(s.index), background: color.bg }}>
        {s.index ?? '–'}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{s.name}</span>
          {s.beacon && <LiveBadge />}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px]" style={{ color: color.muted }}>{s.county}, {s.state}</span>
          {s.beacon && s.measured_hi != null && (
            <span className="rounded-sm px-1.5 py-px text-[11px] font-semibold" style={{ background: color.raised }} title="Heat index measured by the beacon's own sensor">
              Beacon reads {Math.round(s.measured_hi)}°F
            </span>
          )}
          {kinds.map((k) => (
            <Chip key={k} k={k} />
          ))}
        </span>
      </span>
      <span className="relative flex items-center gap-2">
        <span className="flex items-center gap-1 font-mono text-[12px] font-semibold" style={{ color: s.crew_on_site ? color.text : color.muted }} title="Workers on site">
          <Users className="size-4" /> {s.crew_on_site}
        </span>
        <Link to={`/hub/${s.site_id}${location.search}`} className="relative z-10 rounded-sm p-1 hover:bg-raised" style={{ color: color.muted }} aria-label={`Open ${s.name} in HUB`} title="Open in HUB">
          <ArrowUpRight className="size-5" />
        </Link>
      </span>
    </div>
  )
}

export function Chip({ k }: { k: HazardKey }) {
  return (
    <span className="rounded-sm px-1.5 py-px font-mono text-[10px] font-bold tracking-wider uppercase" style={{ color: hazard[k], background: `color-mix(in srgb, ${hazard[k]} 12%, transparent)` }}>
      {hazardLabel[k]}
    </span>
  )
}

export function LiveBadge() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 py-px font-mono text-[10px] font-bold tracking-widest" style={{ background: color.chrome, color: color.chromeText }}>
      <span className="size-1.5 animate-beacon-pulse rounded-full" style={{ background: color.accent }} /> BEACON
    </span>
  )
}
