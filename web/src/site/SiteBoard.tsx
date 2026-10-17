import { useEffect, useRef, useState } from 'react'
import { Scan } from 'lucide-react'
import Panel from '@/components/Panel'
import ControlButton from '@/components/ControlButton'
import AppNav from '@/components/AppNav'
import { color } from '@/tokens'
import FactorWeb from './FactorWeb'
import FactorDetail from './FactorDetail'
import type { Point } from './FactorDetail'
import SitePicker from './SitePicker'
import DeviceCard from './DeviceCard'
import MusterPanel from './MusterPanel'
import BriefingPanel from './BriefingPanel'
import { buildFactors } from './factors'
import type { FactorWebHandle } from './FactorWeb'
import type { Snapshot } from './types'

// The site page's live board: header plus the factor web. Device card, muster, briefing and
// the other site panels join it as the site page is built.
type Props = { s: Snapshot; live: boolean; idle: boolean; history: Record<string, Point[]> }

export default function SiteBoard({ s, live, idle, history }: Props) {
  const web = useRef<FactorWebHandle>(null)
  // ?node=heat opens a factor's detail directly (shareable link).
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(location.search).get('node'))
  const factor = selected ? buildFactors(s).find((f) => f.id === selected) : undefined

  useEffect(() => {
    if (!selected) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [selected])

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-1 whitespace-nowrap">
            <Label>PlanIT Beacon · Hub</Label>
            <SitePicker current={s.site.id} name={s.site.name} />
          </div>
          <AppNav />
        </div>
        <div className="flex items-center gap-4">
          <ControlButton className="h-tap w-52 shrink-0" icon={Scan} label="Recenter" detail="Fit the web" onClick={() => web.current?.fit()} />
          <Connection online={s.online} gateway={live} />
        </div>
      </header>

      {/* Draft layout (Cam picked web + right column; expect changes). */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] grid-rows-[minmax(0,1fr)] gap-4">
        <Panel size={22} fill={color.bg} depth={2}>
          <FactorWeb ref={web} s={s} tour={idle && !selected} selected={selected} onSelect={setSelected} />
          {factor && <FactorDetail x={factor} history={history[factor.id] ?? []} onClose={() => setSelected(null)} />}
          <Legend />
        </Panel>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {s.site.beacon !== false && <DeviceCard s={s} />}
          <MusterPanel s={s} />
          <BriefingPanel s={s} />
        </div>
      </div>

      <nav className="flex gap-2">
        {['Conditions', 'Reports', 'Scenario', 'Compliance log'].map((t) => (
          <Placeholder key={t} title={t} tab />
        ))}
      </nav>
    </div>
  )
}

// Stand-in for a panel we have not designed yet.
function Placeholder({ title, tab }: { title: string; tab?: boolean }) {
  return (
    <Panel size={tab ? 10 : 14} depth={tab ? 0 : 1} inner={tab ? 'px-4 py-2 font-mono text-label font-bold tracking-[0.18em] text-dim uppercase' : 'flex flex-col gap-1 p-5'}>
      {tab ? (
        title
      ) : (
        <>
          <h2 className="text-body font-bold tracking-[0.12em] uppercase">{title}</h2>
          <p className="text-label text-dim">Not designed yet. We will shape this panel together.</p>
        </>
      )}
    </Panel>
  )
}

function Label({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-2 text-label font-semibold uppercase tracking-[0.18em] text-dim">
      <span className="size-1.5 bg-signal" />
      {children}
    </p>
  )
}

function Legend() {
  const items = [
    { label: 'OK', c: color.signal },
    { label: 'Caution', c: color.offline },
    { label: 'Danger', c: color.text, fill: true },
    { label: 'Info', c: color.border },
  ]
  return (
    <div className="pointer-events-none absolute bottom-4 left-4">
      <Panel size={10} depth={2} fill={`color-mix(in srgb, ${color.bg} 88%, transparent)`} inner="flex flex-col gap-2 px-4 py-3 font-mono text-[11px] font-bold tracking-wider text-dim uppercase">
        <span className="flex items-center gap-4">
          {items.map((i) => (
            <span key={i.label} className="flex items-center gap-1.5">
              <span className="size-3 border-2" style={{ borderColor: i.c, background: i.fill ? i.c : undefined }} />
              {i.label}
            </span>
          ))}
        </span>
        <span className="normal-case tracking-normal">Drag to pan · scroll to zoom</span>
      </Panel>
    </div>
  )
}

function Connection({ online, gateway }: { online: boolean; gateway: boolean }) {
  const ok = online && gateway
  const tint = ok ? color.online : color.offline
  const text = !gateway ? 'NO FEED' : online ? 'BEACON ONLINE' : 'BEACON OFFLINE · LOCAL RULES ACTIVE'
  return (
    <Panel
      size={10}
      edge={tint}
      fill={`color-mix(in srgb, ${tint} 14%, ${color.bg})`}
      inner="flex items-center gap-2 whitespace-nowrap px-4 py-2 font-mono text-label font-bold tracking-wider"
      style={{ color: tint }}
    >
      <span className={`size-2.5 ${ok ? '' : 'animate-beacon-pulse'}`} style={{ backgroundColor: tint }} />
      {text}
    </Panel>
  )
}
