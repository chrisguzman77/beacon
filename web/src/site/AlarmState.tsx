import type { ReactNode } from 'react'
import { Check, Footprints, KeyRound, Radar, Scan, ShieldAlert, TriangleAlert, Users, Wrench } from 'lucide-react'
import { color } from '@/tokens'
import { formatCountdown } from './store'
import type { Snapshot } from './types'

// The site page's alarm state on the beacon site, built to Cam's MARSH "urgent warning" screen.
// Takes over the page; no click dismisses it. It leaves only when the alert clears (supervisor
// PIN on the beacon remote, or the dashboard clear). The countdown is the largest thing on the
// page and always comes from the beacon, never a local timer.
export default function AlarmState({ s }: { s: Snapshot }) {
  const stillIn = s.crew.filter((c) => c.in)
  const unsafe = s.alert_type === 'beacon_unsafe' || s.alert_type === 'estop'
  const category = unsafe ? 'BEACON / EQUIPMENT UNSAFE' : s.alert_type === 'stopwork' ? 'LIGHTNING / STOP WORK' : 'STOP WORK'
  const title = unsafe ? 'Stop work. Make the equipment safe.' : 'Stop work. Clear the zone.'
  const miles = s.reason.match(/(\d+)\s*MI/)?.[1]
  const sub = unsafe ? s.reason || 'Equipment power is cut' : miles ? `Strike detected ${miles} mi away · the clock restarts on every new strike` : s.reason

  return (
    <div className="flex h-full flex-col" style={{ background: color.chrome, color: color.text }}>
      <header className="flex h-14 shrink-0 items-center justify-between px-7" style={{ color: color.chromeText }}>
        <div className="flex items-center gap-3">
          <Scan className="size-6" style={{ color: color.accent }} strokeWidth={2.25} />
          <span className="text-[19px] font-bold tracking-tight">OmniRisk</span>
          <span className="font-mono text-[12px] opacity-70">/ SITE UNIT {String(s.site.id).padStart(2, '0')}</span>
        </div>
        <span className="text-[13px] font-semibold tracking-wide" style={{ color: color.accent }}>{s.online ? 'STOP WORK IN EFFECT' : 'OFFLINE · LOCAL RULES ACTIVE'}</span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-5 rounded-sm px-7 py-6" style={{ background: color.bg }}>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.12em]" style={{ color: color.muted }}>SITE {String(s.site.id).padStart(2, '0')} / URGENT WARNING</p>
            <h1 className="mt-1 text-[30px] leading-tight font-bold">Stop work</h1>
          </div>
          <p className="text-[16px] font-bold">{s.site.name}</p>
        </div>

        {/* The act now banner, countdown on the right */}
        <section className="flex items-stretch gap-6 rounded-md px-6 py-5" style={{ background: color.accent, boxShadow: `inset 0 0 0 1.5px ${color.text}` }}>
          <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 border-r pr-6" style={{ borderColor: 'rgb(29 40 34 / 0.35)' }}>
            <TriangleAlert className="size-12" strokeWidth={1.75} />
            <span className="text-[12px] font-bold">ACT NOW</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="font-mono text-[11px] tracking-[0.1em]">{category}</p>
            <h2 className="text-[34px] leading-tight font-bold">{title}</h2>
            <p className="text-[16px]">{sub}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end justify-center border-l pl-6" style={{ borderColor: 'rgb(29 40 34 / 0.35)' }}>
            {s.countdown > 0 ? (
              <>
                <span className="font-mono text-[112px] leading-[0.9] font-bold tabular-nums">{formatCountdown(s.countdown)}</span>
                <span className="font-mono text-[11px] tracking-[0.1em]">UNTIL WORK MAY RESUME</span>
              </>
            ) : s.awaiting_clear ? (
              <>
                <span className="font-mono text-[112px] leading-[0.9] font-bold opacity-40">00:00</span>
                <span className="font-mono text-[12px] font-bold tracking-[0.1em] animate-beacon-pulse">SUPERVISOR PIN REQUIRED</span>
              </>
            ) : (
              <>
                <span className="text-[56px] leading-none font-bold">LOCKED</span>
                <span className="font-mono text-[11px] tracking-[0.1em]">EQUIPMENT POWER IS CUT</span>
              </>
            )}
          </div>
        </section>

        <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-5">
          {/* Immediate protective actions */}
          <section className="flex flex-col gap-4 rounded-md p-6" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
            <header className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold uppercase">Immediate protective actions</h3>
              <span className="font-mono text-[11px]" style={{ color: color.muted }}>3 steps</span>
            </header>
            <Step n={1} icon={<Wrench className="size-5" />} title="Stop and secure the work" done={s.interlock === 'locked'}>
              The beacon has cut equipment power. Stow tools and do not restart anything until the all clear.
            </Step>
            <Step n={2} icon={<Footprints className="size-5" />} title="Clear the work zone" done={s.zone_clear}>
              Move away from open ground, tall objects and metal equipment. The radar shows when the zone is empty.
            </Step>
            <Step n={3} icon={<Users className="size-5" />} title="Get to shelter and stay accounted for" done={stillIn.length === 0}>
              Use a hard-roofed vehicle or an enclosed building. An open canopy is not shelter.
            </Step>
          </section>

          {/* Status, dark panel */}
          <section className="flex flex-col gap-4 rounded-md p-6" style={{ background: color.chrome, color: color.chromeText }}>
            <header className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold uppercase">Zone and crew</h3>
              <span className="font-mono text-[11px] opacity-70">LIVE FROM THE BEACON</span>
            </header>
            <Row icon={<Radar className="size-5" />} label="Work zone" value={s.zone_clear ? 'Clear' : 'Occupied'} hot={!s.zone_clear} />
            <Row icon={<Users className="size-5" />} label="Still checked in" value={String(stillIn.length)} hot={stillIn.length > 0} />
            {stillIn.length > 0 && <p className="text-[14px] opacity-85">{stillIn.map((c) => c.name).join(', ')}</p>}
            <div className="mt-auto flex items-start gap-3 border-t pt-4" style={{ borderColor: 'rgb(245 247 237 / 0.15)' }}>
              <KeyRound className="mt-0.5 size-5 shrink-0" style={{ color: color.accent }} />
              <p className="text-[14px]">
                <b>Release:</b> after the countdown, a supervisor presses OK, the four digit PIN, and OK on the beacon remote.
                <span className="mt-1 block opacity-70">This screen cannot be dismissed here.</span>
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="flex shrink-0 items-center justify-between px-7 py-2 font-mono text-[10px] tracking-[0.06em]" style={{ color: color.chromeText, opacity: 0.7 }}>
        <span className="flex items-center gap-2"><ShieldAlert className="size-3.5" /> STOP WORK IS ENFORCED BY THE BEACON, ONLINE OR OFFLINE</span>
        <span>{s.online ? 'BEACON ONLINE' : 'LOCAL RULES ACTIVE'}</span>
      </footer>
    </div>
  )
}

function Step({ n, icon, title, done, children }: { n: number; icon: ReactNode; title: string; done: boolean; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-sm text-[16px] font-bold" style={{ background: done ? color.signal : color.raised, color: done ? color.surface : color.text }}>
        {done ? <Check className="size-5" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[18px] font-bold">{title}</p>
        <p className="text-[14px]" style={{ color: color.muted }}>{children}</p>
      </div>
      <span style={{ color: color.muted }}>{icon}</span>
    </div>
  )
}

function Row({ icon, label, value, hot }: { icon: ReactNode; label: string; value: string; hot: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-3 text-[15px] opacity-85">{icon}{label}</span>
      <span className="text-[26px] font-semibold" style={{ color: hot ? color.accent : color.chromeText }}>{value}</span>
    </div>
  )
}
