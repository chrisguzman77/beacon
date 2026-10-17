import { useState } from 'react'
import { BookOpen, Camera, KeyRound, RotateCcw, Users } from 'lucide-react'
import Panel from '@/components/Panel'
import { color } from '@/tokens'
import FactorWeb, { resetLayout } from './FactorWeb'
import KioskButton from './KioskButton'
import type { Screen } from './Kiosk'
import type { Snapshot } from './types'

type Props = { s: Snapshot; gateway: boolean; go: (screen: Screen) => void }

export default function StatusScreen({ s, gateway, go }: Props) {
  const crewIn = s.crew.filter((c) => c.in).length
  const [layout, setLayout] = useState(0)

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <header className="flex items-center justify-between gap-6">
        <div>
          <Label>PlanIT Beacon</Label>
          <h1 className="text-heading leading-tight font-semibold tracking-tight">{s.site.name}</h1>
        </div>
        <Legend />
        <div className="flex items-center gap-4">
          <KioskButton
            className="h-tap w-52"
            icon={RotateCcw}
            label="Reset"
            detail="Factor layout"
            onClick={() => {
              resetLayout()
              setLayout((n) => n + 1)
            }}
          />
          <Connection online={s.online} gateway={gateway} />
        </div>
      </header>

      <Panel className="min-h-0 flex-1" size={22} fill={color.bg}>
        <FactorWeb key={layout} s={s} />
      </Panel>

      <nav className="grid grid-cols-4 gap-4">
        <KioskButton className="h-[84px]" code="01" icon={Users} label="Crew" detail={`${crewIn} of ${s.crew.length} checked in`} onClick={() => go('crew')} />
        <KioskButton className="h-[84px]" code="02" icon={KeyRound} label="Supervisor" detail="PIN release" onClick={() => go('supervisor')} />
        <KioskButton className="h-[84px]" code="03" icon={BookOpen} label="Briefing" detail="Tomorrow" onClick={() => go('briefing')} />
        <KioskButton className="h-[84px]" code="04" icon={Camera} label="Report" detail="Hazard photo" onClick={() => go('report')} />
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

function Legend() {
  const items = [
    { label: 'OK', c: color.signal },
    { label: 'Caution', c: color.offline },
    { label: 'Danger', c: color.text, fill: true },
    { label: 'Info', c: color.border },
  ]
  return (
    <div className="flex items-center gap-5 font-mono text-label font-semibold uppercase tracking-wider text-dim">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2">
          <span className="size-3 border-2" style={{ borderColor: i.c, background: i.fill ? i.c : undefined }} />
          {i.label}
        </span>
      ))}
      <span className="normal-case tracking-normal">· drag nodes to arrange</span>
    </div>
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
