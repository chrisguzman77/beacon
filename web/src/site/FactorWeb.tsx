import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import Panel from '@/components/Panel'
import { color, indexColor } from '@/tokens'
import { buildFactors, groups, worst } from './factors'
import type { Factor, Status } from './factors'
import type { Snapshot } from './types'

// A fixed web: hazard index in the middle, one hub per cluster, factors around each hub.
// The web never moves; the view does. Drag to pan, wheel to zoom, fit() recenters,
// tour glides the view to the worst hazard while the screen is idle.

type Pt = { x: number; y: number }
export type FactorWebHandle = { fit: () => void }

const HUB_R = { x: 600, y: 330 }
const CELL = { w: 200, h: 92 } // factor node 184 x ~70 plus gap
const COLS = 2

// Hubs on an ellipse; each cluster's factors sit in a two column block just beyond its hub.
function layout(factors: Factor[]) {
  const pos: Record<string, Pt> = {}
  groups.forEach((g, gi) => {
    const a = -Math.PI / 2 + (gi * 2 * Math.PI) / groups.length
    const dir = { x: Math.cos(a), y: Math.sin(a) }
    const hub = { x: HUB_R.x * dir.x, y: HUB_R.y * dir.y }
    pos[`hub:${g.id}`] = hub
    const kids = factors.filter((f) => f.group === g.id)
    const cols = Math.min(COLS, kids.length)
    const rows = Math.ceil(kids.length / cols)
    const bw = cols * CELL.w
    const bh = rows * CELL.h
    const off = 0.5 * Math.abs(dir.x) * bw + 0.5 * Math.abs(dir.y) * bh + 110
    const c = { x: hub.x + dir.x * off, y: hub.y + dir.y * off }
    kids.forEach((k, i) => {
      const row = Math.floor(i / cols)
      const inRow = Math.min(cols, kids.length - row * cols)
      const col = i % cols
      pos[k.id] = { x: c.x + (col - (inRow - 1) / 2) * CELL.w, y: c.y + (row - (rows - 1) / 2) * CELL.h }
    })
  })
  return pos
}

function look(status: Status, tint = color.border) {
  if (status === 'danger') return { edge: tint, fill: `color-mix(in srgb, ${tint} 42%, ${color.bg})`, value: color.text, line: tint, glow: tint, depth: 3 }
  if (status === 'caution') return { edge: tint, fill: `color-mix(in srgb, ${tint} 16%, ${color.bg})`, value: tint, line: tint, glow: `color-mix(in srgb, ${tint} 55%, transparent)`, depth: 2 }
  if (status === 'ok') return { edge: color.signal, fill: color.surface, value: color.text, line: `color-mix(in srgb, ${color.signal} 55%, transparent)`, glow: undefined, depth: 2 }
  return { edge: color.border, fill: color.surface, value: color.text, line: color.border, glow: undefined, depth: 1 }
}

const dash = (s: Status) => (s === 'info' ? '2 6' : s === 'danger' ? '12 8' : undefined)
const tag: Record<Status, string> = { danger: 'DANGER', caution: 'CAUTION', ok: 'OK', info: '' }

type Props = { s: Snapshot; tour?: boolean; selected?: string | null; onSelect?: (id: string | null) => void }

