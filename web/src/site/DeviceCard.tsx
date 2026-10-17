import { Fan, Radar, Users } from 'lucide-react'
import Panel from '@/components/Panel'
import { LiveBadge } from '@/dashboard/RankedList'
import { color, device, hazard } from '@/tokens'
import { formatCountdown } from './store'
import type { Snapshot } from './types'

// Beacon site only: the physical beacon mirrored live. LED, the four digit countdown, the one
// digit crew display, the LCD1602 lines exactly as shown, interlock and radar zone.
// Offline it keeps the last state and says LOCAL RULES ACTIVE instead of going blank.

const ledColor: Record<Snapshot['led'], string> = { green: color.signal, yellow: hazard.heat, red: hazard.stopwork, strobe: color.text }

export default function DeviceCard({ s }: { s: Snapshot }) {
  const crewIn = s.crew.filter((c) => c.in).length
  const locked = s.interlock === 'locked'
  const lcd = s.lcd ?? ['', '']

  return (
    <Panel size={18} depth={2} edge={locked ? hazard.stopwork : color.border} inner="flex flex-col gap-4 p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-body font-bold tracking-[0.12em] uppercase">Beacon</h2>
        <LiveBadge />
      </header>

      {!s.online && (
        <Panel size={10} depth={0} edge={color.offline} fill={`color-mix(in srgb, ${color.offline} 14%, ${color.bg})`} inner="px-4 py-3 font-mono text-label font-bold tracking-wider" style={{ color: color.offline }}>
          OFFLINE · LOCAL RULES ACTIVE
          <span className="mt-1 block font-sans text-label font-normal tracking-normal text-dim">Showing the last state the beacon sent. It keeps enforcing stop work on its own.</span>
        </Panel>
      )}

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <Light c={ledColor[s.led]} strobe={s.led === 'strobe'} />
        <Digits text={s.countdown > 0 ? formatCountdown(Math.min(s.countdown, 5999)) : '--:--'} lit={s.countdown > 0} />
        <Digits text={String(Math.min(crewIn, 9))} lit label="crew" />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-dim uppercase">LCD</h3>
        <div className="px-4 py-3 font-mono text-[19px] leading-snug whitespace-pre" style={{ background: device.lcdBg, color: device.lcdInk, boxShadow: 'inset 0 0 0 3px rgb(0 0 0 / 0.45), inset 0 0 18px rgb(0 0 0 / 0.5)' }}>
          {(lcd[0] ?? '').padEnd(16)}
          {'\n'}
          {(lcd[1] ?? '').padEnd(16)}
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3">
        <Fact icon={<Fan className={`size-5 ${locked ? '' : 'animate-spin'}`} style={{ animationDuration: '1.2s' }} />} label="Equipment" value={locked ? 'LOCKED' : 'RUNNING'} tint={locked ? hazard.stopwork : color.signal} />
        <Fact icon={<Radar className="size-5" />} label="Work zone" value={s.zone_clear ? 'CLEAR' : 'OCCUPIED'} tint={s.zone_clear ? color.signal : s.alert_type === 'stopwork' ? hazard.stopwork : color.text} />
        <Fact icon={<Users className="size-5" />} label="Crew in" value={`${crewIn} of ${s.crew.length}`} />
        <Fact icon={<span className="size-2.5" style={{ background: s.online ? color.online : color.offline }} />} label="Link" value={s.online ? 'ONLINE' : 'OFFLINE'} tint={s.online ? color.online : color.offline} />
      </dl>
    </Panel>
  )
}

function Light({ c, strobe }: { c: string; strobe: boolean }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className={`size-10 rounded-full ${strobe ? 'animate-beacon-pulse' : ''}`} style={{ background: c, boxShadow: `0 0 18px ${c}, inset 0 -4px 8px rgb(0 0 0 / 0.35)` }} />
      <span className="font-mono text-[10px] font-bold tracking-widest text-dim">LED</span>
    </span>
  )
}

// LED digit display replica (the four digit countdown and the one digit crew count).
function Digits({ text, lit, label }: { text: string; lit: boolean; label?: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="px-3 py-1 font-mono text-[34px] leading-none font-bold tracking-[0.08em]" style={{ background: '#000', color: lit ? device.digit : device.digitOff, textShadow: lit ? `0 0 10px ${device.digit}` : undefined }}>
        {text}
      </span>
      <span className="font-mono text-[10px] font-bold tracking-widest text-dim uppercase">{label ?? 'countdown'}</span>
    </span>
  )
}

function Fact({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2" style={{ boxShadow: `inset 0 0 0 1px ${color.border}` }}>
      <span className="text-dim">{icon}</span>
      <span>
        <dt className="font-mono text-[10px] font-bold tracking-widest text-dim uppercase">{label}</dt>
        <dd className="text-body leading-tight font-bold" style={{ color: tint ?? color.text }}>{value}</dd>
      </span>
    </div>
  )
}
