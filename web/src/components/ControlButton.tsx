import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cut, lift, sheen } from '@/components/Panel'
import { color } from '@/tokens'

// The one control style: chamfered raised panel, signal stripe foot, panel code tag.
// Pressing sinks it (shadow shrinks, 2 px down). tone "alarm" sits on the red/purple takeover.
// stack puts the icon above the label for narrow buttons; detail then shows in the corner tag.

type Props = {
  icon: LucideIcon
  label: string
  detail?: string
  code?: string
  tone?: 'base' | 'alarm'
  stack?: boolean
  className?: string
  onClick: () => void
}

export default function ControlButton({ icon: Icon, label, detail, code, tone = 'base', stack, className = '', onClick }: Props) {
  const base = tone === 'base'
  const dim = base ? 'text-dim' : 'text-white/75'
  return (
    <button
      onClick={onClick}
      className={`group relative min-h-tap [filter:var(--lift)] active:translate-y-[2px] active:[filter:var(--press)] ${className}`}
      style={{ '--lift': lift(2), '--press': lift(1) } as CSSProperties}
    >
      <span
        className={`block h-full w-full p-[2px] group-active:bg-signal ${base ? 'bg-line' : 'bg-white'}`}
        style={{ clipPath: cut(16) }}
      >
        <span
          className={`relative flex h-full w-full items-center justify-center px-4 pb-2 ${stack ? 'flex-col gap-1' : 'gap-3'}`}
          style={{ clipPath: cut(15), background: `${sheen}, ${base ? color.raised : color.bg}` }}
        >
          {code && (
            <span className={`absolute top-1.5 left-4 font-mono text-[11px] font-semibold tracking-widest ${dim}`}>{code}</span>
          )}
          {stack && detail && (
            <span className="absolute top-1 right-3 font-mono text-label font-bold text-signal">{detail}</span>
          )}
          <span
            className={`flex shrink-0 items-center justify-center bg-black/50 text-signal ${stack ? 'size-9' : 'size-10'}`}
            style={{ clipPath: cut(6), boxShadow: 'inset 0 2px 6px rgb(0 0 0 / 0.8)' }}
          >
            <Icon className="size-6" strokeWidth={2.25} />
          </span>
          <span className={`flex flex-col leading-tight ${stack ? 'items-center' : 'items-start'}`}>
            <span className={`font-bold tracking-[0.12em] uppercase ${stack ? 'text-[17px]' : 'text-body'}`}>{label}</span>
            {!stack && detail && <span className={`text-label font-medium ${dim}`}>{detail}</span>}
          </span>
          <span
            className="absolute inset-x-0 bottom-0 h-2 opacity-70 group-active:opacity-100"
            style={{ background: `repeating-linear-gradient(-45deg, ${color.signal} 0 8px, ${color.bg} 8px 16px)` }}
          />
        </span>
      </span>
    </button>
  )
}
