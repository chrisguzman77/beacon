import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Gauge, Radio, TriangleAlert, Users } from 'lucide-react'
import Panel from '@/components/Panel'
import Frame from '@/components/Frame'
import { color, indexColor } from '@/tokens'
import FactorWeb from './FactorWeb'
import type { Focus } from './FactorWeb'
import type { Point } from './FactorDetail'
import SitePicker from './SitePicker'
import DeviceCard from './DeviceCard'
import MusterPanel from './MusterPanel'
import BriefingPanel from './BriefingPanel'
import ReportsPanel from './ReportsPanel'
import { buildFactors, groups, isHazard, worst } from './factors'
import type { Snapshot } from './types'

// HUB, built to Cam's MARSH Figma screens: breadcrumb and headline, the amber warning banner,
// the factor web on the page itself with depth (nodes show only their name and condition; a click
// opens the readings), the right column of cards and the sage stat tiles, inside the shared Frame.
// Every word comes from the site's own conditions, so it reads right for any weather or place.

type Props = { s: Snapshot; live: boolean; history: Record<string, Point[]> }

function headline(s: Snapshot, level: 'clear' | 'caution' | 'danger') {
  if (s.alert_type === 'stopwork' || s.interlock === 'locked') return { crumb: 'URGENT WARNING', text: 'Stop work' }
  if (level === 'danger') return { crumb: 'HAZARD WARNING', text: 'Act now' }
  if (level === 'caution') return { crumb: 'CAUTION', text: 'Stay alert' }
  return { crumb: 'SITE OVERVIEW', text: 'All clear' }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function HubBoard({ s, live, history }: Props) {
  // What the web has open. ?node=heat (the dashboard's Act links) opens that factor, ?node=weather a category.
  const [focus, setFocus] = useState<Focus>(() => {
    const node = new URLSearchParams(location.search).get('node')
    const f = node ? buildFactors(s).find((x) => x.id === node) : undefined
    if (f) return { group: f.group, factor: f.id }
    return groups.some((g) => g.id === node) ? { group: node as Focus['group'] } : {}
  })
  const factors = buildFactors(s)
  const hazards = factors.filter(isHazard)
  const top = worst(hazards)
  const level = top ? (top.status === 'danger' ? 'danger' : 'caution') : 'clear'
  const h = headline(s, level)
  const factor = focus.factor ? factors.find((f) => f.id === focus.factor) : undefined
  const crewIn = s.crew.filter((c) => c.in).length
  const fake = new URLSearchParams(location.search).has('fake')

  // Back one level: factor to its category, category to the overview. Escape does the same.
  const back = () => setFocus((f) => (f.factor ? { group: f.group } : {}))
  useEffect(() => {
    if (!focus.group && !focus.factor) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && back()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [focus])
  const groupLabel = focus.group && groups.find((g) => g.id === focus.group)?.label

  return (
    <Frame
      unit={`SITE UNIT ${pad2(s.site.id)}`}
      active="hub"
      hubTo={`/hub/${s.site.id}`}
      status={
        <>
          <span className="flex items-center gap-2">
            <Radio className="size-4" />
            {!live ? 'No feed' : s.online ? 'Beacon online' : 'Beacon offline'}
          </span>
          <span className="flex items-center gap-2"><Users className="size-4" /> <b>{crewIn}</b> on site</span>
        </>
      }
      footer={[
        fake ? 'Demo readings for the prototype. Not for real-world safety decisions.' : 'Live readings from the site.',
        `${fake ? 'DEMO FEED' : 'LIVE FEED'} / ${s.online ? 'BEACON ONLINE' : 'LOCAL RULES ACTIVE'}`,
      ]}
    >
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: color.muted }}>Site {pad2(s.site.id)} / {h.crumb}</p>
          <h1 className="mt-1 text-[30px] leading-tight font-bold tracking-[-0.01em]">{h.text}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SitePicker current={s.site.id} name={s.site.name} />
          <p className="font-mono text-[11px] tracking-[0.08em]" style={{ color: color.muted }}>
            {s.online ? 'LIVE FROM THE BEACON' : 'LAST KNOWN STATE'}
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
          <button onClick={() => setFocus({ group: top.group, factor: top.id })} className="flex shrink-0 items-center gap-1 text-[15px]">
            View protective actions <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] grid-rows-[minmax(0,1fr)] gap-4">
        {/* The web lies straight on the page; labels float over its edges. */}
        <div className="relative min-h-0">
          <FactorWeb s={s} focus={focus} onFocus={setFocus} history={history} />
          <div className="absolute top-0 left-0 flex items-center gap-2">
            {(focus.group || focus.factor) && (
              <button onClick={back} className="flex h-9 items-center gap-2 rounded-sm px-3 text-[14px] font-semibold" style={{ background: color.accent, color: color.accentInk }} aria-label="Back" title="Back (Esc)">
                <ArrowLeft className="size-4" strokeWidth={2.5} /> Back
              </button>
            )}
            <Chip>
              FACTOR WEB{groupLabel ? ` / ${groupLabel.toUpperCase()}` : ' / LIVE'}{factor ? ` / ${factor.label.toUpperCase()}` : ''}
            </Chip>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 max-w-[30%]" style={{ display: factor ? 'none' : undefined }}>
            <p className="text-[24px] leading-tight font-semibold">{s.site.name}</p>
            <p className="text-[13px]" style={{ color: color.muted }}>
              {hazards.length ? `${hazards.length} factor${hazards.length > 1 ? 's need' : ' needs'} attention` : 'All monitored factors normal'}
              <br />
              {focus.group ? 'Click a factor to see its readings' : 'Click a category to open it'}
            </p>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {s.site.beacon !== false && <DeviceCard s={s} />}
          <MusterPanel s={s} />
          <ReportsPanel s={s} />
          <BriefingPanel s={s} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Tile icon={<Gauge className="size-5" />} label="Hazard index" value={`${s.index} / 10`} tint={indexColor(s.index)} sub={s.index_reason} />
        <Tile icon={<Users className="size-5" />} label="Crew on site" value={`${crewIn} of ${s.crew.length}`} sub={`Work zone ${s.zone_clear ? 'clear' : 'occupied'}`} />
        <Tile icon={<BookOpen className="size-5" />} label="Next briefing" value={s.next_briefing} sub="English and Spanish · site time" />
      </div>
    </Frame>
  )
}

function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`flex items-center gap-2 rounded-sm px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.08em] ${className}`} style={{ background: color.chrome, color: color.chromeText }}>
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
        <span className="line-clamp-2 block text-[13px] leading-snug" style={{ color: color.muted }}>{sub}</span>
      </span>
    </Panel>
  )
}
