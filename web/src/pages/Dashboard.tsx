import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Navigation, Users } from 'lucide-react'
import Frame from '@/components/Frame'
import LoginButton from '@/components/LoginButton'
import { rank, useDash } from '@/dashboard/store'
import RankedList from '@/dashboard/RankedList'
import UsMap from '@/dashboard/UsMap'
import QuickView from '@/dashboard/QuickView'
import StatusBar from '@/dashboard/StatusBar'
import { miles, nearest, useDeviceLocation } from '@/sweet-treats/useDeviceLocation'
import { alertHazard, color, hazard, hazardLabel, indexColor, indexStops } from '@/tokens'
import type { HazardKey } from '@/tokens'
import type { SiteRow } from '@/api'

// The dashboard, MARSH layout: the selected site at a glance on the left, the United States in
// the middle, every site on the right with filters, sort and grouping. Opens on the site nearest
// to this device (the beacon site until the browser shares its location). The selection is
// shared with HUB.

const kinds = Object.keys(hazard) as HazardKey[]
const has = (s: SiteRow, k: HazardKey) => s.alerts.some((a) => alertHazard[a.type] === k)

type Sort = 'rank' | 'index' | 'crew' | 'name'
type Group = 'none' | 'state' | 'hazard' | 'risk'
const sorts: Record<Sort, string> = { rank: 'Rank', index: 'Hazard index', crew: 'Workers', name: 'Name' }
const groupings: Record<Group, string> = { none: 'No grouping', state: 'State', hazard: 'Hazard', risk: 'Risk level' }

function sortBy(sites: SiteRow[], by: Sort) {
  if (by === 'rank') return rank(sites)
  const xs = [...sites]
  if (by === 'index') return xs.sort((a, b) => (b.index ?? -1) - (a.index ?? -1))
  if (by === 'crew') return xs.sort((a, b) => b.crew_on_site - a.crew_on_site)
  return xs.sort((a, b) => a.name.localeCompare(b.name))
}

// The hazard a site is filed under: its most urgent alert.
const PRIORITY: HazardKey[] = ['stopwork', 'unsafe', 'flood', 'heat', 'wildlife']
const topHazard = (s: SiteRow) => PRIORITY.find((k) => has(s, k))
const risk = (s: SiteRow) => (s.index == null ? 'No index yet' : s.index >= 7 ? 'High (7–10)' : s.index >= 4 ? 'Elevated (4–6)' : 'Low (0–3)')

function groupOf(sites: SiteRow[], by: Group): [string, SiteRow[]][] {
  if (by === 'none') return [['', sites]]
  const key = (s: SiteRow) => (by === 'state' ? s.state : by === 'risk' ? risk(s) : (topHazard(s) ? hazardLabel[topHazard(s)!] : 'No alerts'))
  const order =
    by === 'hazard' ? [...PRIORITY.map((k) => hazardLabel[k]), 'No alerts'] : by === 'risk' ? ['High (7–10)', 'Elevated (4–6)', 'Low (0–3)', 'No index yet'] : [...new Set(sites.map(key))].sort()
  return order.map((g) => [g, sites.filter((s) => key(s) === g)] as [string, SiteRow[]]).filter(([, xs]) => xs.length)
}

