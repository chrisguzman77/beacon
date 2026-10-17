import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Accessibility, ArrowRight, BookOpen, Camera, Check, ClipboardList, Gauge, LayoutGrid, Navigation, Radio, Scan, TriangleAlert, Users } from 'lucide-react'
import Panel from '@/components/Panel'
import { color, indexColor } from '@/tokens'
import { useReducedMotion } from '@/sweet-treats/useReducedMotion'
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

// HUB, built to Cam's MARSH Figma screens: dark top bar, paper content with breadcrumb and
// headline, the amber warning banner, the factor web as the dark main visual with overlay chips,
// the right column of cards, sage stat tiles, dark bottom tabs and the footer line.
// Every word comes from the site's own conditions, so it reads right for any weather or place.

type Props = { s: Snapshot; live: boolean; idle: boolean; history: Record<string, Point[]> }

function headline(s: Snapshot, level: 'clear' | 'caution' | 'danger') {
  if (s.alert_type === 'stopwork' || s.interlock === 'locked') return { crumb: 'URGENT WARNING', text: 'Protect people. Pause the work.' }
  if (level === 'danger') return { crumb: 'HAZARD WARNING', text: 'Hazards active. Act on them now.' }
  if (level === 'caution') return { crumb: 'CAUTION', text: 'Conditions are changing. Stay alert.' }
  return { crumb: 'SITE OVERVIEW', text: 'Read the site. Stay ahead.' }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function HubBoard({ s, live, idle, history }: Props) {
  const web = useRef<FactorWebHandle>(null)
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(location.search).get('node'))
  const [now, setNow] = useState(() => new Date())
  const [reduced, toggleMotion] = useReducedMotion()
  const factors = buildFactors(s)
  const hazards = factors.filter(isHazard)
  const top = worst(hazards)
  const level = top ? (top.status === 'danger' ? 'danger' : 'caution') : 'clear'
  const h = headline(s, level)
  const factor = selected ? factors.find((f) => f.id === selected) : undefined
  const crewIn = s.crew.filter((c) => c.in).length
  const fake = new URLSearchParams(location.search).has('fake')

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

  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()

  return (
    <div className="flex h-full flex-col" style={{ background: color.chrome, color: color.text }}>
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between px-7" style={{ color: color.chromeText }}>
        <div className="flex items-center gap-3">
          <Scan className="size-6" style={{ color: color.accent }} strokeWidth={2.25} />
          <span className="text-[19px] font-bold tracking-tight">PLANIT</span>
          <span className="font-mono text-[12px] opacity-70">/ SITE UNIT {pad2(s.site.id)}</span>
        </div>
        <div className="flex items-center gap-7 text-[13px]">
          {fake && <span className="font-semibold tracking-wide" style={{ color: color.accent }}>DEMO FEED</span>}
          <span className="flex items-center gap-2">
            <Radio className="size-4" />
            {!live ? 'No feed' : s.online ? 'Beacon online' : 'Beacon offline'}
          </span>
          <span className="flex items-center gap-2"><Users className="size-4" /> <b>{crewIn}</b> on site</span>
          <span className="font-mono text-[18px] tracking-wider">{time}</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex min-h-0 flex-1 flex-col gap-4 rounded-sm px-7 pt-5 pb-5" style={{ background: color.bg }}>
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: color.muted }}>Site {pad2(s.site.id)} / {h.crumb}</p>
            <h1 className="mt-1 text-[30px] leading-tight font-bold tracking-[-0.01em]">{h.text}</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <SitePicker current={s.site.id} name={s.site.name} />
            <p className="font-mono text-[11px] tracking-[0.08em]" style={{ color: color.muted }}>
              {s.online ? 'LIVE' : 'LAST KNOWN'} &nbsp;/&nbsp; {date} &nbsp;/&nbsp; {time}
            </p>
          </div>
        </div>

        {top && (
          <div className="flex items-center justify-between gap-4 rounded-sm py-3 pr-5 pl-4" style={{ background: color.accentPale, borderLeft: `4px solid ${color.text}` }}>
            <span className="flex min-w-0 items-center gap-3 text-[15px]">
              <TriangleAlert className="size-5 shrink-0" />
              <b className="whitespace-nowrap uppercase">{top.label} {top.status === 'danger' ? 'warning' : 'caution'}</b>
              <span className="truncate">{top.note}{hazards.length > 1 ? ` · ${hazards.length - 1} more` : ''}</span>
            </span>
            <button onClick={() => setSelected(top.id)} className="flex shrink-0 items-center gap-1 text-[15px]">
              View protective actions <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] grid-rows-[minmax(0,1fr)] gap-4">
          <div className="relative overflow-hidden rounded-md" style={{ background: color.chrome }}>
            <FactorWeb ref={web} s={s} tour={idle && !selected} selected={selected} onSelect={setSelected} backdrop={color.chrome} />
            <Chip className="absolute top-4 left-4">FACTOR WEB / LIVE</Chip>
            <button onClick={() => web.current?.fit()} className="absolute top-4 right-4" aria-label="Recenter the web" title="Recenter">
              <Chip><Navigation className="size-4" /> FIT</Chip>
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28" style={{ background: `linear-gradient(transparent, ${color.chrome})` }} />
            <div className="pointer-events-none absolute bottom-5 left-6" style={{ color: color.chromeText }}>
              <p className="text-[28px] leading-tight font-medium">{s.site.name}</p>
              <p className="text-[13px] opacity-80">{hazards.length ? `${hazards.length} factor${hazards.length > 1 ? 's' : ''} need attention` : 'All monitored factors normal'} · drag to pan, scroll to zoom</p>
            </div>
            <p className="pointer-events-none absolute right-5 bottom-5 text-right font-mono text-[11px] leading-relaxed" style={{ color: color.chromeText, opacity: 0.75 }}>
              {factors.length} FACTORS
              <br />
              INDEX {s.index} / 10
            </p>
            {factor && <FactorDetail x={factor} history={history[factor.id] ?? []} onClose={() => setSelected(null)} />}
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {s.site.beacon !== false && <DeviceCard s={s} />}
            <MusterPanel s={s} />
            <BriefingPanel s={s} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Tile icon={<Gauge className="size-5" />} label="Hazard index" value={`${s.index} / 10`} tint={indexColor(s.index)} sub={s.index_reason} />
          <Tile icon={<Users className="size-5" />} label="Crew on site" value={`${crewIn} of ${s.crew.length}`} sub={`Work zone ${s.zone_clear ? 'clear' : 'occupied'}`} />
          <Tile icon={<BookOpen className="size-5" />} label="Next briefing" value={s.next_briefing} sub="English and Spanish · site time" />
        </div>
      </main>

      {/* Bottom tabs */}
      <nav className="flex shrink-0 items-center gap-3 px-7 pt-3 pb-2">
        <Tab to="/dashboard" icon={<LayoutGrid className="size-5" />}>Dashboard</Tab>
        <Tab active icon={<Gauge className="size-5" />}>Hub</Tab>
        <Tab icon={<ClipboardList className="size-5" />} soon>Conditions</Tab>
        <Tab icon={<Camera className="size-5" />} soon>Reports</Tab>
        <button
          onClick={toggleMotion}
          className="ml-auto flex h-12 min-w-64 items-center justify-center gap-3 rounded-md px-5 text-[15px] font-semibold"
          style={{ color: color.chromeText, boxShadow: `inset 0 0 0 1.5px ${color.chromeText}` }}
          aria-pressed={reduced}
        >
          <Accessibility className="size-5" /> Reduced motion: {reduced ? 'ON' : 'OFF'} <Check className="size-4" style={{ color: color.accent }} />
        </button>
      </nav>
      <footer className="flex shrink-0 justify-between px-7 pb-2 font-mono text-[10px] tracking-[0.06em]" style={{ color: color.chromeText, opacity: 0.7 }}>
        <span>SITE SAFETY PLATFORM · {fake ? 'Demo readings for the prototype. Not for real-world safety decisions.' : 'Live readings from the site.'}</span>
        <span>{fake ? 'DEMO FEED' : 'LIVE FEED'} / {s.online ? 'BEACON ONLINE' : 'LOCAL RULES ACTIVE'}</span>
      </footer>
    </div>
  )
}

