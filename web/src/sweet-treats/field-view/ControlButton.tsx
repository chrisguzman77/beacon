import type { LucideIcon } from 'lucide-react'
import { color } from '@/tokens'

// The one button style (MARSH): amber filled for the primary action, dark outline for the rest,
// light outline on dark panels. Icon then label; an optional detail line under the label.

type Props = {
  icon: LucideIcon
  label: string
  detail?: string
  code?: string // kept for older callers; the design has no code tags
  tone?: 'base' | 'primary' | 'alarm'
  stack?: boolean
  className?: string
  onClick: () => void
}

export default function ControlButton({ icon: Icon, label, detail, tone = 'base', stack, className = '', onClick }: Props) {
  const look =
    tone === 'primary'
      ? { background: color.accent, color: color.accentInk, boxShadow: 'none' }
      : tone === 'alarm'
        ? { background: 'transparent', color: color.chromeText, boxShadow: `inset 0 0 0 1.5px ${color.chromeText}` }
        : { background: color.surface, color: color.text, boxShadow: `inset 0 0 0 1.5px ${color.text}` }
  return (
    <button
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center rounded-md px-5 font-semibold transition-[filter] active:brightness-95 ${stack ? 'flex-col gap-1' : 'gap-2.5'} ${className}`}
      style={look}
    >
      <Icon className="size-5 shrink-0" strokeWidth={2} />
      <span className={`flex flex-col leading-tight ${stack ? 'items-center' : 'items-start'}`}>
        <span className="text-body">{label}</span>
        {detail && <span className="text-label font-normal opacity-70">{detail}</span>}
      </span>
    </button>
  )
}
