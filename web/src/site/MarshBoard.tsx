import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Camera, ClipboardList, Gauge, LayoutGrid, Radio, Scan, TriangleAlert, Users } from 'lucide-react'
import Panel, { cut } from '@/components/Panel'
import LookSwitcher from '@/components/LookSwitcher'
import { color, indexColor, lookId, shape } from '@/tokens'
import FactorWeb from './FactorWeb'
import type { FactorWebHandle } from './FactorWeb'
import FactorDetail from './FactorDetail'
import type { Point } from './FactorDetail'
import SitePicker from './SitePicker'
import DeviceCard from './DeviceCard'
import MusterPanel from './MusterPanel'
import BriefingPanel from './BriefingPanel'
import { buildFactors, isHazard, worst } from './factors'
import type { Snapshot } from './types'

// HUB in the MARSH style (looks field, night, hybrid): dark frame bars, a paper content area,
// breadcrumb and headline, a warning banner, the factor web with overlay chips, the right column,
// stat tiles and big bottom tabs. MARSH is a style example only; every word comes from the
// site's own conditions so it reads right for any weather or location.

type Props = { s: Snapshot; live: boolean; idle: boolean; history: Record<string, Point[]> }

function headline(s: Snapshot, level: 'clear' | 'caution' | 'danger') {
  if (s.alert_type === 'stopwork' || s.interlock === 'locked') return { crumb: 'URGENT WARNING', text: 'Protect people. Pause the work.' }
  if (level === 'danger') return { crumb: 'HAZARD WARNING', text: 'Hazards active. Act on them now.' }
  if (level === 'caution') return { crumb: 'CAUTION', text: 'Conditions are changing. Stay alert.' }
  return { crumb: 'OVERVIEW', text: 'Read the site. Stay ahead.' }
}

