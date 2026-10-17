import type { LucideIcon } from 'lucide-react'
import { cut } from '@/components/Panel'
import { color } from '@/tokens'

// The one kiosk control: chamfered panel, signal stripe foot, panel code tag.
// tone "base" sits on the dark screens, "alarm" sits on the red/purple takeover.
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

export default function KioskButton({ icon: Icon, label, detail, code, tone = 'base', stack, className = '', onClick }: Props) {
  const base = tone === 'base'
  const dim = base ? 'text-dim' : 'text-white/75'
  return (
    <button
      onClick={onClick}
      className={`group relative min-h-tap p-[2px] active:translate-y-[2px] active:bg-signal ${base ? 'bg-line' : 'bg-white'} ${className}`}
      style={{ clipPath: cut(16) }}
    >
      <span
        className={`relative flex h-full w-full items-center justify-center px-4 pb-2 ${stack ? 'flex-col gap-1' : 'gap-3'} ${base ? 'bg-raised' : 'bg-bg'} group-active:bg-surface`}
        style={{ clipPath: cut(15) }}
      >
        {code && (
          <span className={`absolute top-1.5 left-4 font-mono text-[11px] font-semibold tracking-widest ${dim}`}>{code}</span>
        )}
        {stack && detail && (
          <span className="absolute top-1 right-3 font-mono text-label font-bold text-signal">{detail}</span>
        )}
        <span
          className={`flex shrink-0 items-center justify-center text-signal ${stack ? 'size-9' : 'size-10'} bg-black/50`}
          style={{ clipPath: cut(6) }}
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
    </button>
  )
}
