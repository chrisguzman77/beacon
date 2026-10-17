import { Check, KeyRound, OctagonX } from 'lucide-react'
import { takeover } from '@/tokens'
import Panel from '@/components/Panel'
import KioskButton from './KioskButton'
import { formatCountdown } from './store'
import type { Snapshot } from './types'

type Props = { s: Snapshot; onSupervisor: () => void }

// Takes over the whole screen. No tap dismisses it: it leaves only when the snapshot does.
export default function StopWorkScreen({ s, onSupervisor }: Props) {
  const unsafe = s.alert_type === 'beacon_unsafe' || s.alert_type === 'estop'
  const stillIn = s.crew.filter((c) => c.in)

  return (
    <div
      className="flex h-full flex-col p-5 text-white"
      style={{ backgroundColor: unsafe ? takeover.unsafe : takeover.stopwork }}
    >
      <header className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 text-heading leading-none font-black tracking-[0.08em]">
            <OctagonX className="size-9" strokeWidth={2.5} /> STOP WORK
          </p>
          <p className="mt-2 text-heading leading-none font-semibold text-white/90">{s.reason || 'EQUIPMENT LOCKED'}</p>
        </div>
        <KioskButton tone="alarm" className="h-tap w-56" icon={KeyRound} label="Supervisor" detail="PIN release" onClick={onSupervisor} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center">
        {s.countdown > 0 ? (
          <>
            <p className="text-countdown leading-[0.82] font-bold tracking-tight">{formatCountdown(s.countdown)}</p>
            <p className="mt-3 text-label font-semibold tracking-[0.2em] text-white/80">
              UNTIL WORK MAY RESUME · RESTARTS ON EVERY STRIKE
            </p>
          </>
        ) : s.awaiting_clear ? (
          <>
            <p className="text-countdown leading-[0.82] font-bold tracking-tight text-white/50">00:00</p>
            <p className="mt-3 text-body font-bold tracking-[0.14em] animate-beacon-pulse">SUPERVISOR PIN REQUIRED TO RESTORE POWER</p>
          </>
        ) : (
          <>
            <p className="text-display leading-none font-black tracking-tight">LOCKED OUT</p>
            <p className="mt-3 text-label font-semibold tracking-[0.2em] text-white/80">EQUIPMENT POWER IS CUT</p>
          </>
        )}
      </main>

      <footer className="flex items-center gap-4">
        {s.zone_clear ? (
          <Panel className="h-14 shrink-0" size={12} edge="rgb(255 255 255 / 0.6)" fill="rgb(0 0 0 / 0.35)" inner="flex items-center gap-2 px-5 text-body font-bold tracking-wide">
            <Check className="size-6" strokeWidth={3} /> ZONE CLEAR
          </Panel>
        ) : (
          <Panel
            className="h-14 shrink-0"
            size={12}
            edge="white"
            fill="white"
            inner="flex items-center gap-3 px-5 text-body font-black tracking-wide"
            style={{ color: unsafe ? takeover.unsafe : takeover.stopwork }}
          >
            <span className="size-3 bg-current animate-beacon-pulse" /> ZONE OCCUPIED
          </Panel>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold tracking-[0.18em] text-white/70">
            {stillIn.length ? `STILL CHECKED IN · ${stillIn.length}` : 'CREW'}
          </p>
          <p className="truncate text-body font-semibold">
            {stillIn.length ? stillIn.map((c) => c.name).join(', ') : 'Everyone has checked out.'}
          </p>
        </div>
        {!s.online && (
          <Panel className="shrink-0" size={10} edge="rgb(255 255 255 / 0.6)" fill="rgb(0 0 0 / 0.35)" inner="px-3 py-2 text-right font-mono text-label leading-tight font-bold tracking-wide">
            OFFLINE
            <br />
            LOCAL RULES ACTIVE
          </Panel>
        )}
      </footer>
    </div>
  )
}
