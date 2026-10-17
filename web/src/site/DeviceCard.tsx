import { Fan, Radar, Users } from 'lucide-react'
import Fold from '@/components/Fold'
import { label as labelCls } from '@/components/marsh'
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
    <Fold id="hub.device" title="Beacon" defaultOpen badge={<LiveBadge />} edge={locked ? hazard.stopwork : undefined} summary={s.online ? (locked ? 'Locked out' : 'Running') : 'Offline'}>
     <div className="flex flex-col gap-4">

      {!s.online && (
        <div className="rounded-md px-4 py-3" style={{ background: color.accentPale, borderLeft: `4px solid ${color.offline}` }}>
          <p className="text-[14px] font-semibold">Offline · local rules active</p>
          <p className="text-[13px]" style={{ color: color.muted }}>Showing the last state the beacon sent. It keeps enforcing stop work on its own.</p>
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <Light c={ledColor[s.led]} strobe={s.led === 'strobe'} />
        <Digits text={s.countdown > 0 ? formatCountdown(Math.min(s.countdown, 5999)) : '--:--'} lit={s.countdown > 0} />
        <Digits text={String(Math.min(crewIn, 9))} lit label="crew" />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className={labelCls} style={{ color: color.muted }}>LCD</h3>
        <div className="rounded-md px-4 py-3 font-mono text-[19px] leading-snug whitespace-pre" style={{ background: device.lcdBg, color: device.lcdInk, boxShadow: 'inset 0 0 0 3px rgb(0 0 0 / 0.45), inset 0 0 18px rgb(0 0 0 / 0.5)' }}>
          {(lcd[0] ?? '').padEnd(16)}
          {'\n'}
          {(lcd[1] ?? '').padEnd(16)}
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3">
        <Fact icon={<Fan className={`size-5 ${locked ? '' : 'animate-spin'}`} style={{ animationDuration: '1.2s' }} />} label="Equipment" value={locked ? 'Locked out' : 'Running'} tint={locked ? hazard.stopwork : color.signal} />
        <Fact icon={<Radar className="size-5" />} label="Work zone" value={s.zone_clear ? 'Clear' : 'Occupied'} tint={s.zone_clear ? color.signal : s.alert_type === 'stopwork' ? hazard.stopwork : color.text} />
        <Fact icon={<Users className="size-5" />} label="Crew in" value={`${crewIn} of ${s.crew.length}`} />
        <Fact icon={<span className="block size-2.5 rounded-full" style={{ background: s.online ? color.online : color.offline }} />} label="Link" value={s.online ? 'Online' : 'Offline'} tint={s.online ? color.online : color.offline} />
      </dl>
     </div>
    </Fold>
  )
}

function Light({ c, strobe }: { c: string; strobe: boolean }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className={`size-10 rounded-full ${strobe ? 'animate-beacon-pulse' : ''}`} style={{ background: c, boxShadow: `0 0 18px ${c}, inset 0 -4px 8px rgb(0 0 0 / 0.35)` }} />
      <span className={labelCls} style={{ color: color.muted }}>LED</span>
    </span>
  )
}

// LED digit display replica (the four digit countdown and the one digit crew count).
function Digits({ text, lit, label }: { text: string; lit: boolean; label?: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="rounded-sm px-3 py-1 font-mono text-[34px] leading-none font-bold tracking-[0.08em]" style={{ background: '#000', color: lit ? device.digit : device.digitOff, textShadow: lit ? `0 0 10px ${device.digit}` : undefined }}>
        {text}
      </span>
      <span className={labelCls} style={{ color: color.muted }}>{label ?? 'Countdown'}</span>
    </span>
  )
}

function Fact({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5" style={{ background: color.bg }}>
      <span style={{ color: color.muted }}>{icon}</span>
      <span>
        <dt className={labelCls} style={{ color: color.muted }}>{label}</dt>
        <dd className="text-[16px] leading-tight font-semibold" style={{ color: tint ?? color.text }}>{value}</dd>
      </span>
    </div>
  )
}
