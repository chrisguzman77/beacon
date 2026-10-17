import { useEffect, useState } from 'react'
import LoginButton from '@/components/LoginButton'
import AppNav from '@/components/AppNav'
import MapView from '@/components/MapView'
import Panel from '@/components/Panel'
import { rank, useDash } from '@/dashboard/store'
import RankedList, { Chip, LiveBadge } from '@/dashboard/RankedList'
import { alertHazard, color, hazard, hazardLabel, indexStops } from '@/tokens'
import type { HazardKey } from '@/tokens'
import type { SiteRow } from '@/api'

const kinds = Object.keys(hazard) as HazardKey[]
const has = (s: SiteRow, k: HazardKey) => s.alerts.some((a) => alertHazard[a.type] === k)

export default function Dashboard() {
  const { sites, status, error, selected, select, connect } = useDash()
  const [filter, setFilter] = useState<HazardKey[]>([])

  useEffect(() => connect(), [connect])

  const shown = rank(filter.length ? sites.filter((s) => filter.some((k) => has(s, k))) : sites)
  const count = (k: HazardKey) => sites.filter((s) => has(s, k)).length
  const beacon = sites.find((s) => s.beacon)

  return (
    <div className="flex h-screen flex-col gap-4 bg-bg p-5 text-ink">
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div>
            <p className="flex items-center gap-2 text-label font-semibold tracking-[0.18em] text-dim uppercase">
              <span className="size-1.5 bg-signal" /> PlanIT Beacon
            </p>
            <h1 className="text-heading leading-tight font-semibold tracking-tight">Site hazard board</h1>
          </div>
          <AppNav />
        </div>
        <div className="flex items-center gap-3">
          <Stat label="Sites" value={String(sites.length)} />
          <Stat label="Stop work" value={String(count('stopwork'))} tint={count('stopwork') ? hazard.stopwork : undefined} />
          <Stat label="Heat" value={String(count('heat'))} tint={count('heat') ? hazard.heat : undefined} />
          <Stat label="Flood" value={String(count('flood'))} tint={count('flood') ? hazard.flood : undefined} />
          {beacon && <Stat label="Beacon site" value={beacon.name} tint={color.signal} />}
          <LoginButton />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[480px_1fr] grid-rows-[minmax(0,1fr)] gap-4">
        <Panel depth={2} size={20} inner="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-body font-bold tracking-[0.12em] uppercase">Ranked by hazard index</h2>
            <span className="font-mono text-label text-dim">{shown.length} sites</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => {
              const on = filter.includes(k)
              return (
                <button
                  key={k}
                  onClick={() => setFilter(on ? filter.filter((x) => x !== k) : [...filter, k])}
                  className="px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider uppercase transition-colors"
                  style={{ color: on ? color.bg : hazard[k], background: on ? hazard[k] : 'transparent', boxShadow: `inset 0 0 0 1px ${hazard[k]}` }}
                >
                  {hazardLabel[k]} {count(k) > 0 && `· ${count(k)}`}
                </button>
              )
            })}
          </div>
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            {status === 'loading' && <Skeleton />}
            {status === 'error' && (
              <div className="flex flex-col items-start gap-3 py-6">
                <p className="text-body">The site list did not load: {error}.</p>
                <button onClick={() => location.reload()} className="font-mono text-label font-bold text-signal underline">Retry</button>
                <p className="text-label text-dim">Add ?fake=1 to the URL to use the 50 sites with demo data.</p>
              </div>
            )}
            {status === 'ready' && shown.length === 0 && (
              <p className="py-6 text-body text-dim">No sites have an active {filter.map((k) => hazardLabel[k].toLowerCase()).join(' or ')} alert right now.</p>
            )}
            {status === 'ready' && <RankedList sites={shown} selected={selected} onSelect={select} />}
          </div>
        </Panel>

        <Panel depth={2} size={20} inner="relative">
          <MapView sites={shown} selected={selected} onSelect={select} />
          <Legend />
        </Panel>
      </div>
    </div>
  )
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <Panel size={10} depth={1} edge={tint ?? color.border} inner="flex flex-col px-4 py-1.5">
      <span className="font-mono text-[10px] font-bold tracking-widest text-dim uppercase">{label}</span>
      <span className="text-body leading-tight font-bold" style={{ color: tint ?? color.text }}>{value}</span>
    </Panel>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading sites">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-[68px] animate-beacon-pulse bg-surface" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  )
}

function Legend() {
  return (
    <div className="absolute bottom-4 left-4">
      <Panel size={10} depth={2} fill={`color-mix(in srgb, ${color.bg} 88%, transparent)`} inner="flex flex-col gap-2 px-4 py-3 font-mono text-[11px] font-bold tracking-wider uppercase">
        <span className="text-dim">Hazard index</span>
        <span className="flex items-center gap-3">
          {[['0–3', indexStops.low], ['4–6', indexStops.mid], ['7–10', indexStops.high]].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ background: c }} /> {l}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ boxShadow: `0 0 0 2px ${color.signal}` }} /> Crew on site</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: hazard.stopwork, opacity: 0.6 }} /> Stop work</span>
        <span className="flex items-center gap-1.5"><LiveBadge /></span>
        <span className="flex gap-1.5"><Chip k="heat" /><Chip k="flood" /></span>
      </Panel>
    </div>
  )
}
