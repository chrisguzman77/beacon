import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Users } from 'lucide-react'
import type { SiteRow } from '@/api'
import Panel from '@/components/Panel'
import { alertHazard, color, hazard, hazardLabel, indexColor, motion } from '@/tokens'
import type { HazardKey } from '@/tokens'

type Props = { sites: SiteRow[]; selected: number | null; onSelect: (id: number) => void }

// Ranked rows. When the order changes (an alert arrives) each row slides to its new place.
export default function RankedList({ sites, selected, onSelect }: Props) {
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
      {sites.map((s, i) => (
        <li
          key={s.site_id}
          ref={(el) => {
            if (el) rows.current.set(s.site_id, el)
            else rows.current.delete(s.site_id)
          }}
        >
          <Row s={s} rank={i + 1} active={selected === s.site_id} onSelect={() => onSelect(s.site_id)} />
        </li>
      ))}
    </ol>
  )
}

function Row({ s, rank, active, onSelect }: { s: SiteRow; rank: number; active: boolean; onSelect: () => void }) {
  const stop = s.alerts.some((a) => a.type === 'stopwork')
  const idx = s.index ?? 0
  const kinds = [...new Set(s.alerts.map((a) => alertHazard[a.type]).filter(Boolean))] as HazardKey[]

  return (
    <Panel
      size={10}
      depth={stop ? 2 : 0}
      edge={stop ? hazard.stopwork : active ? color.signal : color.border}
      fill={stop ? `color-mix(in srgb, ${hazard.stopwork} 22%, ${color.bg})` : active ? color.raised : color.surface}
      glow={stop ? `color-mix(in srgb, ${hazard.stopwork} 60%, transparent)` : undefined}
      inner="grid cursor-pointer grid-cols-[28px_56px_1fr_auto] items-center gap-3 py-2 pr-3 pl-3"
    >
      <button onClick={onSelect} className="absolute inset-0" aria-label={`Show ${s.name} on the map`} />
      <span className="font-mono text-label text-dim">{String(rank).padStart(2, '0')}</span>
      <span
        className="flex h-12 items-center justify-center text-[28px] font-bold"
        style={{ color: s.index == null ? color.muted : indexColor(idx), background: color.bg, clipPath: 'polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)' }}
      >
        {s.index ?? '–'}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-semibold">{s.name}</span>
          {s.beacon && <LiveBadge />}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-label text-dim">{s.county}, {s.state}</span>
          {kinds.map((k) => (
            <Chip key={k} k={k} />
          ))}
        </span>
      </span>
      <span className="relative flex items-center gap-3">
        <span className="flex items-center gap-1 font-mono text-label font-bold" style={{ color: s.crew_on_site ? color.text : color.muted }} title="Crew on site">
          <Users className="size-4" /> {s.crew_on_site}
        </span>
        <Link to={`/site/${s.site_id}${location.search}`} className="relative z-10 p-1 text-dim hover:text-signal" aria-label={`Open ${s.name}`}>
          <ArrowUpRight className="size-5" />
        </Link>
      </span>
    </Panel>
  )
}

export function Chip({ k }: { k: HazardKey }) {
  return (
    <span
      className="px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase"
      style={{ color: hazard[k], background: `color-mix(in srgb, ${hazard[k]} 16%, transparent)`, boxShadow: `inset 0 0 0 1px ${hazard[k]}` }}
    >
      {hazardLabel[k]}
    </span>
  )
}

export function LiveBadge() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-signal" style={{ boxShadow: `inset 0 0 0 1px ${color.signal}` }}>
      <span className="size-1.5 animate-beacon-pulse bg-signal" /> LIVE BEACON
    </span>
  )
}
