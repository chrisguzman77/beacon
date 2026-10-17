import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { color } from '@/tokens'
import { label } from './marsh'

// A MARSH card whose header folds it to one line. Folded, it shows `summary` beside the title.
// The open state is remembered per `id` in this browser. `edge` tints the card for alarms.

function load(id: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(`fold.${id}`)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

type Props = { id: string; title: string; summary?: ReactNode; badge?: ReactNode; edge?: string; defaultOpen?: boolean; children: ReactNode }

export default function Fold({ id, title, summary, badge, edge, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(() => load(id, defaultOpen))
  const toggle = () => {
    setOpen(!open)
    try {
      localStorage.setItem(`fold.${id}`, open ? '0' : '1')
    } catch {
      /* remembered for this visit only */
    }
  }

  return (
    <section
      className="shrink-0 rounded-lg transition-shadow"
      style={{ background: color.surface, boxShadow: `inset 0 0 0 ${edge ? 2 : 1}px ${edge ?? color.border}, 0 1px 2px rgb(29 40 34 / 0.06)` }}
    >
      <button onClick={toggle} className="group flex w-full items-center justify-between gap-3 rounded-lg px-5 py-4 text-left" aria-expanded={open}>
        <span className="flex min-w-0 items-center gap-3">
          <span className={label} style={{ color: color.text }}>{title}</span>
          {!open && summary && <span className="truncate text-[13px]" style={{ color: color.muted }}>{summary}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {badge}
          <ChevronDown className="size-5 transition-transform duration-300 group-hover:translate-y-px" style={{ color: color.muted, transform: open ? 'rotate(180deg)' : undefined }} />
        </span>
      </button>
      {open && <div className="animate-in px-5 pb-5 duration-300 fade-in slide-in-from-top-1">{children}</div>}
    </section>
  )
}