const FactorWeb = forwardRef<FactorWebHandle, Props>(function FactorWeb({ s, tour, selected, onSelect }, ref) {
  const factors = buildFactors(s)
  const pos = layout(factors)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number; node: string | null } | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })

  const fit = useCallback(() => {
    const el = box.current
    if (!el) return
    const pts = Object.values(layout(buildFactors(s)))
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const w = Math.max(...xs) - Math.min(...xs) + 260
    const h = Math.max(...ys) - Math.min(...ys) + 160
    const k = Math.min(el.clientWidth / w, el.clientHeight / h, 1.1)
    setView({ x: -((Math.max(...xs) + Math.min(...xs)) / 2) * k, y: -((Math.max(...ys) + Math.min(...ys)) / 2) * k, k })
  }, [s])
  useImperativeHandle(ref, () => ({ fit }), [fit])

  // Selecting a node glides it into view just left of the detail panel (about 400 px wide).
  const [glide, setGlide] = useState(false)
  useEffect(() => {
    if (!selected || !box.current) return
    const p = layout(buildFactors(s))[selected]
    if (!p) return
    const k = Math.max(view.k, 0.9)
    setGlide(true)
    setView({ k, x: -p.x * k - 200, y: -p.y * k })
    const t = setTimeout(() => setGlide(false), 1200)
    return () => clearTimeout(t)
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tour (idle): glide to the cluster holding the worst hazard, or show the whole web when clear.
  const target = worst(factors.filter((f) => f.status === 'caution' || f.status === 'danger'))
  const focusGroup = target?.group
  useEffect(() => {
    if (!tour) return
    if (!focusGroup) return fit()
    const p = layout(buildFactors(s))
    const ids = [`hub:${focusGroup}`, ...buildFactors(s).filter((f) => f.group === focusGroup).map((f) => f.id)]
    const xs = [0, ...ids.map((id) => p[id].x)]
    const ys = [0, ...ids.map((id) => p[id].y)]
    const el = box.current!
    const k = Math.min(el.clientWidth / (Math.max(...xs) - Math.min(...xs) + 320), el.clientHeight / (Math.max(...ys) - Math.min(...ys) + 220), 1)
    setView({ x: -((Math.max(...xs) + Math.min(...xs)) / 2) * k, y: -((Math.max(...ys) + Math.min(...ys)) / 2) * k, k })
  }, [tour, focusGroup]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(fit, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])

  const down = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const node = (e.target as HTMLElement).closest<HTMLElement>('[data-node]')?.dataset.node ?? null
    drag.current = { x: e.clientX, y: e.clientY, px: view.x, py: view.y, node }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (d) setView((v) => ({ ...v, x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }))
  }
  const wheel = (e: WheelEvent) => {
    const r = box.current!.getBoundingClientRect()
    const cx = e.clientX - r.left - r.width / 2
    const cy = e.clientY - r.top - r.height / 2
    setView((v) => {
      const k = Math.min(1.8, Math.max(0.4, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }
    })
  }

  const hubs = groups.map((g) => {
    const kids = factors.filter((f) => f.group === g.id)
    const w = worst(kids)
    const st: Status = w && (w.status === 'danger' || w.status === 'caution') ? w.status : kids.some((k) => k.status === 'ok') ? 'ok' : 'info'
    return { ...g, kids, status: st, tint: w?.tint }
  })

  // Two grid layers moving at different speeds give the background distance.
  const grid = (size: number, alpha: string, speed: number) => ({
    backgroundImage: `linear-gradient(${color.border}${alpha} 1px, transparent 1px), linear-gradient(90deg, ${color.border}${alpha} 1px, transparent 1px)`,
    backgroundSize: `${size * view.k}px ${size * view.k}px`,
    backgroundPosition: `calc(50% + ${view.x * speed}px) calc(50% + ${view.y * speed}px)`,
  })

  return (
    <div
      ref={box}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={(e) => {
        // A press that barely moved is a click: select the node under it, or clear on empty space.
        const d = drag.current
        drag.current = null
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) onSelect?.(d.node)
      }}
      onWheel={wheel}
    >
      <div className="absolute inset-0" style={grid(160, '40', 0.4)} />
      <div className="absolute inset-0" style={grid(40, '2a', 1)} />

      <div
        className="absolute top-1/2 left-1/2"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transformOrigin: '0 0',
          transition: tour || glide ? 'transform 1.2s cubic-bezier(0.2, 0, 0, 1)' : undefined,
        }}
      >
        <svg className="pointer-events-none absolute overflow-visible" width="1" height="1">
          {hubs.map((h) => {
            const hp = pos[`hub:${h.id}`]
            const hl = look(h.status, h.tint)
            return (
              <g key={h.id}>
                <line x1={0} y1={0} x2={hp.x} y2={hp.y} stroke={hl.line} strokeWidth={h.status === 'danger' ? 4 : 3}
                  strokeDasharray={dash(h.status)} className={h.status === 'danger' ? 'web-flow' : undefined} />
                {h.kids.map((k) => {
                  const kp = pos[k.id]
                  const kl = look(k.status, k.tint)
                  return (
                    <line key={k.id} x1={hp.x} y1={hp.y} x2={kp.x} y2={kp.y} stroke={kl.line} strokeWidth={k.status === 'danger' ? 3 : 2}
                      strokeDasharray={dash(k.status)} className={k.status === 'danger' ? 'web-flow' : undefined} />
                  )
                })}
              </g>
            )
          })}
        </svg>

        {factors.map((x) => {
          const p = pos[x.id]
          const l = look(x.status, x.tint)
          return (
            <div
              key={x.id}
              data-node={x.id}
              className="absolute w-[184px] -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: p.x, top: p.y, zIndex: selected === x.id ? 5 : undefined }}
            >
              <Panel
                size={12}
                edge={selected === x.id ? color.text : l.edge}
                fill={l.fill}
                depth={selected === x.id ? 3 : l.depth}
                glow={selected === x.id ? color.signal : l.glow}
                inner="flex flex-col gap-1 px-4 py-3"
              >
                <span className="flex items-center justify-between text-label font-semibold uppercase tracking-[0.14em] text-dim">
                  {x.label}
                  {tag[x.status] && (
                    <span
                      className={`font-mono text-[11px] font-bold ${x.status === 'danger' ? 'animate-beacon-pulse' : ''}`}
                      style={{ color: x.status === 'ok' ? color.signal : x.status === 'danger' ? color.text : x.tint }}
                    >
                      {tag[x.status]}
                    </span>
                  )}
                </span>
                <span className="text-[28px] leading-none font-bold" style={{ color: l.value }}>{x.value}</span>
              </Panel>
            </div>
          )
        })}

        {hubs.map((h) => {
          const p = pos[`hub:${h.id}`]
          const l = look(h.status, h.tint)
          return (
            <div key={h.id} className="absolute w-[150px] -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y }}>
              <Panel size={16} edge={l.edge} fill={color.raised} depth={3} glow={l.glow} inner="flex flex-col items-center gap-1 px-3 py-3">
                <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-dim">CLUSTER</span>
                <span className="text-body font-black tracking-[0.12em] uppercase" style={{ color: h.status === 'info' ? color.text : l.edge }}>
                  {h.label}
                </span>
              </Panel>
            </div>
          )
        })}

        <div className="absolute w-[250px] -translate-x-1/2 -translate-y-1/2" style={{ left: 0, top: 0 }}>
          <Panel size={22} edge={indexColor(s.index)} fill={color.raised} depth={3} glow={`color-mix(in srgb, ${indexColor(s.index)} 45%, transparent)`}
            inner="flex flex-col items-center gap-1 px-5 py-4 text-center">
            <span className="text-label font-semibold uppercase tracking-[0.18em] text-dim">Hazard index</span>
            <span className="flex items-baseline gap-1">
              <span className="text-[88px] leading-[0.9] font-bold" style={{ color: indexColor(s.index) }}>{s.index}</span>
              <span className="text-heading font-semibold text-dim">/10</span>
            </span>
            <span className="line-clamp-2 text-label leading-snug">{s.index_reason}</span>
          </Panel>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 55%, ${color.bg} 100%)` }} />
    </div>
  )
})

export default FactorWeb