export default function Dashboard() {
  const { sites, status, error, selected, select, connect } = useDash()
  const [filter, setFilter] = useState<HazardKey[]>([])
  const [sort, setSort] = useState<Sort>('rank')
  const [group, setGroup] = useState<Group>('none')
  const [fitSignal, setFitSignal] = useState(0)
  const here = useDeviceLocation()

  useEffect(() => connect(), [connect])

  // Open on the beacon site, then on the nearest site once the browser shares its location.
  useEffect(() => {
    if (!sites.length) return
    const near = here && nearest(sites, here)
    select((near ?? sites.find((s) => s.beacon) ?? sites[0]).site_id, true)
  }, [sites.length, here]) // eslint-disable-line react-hooks/exhaustive-deps

  const ranked = rank(sites)
  const rankOf = new Map(ranked.map((s, i) => [s.site_id, i + 1]))
  const shown = sortBy(filter.length ? sites.filter((s) => filter.some((k) => has(s, k))) : sites, sort)
  const count = (k: HazardKey) => sites.filter((s) => has(s, k)).length
  const site = sites.find((s) => s.site_id === selected)
  const stops = count('stopwork')
  const attention = sites.filter((s) => s.alerts.length).length
  const crew = sites.reduce((n, s) => n + s.crew_on_site, 0)
  const fake = new URLSearchParams(location.search).has('fake')

  const head =
    stops > 0
      ? { crumb: `URGENT WARNING / ${stops} SITE${stops > 1 ? 'S' : ''}`, text: 'Stop work' }
      : attention > 0
        ? { crumb: `CAUTION / ${attention} SITE${attention > 1 ? 'S' : ''}`, text: 'Needs attention' }
        : { crumb: 'OVERVIEW', text: 'All clear' }

  return (
    <div className="min-h-dvh w-full lg:h-screen lg:overflow-hidden">
      <Frame
        unit="CONTROL / ALL SITES"
        active="dashboard"
        hubTo={selected ? `/hub/${selected}` : '/hub'}
        status={
          <>
            <span className="flex items-center gap-2"><Users className="size-4" /> <b>{crew}</b> on site</span>
            <LoginButton />
          </>
        }
        footer={[fake ? 'Demo readings for the prototype. Not for real-world safety decisions.' : 'Live readings from every site.', `${sites.length} SITES / ${fake ? 'DEMO FEED' : 'LIVE FEED'}`]}
      >
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: color.muted }}>All sites / {head.crumb}</p>
            <h1 className="mt-1 text-[30px] leading-tight font-bold tracking-[-0.01em]">{head.text}</h1>
          </div>
        </div>
        <StatusBar sites={sites} />

        <div className="flex flex-col gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,360px)_1fr_minmax(340px,420px)] lg:grid-rows-[minmax(0,1fr)]">
          {/* Left: the selected site, quick view */}
          {site ? (
            <QuickView site={site} rank={rankOf.get(site.site_id) ?? 0} total={sites.length} distance={here ? miles(here, site) : undefined} />
          ) : (
            <div className="flex flex-col gap-3">
              {[180, 140, 120].map((h, i) => <div key={i} className="animate-beacon-pulse rounded-md bg-surface" style={{ height: h, animationDelay: `${i * 90}ms` }} />)}
            </div>
          )}

          {/* Middle: the United States */}
          <div className="relative h-[340px] overflow-hidden rounded-md sm:h-[440px] lg:h-auto" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
            <UsMap sites={shown} selected={selected} onSelect={(id) => select(id)} here={here} fitSignal={fitSignal} />
            <MapChip className="absolute top-4 left-4">UNITED STATES / LIVE</MapChip>
            <button onClick={() => setFitSignal((n) => n + 1)} className="absolute top-4 right-4" title="Show the whole country">
              <MapChip><Navigation className="size-4" /> FIT</MapChip>
            </button>
            <Legend located={!!here} />
          </div>

          {/* Right: every site, filter, sort and group */}
          <section className="flex h-[75dvh] min-h-0 flex-col gap-3 rounded-md p-4 lg:h-auto" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
            <header className="flex items-baseline justify-between">
              <h2 className="text-[12px] font-bold tracking-[0.04em] uppercase" style={{ color: color.muted }}>Sites</h2>
              <span className="font-mono text-[11px]" style={{ color: color.muted }}>{shown.length} of {sites.length}</span>
            </header>
            <div className="grid grid-cols-2 gap-2">
              <Select label="Sort" value={sort} options={sorts} onChange={(v) => setSort(v as Sort)} />
              <Select label="Group" value={group} options={groupings} onChange={(v) => setGroup(v as Group)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => {
                const on = filter.includes(k)
                return (
                  <button
                    key={k}
                    onClick={() => setFilter(on ? filter.filter((x) => x !== k) : [...filter, k])}
                    className="rounded-sm px-2 py-1 font-mono text-[11px] font-bold tracking-wider uppercase transition-colors"
                    style={{ color: on ? '#fff' : hazard[k], background: on ? hazard[k] : 'transparent', boxShadow: `inset 0 0 0 1px ${hazard[k]}` }}
                    aria-pressed={on}
                  >
                    {hazardLabel[k]} {count(k) > 0 && `· ${count(k)}`}
                  </button>
                )
              })}
              {filter.length > 0 && <button onClick={() => setFilter([])} className="px-2 text-[12px] underline" style={{ color: color.muted }}>Clear</button>}
            </div>
            <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
              {status === 'loading' && <Skeleton />}
              {status === 'error' && (
                <div className="flex flex-col items-start gap-3 py-6">
                  <p className="text-body">The site list did not load: {error}.</p>
                  <button onClick={() => location.reload()} className="text-label font-bold underline">Retry</button>
                  <p className="text-label text-dim">Add ?fake=1 to the URL to use the 50 sites with demo data.</p>
                </div>
              )}
              {status === 'ready' && shown.length === 0 && (
                <p className="py-6 text-body text-dim">No sites have an active {filter.map((k) => hazardLabel[k].toLowerCase()).join(' or ')} alert right now.</p>
              )}
              {status === 'ready' &&
                groupOf(shown, group).map(([g, xs]) => (
                  <div key={g || 'all'} className="mb-3">
                    {g && (
                      <h3 className="sticky top-0 z-10 mb-1.5 flex justify-between py-1 font-mono text-[11px] font-bold tracking-[0.1em] uppercase" style={{ background: color.surface, color: color.muted }}>
                        <span>{g}</span>
                        <span>{xs.length}</span>
                      </h3>
                    )}
                    <RankedList sites={xs} selected={selected} onSelect={(id) => select(id)} rankOf={rankOf} />
                  </div>
                ))}
            </div>
          </section>
        </div>
      </Frame>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <label className="relative flex flex-col rounded-sm px-3 py-1.5" style={{ background: color.bg, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase" style={{ color: color.muted }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none bg-transparent pr-6 text-[14px] font-semibold outline-none">
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 bottom-2 size-4" style={{ color: color.muted }} />
    </label>
  )
}

