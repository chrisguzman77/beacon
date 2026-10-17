import { Gamepad2 } from 'lucide-react'
import Fold from '@/components/Fold'
import { Pill } from '@/components/marsh'
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
    <Fold
      id="hub.muster"
      title="Muster"
      summary={`${crewIn} of ${crew.length} in`}
      edge={!s.zone_clear && stop ? hazard.stopwork : undefined}
      badge={
        <Pill tint={zoneTint} solid={!s.zone_clear && stop}>Zone {s.zone_clear ? 'clear' : 'occupied'}</Pill>
      }
    >
     <div className="flex flex-col gap-3">

      <p className="flex items-baseline gap-2">
        <span className="text-[44px] leading-none font-semibold">{crewIn}</span>
        <span className="text-[18px]" style={{ color: color.muted }}>of {crew.length} checked in</span>
      </p>

      {crew.length === 0 ? (
        <p className="text-label text-dim">Nobody is on today's roster yet. Crew check in on the phone page or with the beacon remote.</p>
      ) : (
        <ul className="flex flex-col">
          {crew.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-t border-line py-2.5 first:border-t-0">
              <span className="flex items-center gap-2 text-[15px]" style={{ color: c.in ? color.text : color.muted }}>
                {c.name}
                {c.roblox && <Gamepad2 className="size-4 text-dim" aria-label="Roblox player" />}
              </span>
              <Pill tint={c.in ? (stop ? hazard.stopwork : color.signal) : color.muted}>{c.in ? 'In' : 'Out'}</Pill>
            </li>
          ))}
        </ul>
      )}
     </div>
    </Fold>
  )
}
