import type { LucideIcon } from 'lucide-react'
import { color } from '@/tokens'

// The one kiosk control: chamfered panel, hazard stripe foot, panel code tag.
// tone "navy" sits on the navy screens, "alarm" sits on the red/purple takeover.
// stack puts the icon above the label for narrow buttons; detail then shows in the corner tag.

const cut = (px: number) =>
  `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`

type Props = {
  icon: LucideIcon
  label: string
  detail?: string
  code?: string
  tone?: 'navy' | 'alarm'
  stack?: boolean
  className?: string
  onClick: () => void
}

export default function KioskButton({ icon: Icon, label, detail, code, tone = 'navy', stack, className = '', onClick }: Props) {
  const navy = tone === 'navy'
  const dim = navy ? 'text-dim' : 'text-white/75'
  return (
    <button
      onClick={onClick}
      className={`group relative min-h-tap p-[2px] active:translate-y-[2px] ${navy ? 'bg-line active:bg-safety' : 'bg-white active:bg-safety'} ${className}`}
      style={{ clipPath: cut(16) }}
    >
      <span
        className={`relative flex h-full w-full items-center justify-center px-4 pb-2 ${stack ? 'flex-col gap-1' : 'gap-3'} ${navy ? 'bg-raised group-active:bg-surface' : 'bg-bg group-active:bg-surface'}`}
        style={{ clipPath: cut(15) }}
      >
        {code && (
          <span className={`absolute top-1.5 left-4 font-mono text-[11px] font-semibold tracking-widest ${dim}`}>{code}</span>
        )}
        {stack && detail && (
          <span className="absolute top-1 right-3 font-mono text-label font-bold text-online">{detail}</span>
        )}
        <span
          className={`flex shrink-0 items-center justify-center ${stack ? 'size-9' : 'size-10'} bg-black/40`}
          style={{ clipPath: cut(6) }}
        >
          <Icon className="size-6" strokeWidth={2.25} />
        </span>
        <span className={`flex flex-col leading-tight ${stack ? 'items-center' : 'items-start'}`}>
          <span className={`font-bold tracking-[0.12em] uppercase ${stack ? 'text-[17px]' : 'text-body'}`}>{label}</span>
          {!stack && detail && <span className={`text-label font-medium ${dim}`}>{detail}</span>}
        </span>
        <span
          className="absolute inset-x-0 bottom-0 h-2 opacity-80 group-active:opacity-100"
          style={{ background: `repeating-linear-gradient(-45deg, ${color.safety} 0 8px, ${color.bg} 8px 16px)` }}
        />
      </span>
    </button>
  )
}
