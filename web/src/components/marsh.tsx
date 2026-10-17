import type { ReactNode } from 'react'
import { color } from '@/tokens'

// Small shared pieces in the MARSH style, so every panel speaks the same way: the section label,
// a status pill, a segmented choice and the two button weights (amber primary, outlined secondary).

export const label = 'text-[11px] font-semibold tracking-[0.06em] uppercase'

export function Pill({ children, tint, solid }: { children: ReactNode; tint?: string; solid?: boolean }) {
  const t = tint ?? color.muted
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase"
      style={{ color: solid ? '#fff' : t, background: solid ? t : `color-mix(in srgb, ${t} 12%, transparent)` }}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label: aria }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex rounded-md p-0.5" style={{ background: color.raised }} role="group" aria-label={aria}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className="rounded-[5px] px-3 py-1 text-[12px] font-semibold uppercase transition-colors"
          style={{ background: value === o.id ? color.surface : 'transparent', color: value === o.id ? color.text : color.muted, boxShadow: value === o.id ? '0 1px 2px rgb(29 40 34 / 0.12)' : undefined }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

type ButtonProps = { children: ReactNode; icon?: ReactNode; onClick?: () => void; disabled?: boolean; title?: string; primary?: boolean; className?: string }

export function Button({ children, icon, onClick, disabled, title, primary, className = '' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`press flex h-10 items-center justify-center gap-2 rounded-md px-4 text-[14px] font-semibold disabled:opacity-40 ${className}`}
      style={primary ? { background: color.accent, color: color.accentInk } : { background: color.surface, color: color.text, boxShadow: `inset 0 0 0 1.5px ${color.border}` }}
    >
      {icon}
      {children}
    </button>
  )
}
