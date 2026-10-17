import { Gamepad2 } from 'lucide-react'
import Panel from '@/components/Panel'
import { color, hazard } from '@/tokens'
import type { Snapshot } from './types'

// Draft (Cam: headcount + roster). Big headcount and radar zone status, then everyone with an
// IN or OUT tag, checked in first. Roblox players carry a controller icon.
export default function MusterPanel({ s }: { s: Snapshot }) {
  const crew = [...s.crew].sort((a, b) => Number(b.in) - Number(a.in))
  const crewIn = crew.filter((c) => c.in).length
  const stop = s.alert_type === 'stopwork'
  const zoneTint = s.zone_clear ? color.signal : stop ? hazard.stopwork : color.text

  return (
    <Panel size={14} depth={1} edge={!s.zone_clear && stop ? hazard.stopwork : undefined} inner="flex flex-col gap-3 p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-body font-bold tracking-[0.12em] uppercase">Muster</h2>
        <span className="px-2 py-1 font-mono text-label font-bold tracking-wider" style={{ color: zoneTint, boxShadow: `inset 0 0 0 1px ${zoneTint}` }}>
          ZONE {s.zone_clear ? 'CLEAR' : 'OCCUPIED'}
        </span>
      </header>

      <p className="flex items-baseline gap-2">
        <span className="font-mono text-label font-bold tracking-widest text-dim">IN</span>
        <span className="text-[44px] leading-none font-bold">{crewIn}</span>
        <span className="text-heading font-semibold text-dim">/ {crew.length}</span>
      </p>

      {crew.length === 0 ? (
        <p className="text-label text-dim">Nobody is on today's roster yet. Crew check in on the phone page or with the beacon remote.</p>
      ) : (
        <ul className="flex flex-col">
          {crew.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-t border-line py-2 first:border-t-0">
              <span className="flex items-center gap-2 text-body" style={{ color: c.in ? color.text : color.muted }}>
                {c.name}
                {c.roblox && <Gamepad2 className="size-4 text-dim" aria-label="Roblox player" />}
              </span>
              <span className="font-mono text-label font-bold tracking-wider" style={{ color: c.in ? (stop ? hazard.stopwork : color.signal) : color.muted }}>
                {c.in ? 'IN' : 'OUT'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