function MapChip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`flex items-center gap-2 rounded-sm px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.08em] ${className}`} style={{ background: color.chrome, color: color.chromeText }}>
      {children}
    </span>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading sites">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-[60px] animate-beacon-pulse rounded-md bg-bg" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  )
}

// Map key only: what the markers mean. Hazards and filters live in the site list.
function Legend({ located }: { located: boolean }) {
  const dot = (fill: string, ring?: string) => <span className="size-3 rounded-full" style={{ background: fill, boxShadow: ring }} />
  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-2 rounded-md px-4 py-3 text-[12px]" style={{ background: `color-mix(in srgb, ${color.surface} 92%, transparent)`, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
      <span className="font-mono text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: color.muted }}>Hazard index</span>
      <span className="flex items-center gap-3">
        {[['0–3', indexStops.low], ['4–6', indexStops.mid], ['7–10', indexStops.high]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5">{dot(c)} {l}</span>
        ))}
      </span>
      <span className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">{dot(indexColor(2), `0 0 0 2px ${color.text}`)} Beacon</span>
        <span className="flex items-center gap-1.5">{dot('transparent', `inset 0 0 0 2px ${color.signal}`)} Crew on site</span>
        {located && <span className="flex items-center gap-1.5">{dot(color.text)} You</span>}
      </span>
    </div>
  )
}
