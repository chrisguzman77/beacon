import { BookOpen, Camera, KeyRound, Users } from 'lucide-react'
import { alertHazard, hazard, indexColor, indexStops } from '@/tokens'
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
          <p className="text-label font-medium uppercase tracking-[0.18em] text-dim">PlanIT Beacon</p>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{s.site.name}</h1>
        </div>
        <Connection online={s.online} gateway={gateway} />
      </header>

      {alertColor && (
        <div
          className="flex h-12 items-center gap-3 rounded-xl border-l-8 px-4 text-body font-semibold"
          style={{ borderColor: alertColor, backgroundColor: `color-mix(in srgb, ${alertColor} 32%, transparent)` }}
        >
          <span className="size-3 rounded-full animate-beacon-pulse" style={{ backgroundColor: alertColor }} />
          {s.reason}
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-3">
        <section className="flex flex-col justify-between rounded-2xl border-2 border-line bg-surface p-5">
          <p className="text-label font-medium uppercase tracking-[0.18em] text-dim">Hazard index</p>
          <div className="flex items-baseline gap-2">
            <span className="text-display leading-[0.9] font-bold" style={{ color: indexColor(s.index) }}>
              {s.index}
            </span>
            <span className="text-heading font-semibold text-dim">/10</span>
          </div>
          <IndexBar index={s.index} />
          <p className="line-clamp-2 text-body leading-snug">{s.index_reason}</p>
        </section>

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

function Connection({ online, gateway }: { online: boolean; gateway: boolean }) {
  const ok = online && gateway
  const text = !gateway ? 'NO GATEWAY' : online ? 'ONLINE' : 'OFFLINE · LOCAL RULES ACTIVE'
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-label font-semibold tracking-wide ${ok ? 'bg-online/15 text-online' : 'bg-offline/15 text-offline'}`}
    >
      <span className={`size-2.5 rounded-full ${ok ? 'bg-online' : 'bg-offline animate-beacon-pulse'}`} />
      {text}
    </div>
  )
}

function IndexBar({ index }: { index: number }) {
  return (
    <div className="relative h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${indexStops.low}, ${indexStops.mid}, ${indexStops.high})` }}>
      <div
        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg bg-ink"
        style={{ left: `${(index / 10) * 100}%` }}
      />
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-line bg-surface px-5">
      <span className="text-label font-medium uppercase tracking-[0.18em] text-dim">{label}</span>
      <span className="text-[40px] leading-none font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}
