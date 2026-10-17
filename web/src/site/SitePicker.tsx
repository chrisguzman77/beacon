import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Search } from 'lucide-react'
import Panel, { cut } from '@/components/Panel'
import { LiveBadge } from '@/dashboard/RankedList'
import { rank, useDash } from '@/dashboard/store'
import { color, indexColor } from '@/tokens'

// Header control that switches HUB to any site. Lists sites ranked like the dashboard.
export default function SitePicker({ current, name }: { current: number; name: string }) {
  const { sites, status, connect } = useDash()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const go = useNavigate()

  useEffect(() => connect(), [connect])
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [open])

  const term = q.trim().toLowerCase()
  const shown = rank(sites).filter((s) => !term || `${s.name} ${s.county} ${s.state}`.toLowerCase().includes(term))

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-[2px]"
        style={{ clipPath: cut(10), background: open ? color.signal : color.border }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-3 px-4 py-2" style={{ clipPath: cut(9), background: color.surface }}>
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-dim">SITE</span>
          <span className="max-w-[260px] truncate text-body font-semibold">{name}</span>
          <ChevronDown className="size-4 text-dim" />
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-2 w-[440px]">
          <Panel size={14} depth={3} edge={color.signal} inner="flex flex-col gap-3 p-3">
            <label className="flex items-center gap-2 px-2 py-2" style={{ boxShadow: `inset 0 0 0 1px ${color.border}` }}>
              <Search className="size-4 text-dim" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search sites, county or state"
                className="w-full bg-transparent text-body outline-none placeholder:text-dim"
              />
            </label>
            <ul className="max-h-[420px] overflow-y-auto">
              {status === 'loading' && <li className="p-3 text-label text-dim">Loading sites…</li>}
              {status === 'error' && <li className="p-3 text-label text-dim">The site list did not load. Add ?fake=1 to use the demo sites.</li>}
              {status === 'ready' && shown.length === 0 && <li className="p-3 text-label text-dim">No site matches “{q}”.</li>}
              {shown.map((s) => (
                <li key={s.site_id}>
                  <button
                    onClick={() => {
                      setOpen(false)
                      setQ('')
                      go(`/hub/${s.site_id}${location.search.replace(/[?&]step=\d+/, '')}`)
                    }}
                    className="grid w-full grid-cols-[40px_1fr_auto] items-center gap-3 px-2 py-2 text-left hover:bg-raised"
                    style={{ background: s.site_id === current ? color.raised : undefined }}
                  >
                    <span className="text-center text-[22px] font-bold" style={{ color: s.index == null ? color.muted : indexColor(s.index) }}>{s.index ?? '–'}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-body font-semibold">{s.name}</span>
                      <span className="block text-label text-dim">{s.county}, {s.state}</span>
                    </span>
                    {s.beacon && <LiveBadge />}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  )
}