function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`flex items-center gap-2 rounded-sm px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.08em] ${className}`} style={{ background: 'rgb(10 16 13 / 0.85)', color: color.chromeText, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.15)' }}>
      {children}
    </span>
  )
}

function Tile({ icon, label, value, sub, tint }: { icon: ReactNode; label: string; value: string; sub: string; tint?: string }) {
  return (
    <Panel size={12} depth={0} edge={color.raised} fill={color.raised} inner="flex items-start gap-3 px-5 py-3">
      <span className="mt-0.5" style={{ color: color.muted }}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold tracking-[0.04em] uppercase" style={{ color: color.muted }}>{label}</span>
        <span className="block text-[22px] leading-tight" style={{ color: tint ?? color.text }}>{value}</span>
        <span className="block truncate text-[13px]" style={{ color: color.muted }}>{sub}</span>
      </span>
    </Panel>
  )
}

function Tab({ children, icon, to, active, soon }: { children: string; icon: ReactNode; to?: string; active?: boolean; soon?: boolean }) {
  const body = (
    <span
      className="flex h-12 w-52 items-center gap-3 rounded-md px-5 text-[15px] font-semibold"
      style={{ background: active ? color.accent : color.chromeSoft, color: active ? color.accentInk : color.chromeText, opacity: soon ? 0.5 : 1 }}
      title={soon ? 'Not designed yet' : undefined}
    >
      {icon}
      {children}
    </span>
  )
  return to ? <Link to={`${to}${location.search}`}>{body}</Link> : body
}