export default function MarshBoard({ s, live, idle, history }: Props) {
  const web = useRef<FactorWebHandle>(null)
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(location.search).get('node'))
  const [now, setNow] = useState(() => new Date())
  const factors = buildFactors(s)
  const hazards = factors.filter(isHazard)
  const top = worst(hazards)
  const level = top ? (top.status === 'danger' ? 'danger' : 'caution') : 'clear'
  const h = headline(s, level)
  const factor = selected ? factors.find((f) => f.id === selected) : undefined
  const crewIn = s.crew.filter((c) => c.in).length
  const fake = new URLSearchParams(location.search).has('fake')
  const dark = lookId === 'night'

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!selected) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [selected])

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
  const webFill = dark ? color.surface : lookId === 'hybrid' ? color.chrome : color.surface

  return (
    <div className="flex h-full flex-col" style={{ background: color.chrome }}>
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between px-6" style={{ color: color.chromeText }}>
        <div className="flex items-center gap-3">
          <Scan className="size-6" style={{ color: color.accent }} />
          <span className="text-body font-bold tracking-tight">PLANIT BEACON</span>
          <span className="font-mono text-label opacity-60">/ HUB · SITE {String(s.site.id).padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-label font-bold tracking-wider">
          {fake && <span style={{ color: color.accent }}>DEMO FEED</span>}
          <span className="flex items-center gap-2">
            <Radio className="size-4" style={{ color: s.online && live ? color.online : color.offline }} />
            {!live ? 'NO FEED' : s.online ? 'BEACON ONLINE' : 'BEACON OFFLINE'}
          </span>
          <span className="flex items-center gap-2"><Users className="size-4" /> {crewIn}</span>
          <span className="text-body tracking-widest">{time}</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-5" style={{ background: color.bg, borderRadius: shape.round ? 4 : 0 }}>
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-dim uppercase">SITE {String(s.site.id).padStart(2, '0')} / {h.crumb}</p>
            <h1 className="text-[30px] leading-tight font-bold tracking-tight">{h.text}</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <SitePicker current={s.site.id} name={s.site.name} />
            <p className="font-mono text-[11px] tracking-widest text-dim">{date} · {time}</p>
          </div>
        </div>

        {top && (
          <div
            className="flex items-center justify-between gap-4 px-4 py-3"
            style={{ background: `color-mix(in srgb, ${top.tint ?? color.offline} ${dark ? 22 : 18}%, ${color.surface})`, borderLeft: `5px solid ${top.status === 'danger' ? (top.tint ?? color.text) : color.text}`, clipPath: cut(10) }}
          >
            <span className="flex min-w-0 items-center gap-3">
              <TriangleAlert className="size-5 shrink-0" />
              <span className="font-bold tracking-wide whitespace-nowrap uppercase">{top.label} {top.status === 'danger' ? 'warning' : 'caution'}</span>
              <span className="truncate">{top.note}{hazards.length > 1 ? ` · ${hazards.length - 1} more` : ''}</span>
            </span>
            <button onClick={() => setSelected(top.id)} className="flex shrink-0 items-center gap-1 font-semibold">
              What to do <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] grid-rows-[minmax(0,1fr)] gap-4">
          <Panel size={14} depth={1} fill={webFill}>
            <FactorWeb ref={web} s={s} tour={idle && !selected} selected={selected} onSelect={setSelected} backdrop={webFill} />
            <Chip className="absolute top-4 left-4">FACTOR WEB / LIVE</Chip>
            <button onClick={() => web.current?.fit()} className="absolute top-4 right-4" aria-label="Recenter the web">
              <Chip><Scan className="size-4" /> RECENTER</Chip>
            </button>
            <div className="pointer-events-none absolute bottom-4 left-5" style={{ color: lookId === 'hybrid' ? color.chromeText : color.text }}>
              <p className="text-[28px] leading-tight font-semibold">{s.site.name}</p>
              <p className="text-label opacity-75">{factors.length} factors · {hazards.length ? `${hazards.length} need attention` : 'all normal'} · drag to pan, scroll to zoom</p>
            </div>
            {factor && <FactorDetail x={factor} history={history[factor.id] ?? []} onClose={() => setSelected(null)} />}
          </Panel>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {s.site.beacon !== false && <DeviceCard s={s} />}
            <MusterPanel s={s} />
            <BriefingPanel s={s} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Tile icon={<Gauge className="size-5" />} label="Hazard index" value={`${s.index} / 10`} tint={indexColor(s.index)} sub={s.index_reason} />
          <Tile icon={<Users className="size-5" />} label="Crew on site" value={`${crewIn} of ${s.crew.length}`} sub={`Work zone ${s.zone_clear ? 'clear' : 'occupied'}`} />
          <Tile icon={<BookOpen className="size-5" />} label="Next briefing" value={s.next_briefing} sub="English and Spanish, site time" />
        </div>
      </main>

      {/* Bottom tabs */}
      <nav className="flex shrink-0 items-center gap-3 px-6 py-3">
        <Tab to="/dashboard" icon={<LayoutGrid className="size-5" />}>Dashboard</Tab>
        <Tab active icon={<Gauge className="size-5" />}>Hub</Tab>
        <Tab icon={<ClipboardList className="size-5" />} soon>Conditions</Tab>
        <Tab icon={<Camera className="size-5" />} soon>Reports</Tab>
        <div className="ml-auto"><LookSwitcher onChrome /></div>
      </nav>
      <footer className="flex shrink-0 justify-between px-6 pb-2 font-mono text-[11px] tracking-wider" style={{ color: color.chromeText, opacity: 0.6 }}>
        <span>PLANIT BEACON · SITE SAFETY PROTOTYPE · {fake ? 'Demo readings, not for real decisions.' : 'Live readings from the site.'}</span>
        <span>{fake ? 'DEMO FEED' : 'LIVE FEED'} / LOOK {lookId.toUpperCase()}</span>
      </footer>
    </div>
  )
}

function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest ${className}`} style={{ background: color.chrome, color: color.chromeText, clipPath: cut(8) }}>
      {children}
    </span>
  )
}

function Tile({ icon, label, value, sub, tint }: { icon: ReactNode; label: string; value: string; sub: string; tint?: string }) {
  return (
    <Panel size={12} depth={0} edge={color.raised} fill={color.raised} inner="flex items-start gap-3 px-5 py-3">
      <span className="mt-1 text-dim">{icon}</span>
      <span className="min-w-0">
        <span className="block font-mono text-[11px] font-bold tracking-[0.16em] text-dim uppercase">{label}</span>
        <span className="block text-[24px] leading-tight font-semibold" style={{ color: tint }}>{value}</span>
        <span className="block truncate text-label text-dim">{sub}</span>
      </span>
    </Panel>
  )
}

function Tab({ children, icon, to, active, soon }: { children: string; icon: ReactNode; to?: string; active?: boolean; soon?: boolean }) {
  const body = (
    <span
      className="flex w-52 items-center gap-3 px-5 py-3 text-body font-semibold"
      style={{
        clipPath: cut(10),
        background: active ? color.accent : `color-mix(in srgb, ${color.chromeText} 8%, ${color.chrome})`,
        color: active ? color.accentInk : color.chromeText,
        opacity: soon ? 0.45 : 1,
      }}
      title={soon ? 'Not designed yet' : undefined}
    >
      {icon}
      {children}
    </span>
  )
  return to ? <Link to={`${to}${location.search}`}>{body}</Link> : body
}
