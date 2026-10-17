import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import Panel from '@/components/Panel'
import { color } from '@/tokens'

// A chamfered panel whose header folds it to one line. Folded, it shows `summary` instead of the
// body. The open state is remembered per `id` in this browser.

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
    <Panel size={14} depth={open ? 2 : 1} edge={edge} inner="flex flex-col">
      <button onClick={toggle} className="flex items-center justify-between gap-3 px-5 py-4 text-left" aria-expanded={open}>
        <span className="flex items-center gap-3">
          <span className="text-body font-bold tracking-[0.12em] uppercase">{title}</span>
          {!open && summary && <span className="font-mono text-label font-bold tracking-wider whitespace-nowrap text-dim">{summary}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          {badge}
          <ChevronDown className="size-5 transition-transform" style={{ color: color.muted, transform: open ? 'rotate(180deg)' : undefined }} />
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </Panel>
  )
}
