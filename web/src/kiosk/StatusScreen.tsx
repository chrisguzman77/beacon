import { BookOpen, Camera, KeyRound, Users } from 'lucide-react'
import Panel from '@/components/Panel'
import { alertHazard, color, hazard, indexColor, indexStops } from '@/tokens'
import KioskButton from './KioskButton'
import type { Screen } from './Kiosk'
import type { Snapshot } from './types'

type Props = { s: Snapshot; gateway: boolean; go: (screen: Screen) => void }

export default function StatusScreen({ s, gateway, go }: Props) {
  const crewIn = s.crew.filter((c) => c.in).length
  const alertColor = s.alert_type ? hazard[alertHazard[s.alert_type]] : undefined
  const heatDanger = s.heat_index_f >= 103

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <header className="flex h-12 items-center justify-between">
        <div>
          <Label>PlanIT Beacon</Label>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{s.site.name}</h1>
        </div>
        <Connection online={s.online} gateway={gateway} />
      </header>

      {alertColor && (
        <Panel
          className="h-12"
          size={12}
          edge={alertColor}
          fill={`color-mix(in srgb, ${alertColor} 28%, ${color.bg})`}
          inner="flex items-center gap-3 px-4 text-body font-bold tracking-wide"
        >
          <span className="size-3 animate-beacon-pulse" style={{ backgroundColor: alertColor }} />
          {s.reason}
        </Panel>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-3">
        <Panel size={20} inner="flex flex-col justify-between p-5">
          <Label>Hazard index</Label>
          <div className="flex items-baseline gap-2">
            <span className="text-display leading-[0.9] font-bold" style={{ color: indexColor(s.index) }}>
              {s.index}
            </span>
            <span className="text-heading font-semibold text-dim">/10</span>
          </div>
          <IndexBar index={s.index} />
          <p className="line-clamp-2 text-body leading-snug">{s.index_reason}</p>
        </Panel>

        <section className="grid grid-rows-3 gap-3">
          <Stat label="Heat index" value={`${Math.round(s.heat_index_f)}°F`} color={heatDanger ? hazard.heat : undefined} />
          <Stat label="Standing water" value={`${s.water_pct}%`} color={s.water_pct > 0 ? hazard.flood : undefined} />
          <Stat label="Next briefing" value={s.next_briefing} />
        </section>
      </main>

      <nav className="grid grid-cols-4 gap-3">
        <KioskButton stack className="h-[88px]" code="01" icon={Users} label="Crew" detail={`${crewIn}/${s.crew.length}`} onClick={() => go('crew')} />
        <KioskButton stack className="h-[88px]" code="02" icon={KeyRound} label="Supervisor" onClick={() => go('supervisor')} />
        <KioskButton stack className="h-[88px]" code="03" icon={BookOpen} label="Briefing" onClick={() => go('briefing')} />
        <KioskButton stack className="h-[88px]" code="04" icon={Camera} label="Report" onClick={() => go('report')} />
      </nav>
    </div>
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

function Connection({ online, gateway }: { online: boolean; gateway: boolean }) {
  const ok = online && gateway
  const tint = ok ? color.online : color.offline
  const text = !gateway ? 'NO GATEWAY' : online ? 'ONLINE' : 'OFFLINE · LOCAL RULES ACTIVE'
  return (
    <Panel
      size={10}
      edge={tint}
      fill={`color-mix(in srgb, ${tint} 14%, ${color.bg})`}
      inner="flex items-center gap-2 px-4 py-2 font-mono text-label font-bold tracking-wider"
      style={{ color: tint }}
    >
      <span className={`size-2.5 ${ok ? '' : 'animate-beacon-pulse'}`} style={{ backgroundColor: tint }} />
      {text}
    </Panel>
  )
}

function IndexBar({ index }: { index: number }) {
  return (
    <div className="relative h-2" style={{ background: `linear-gradient(90deg, ${indexStops.low}, ${indexStops.mid}, ${indexStops.high})` }}>
      <div className="absolute -top-1.5 h-5 w-1.5 -translate-x-1/2 bg-ink outline-2 outline-bg" style={{ left: `${(index / 10) * 100}%` }} />
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Panel size={14} inner="flex items-center justify-between px-5">
      <Label>{label}</Label>
      <span className="text-[40px] leading-none font-semibold" style={{ color }}>{value}</span>
    </Panel>
  )
}
