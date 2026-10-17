import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import Panel from '@/components/Panel'
import { color, indexColor } from '@/tokens'
import { Check, TriangleAlert } from 'lucide-react'
import { buildFactors, groups, worst } from './factors'
import type { Factor, Status } from './factors'
import type { Snapshot } from './types'

// A fixed web: hazard index in the middle, one hub per cluster, factors around each hub.
// Nodes show only their name and condition; the readings open on click (FactorDetail).
// The web never moves; the view does. Drag to pan, wheel to zoom, fit() recenters,
// tour glides the view to the worst hazard while the screen is idle.

type Pt = { x: number; y: number }
export type FactorWebHandle = { fit: () => void }

const HUB_R = { x: 430, y: 190 }
const CELL = { w: 172, h: 52 } // factor node 160 x ~44 plus gap
// Clusters above and below the index spread wide (the web area is wide), side clusters stay narrow.
const colsFor = (dir: Pt) => (Math.abs(dir.y) > 0.9 ? 4 : 2)

// Hubs on an ellipse; each cluster's factors sit in a two column block just beyond its hub.
function layout(factors: Factor[]) {
  const pos: Record<string, Pt> = {}
  groups.forEach((g, gi) => {
    const a = -Math.PI / 2 + (gi * 2 * Math.PI) / groups.length
    const dir = { x: Math.cos(a), y: Math.sin(a) }
    const hub = { x: HUB_R.x * dir.x, y: HUB_R.y * dir.y }
    pos[`hub:${g.id}`] = hub
    const kids = factors.filter((f) => f.group === g.id)
    const cols = Math.min(colsFor(dir), kids.length)
    const rows = Math.ceil(kids.length / cols)
    const bw = cols * CELL.w
    const bh = rows * CELL.h
    const off = 0.5 * Math.abs(dir.x) * bw + 0.5 * Math.abs(dir.y) * bh + 60
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

// MARSH cards straight on the page: cream cards, a tinted face and edge when a hazard needs
// attention, ink links that take the hazard color when it does.
const quiet = 'rgb(29 40 34 / 0.22)'
// Depth: shadows grow with how much a node matters, as if it floats higher off the floor.
const shadow = (depth: number) => `drop-shadow(0 ${depth * 3}px ${depth * 4}px rgb(29 40 34 / ${0.06 + depth * 0.04}))`
function look(status: Status, tint = color.border) {
  if (status === 'danger') return { edge: tint, fill: `color-mix(in srgb, ${tint} 16%, ${color.surface})`, line: tint, depth: 2 }
  if (status === 'caution') return { edge: tint, fill: `color-mix(in srgb, ${tint} 8%, ${color.surface})`, line: tint, depth: 2 }
  return { edge: color.border, fill: color.surface, line: quiet, depth: 1 }
}

const dash = (s: Status) => (s === 'info' ? '2 6' : s === 'danger' ? '10 7' : undefined)
const statusText: Record<Status, string> = { danger: 'Danger', caution: 'Caution', ok: 'Normal', info: '' }

type Props = { s: Snapshot; tour?: boolean; selected?: string | null; onSelect?: (id: string | null) => void; backdrop?: string }

const FactorWeb = forwardRef<FactorWebHandle, Props>(function FactorWeb({ s, tour, selected, onSelect, backdrop = color.bg }, ref) {
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
    const w = Math.max(...xs) - Math.min(...xs) + 220
    const h = Math.max(...ys) - Math.min(...ys) + 120
    // Never smaller than 0.55 so node names stay readable; pan to reach the edges.
    const k = Math.max(0.55, Math.min(el.clientWidth / w, el.clientHeight / h, 1.1))
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
      {/* The floor: a plane tipped back in perspective, so the web reads as lying on a surface with depth. */}
      <div className="absolute inset-0" style={{ transform: 'perspective(1800px) rotateX(14deg)', transformOrigin: '50% 60%' }}>
      <div className="absolute -inset-[30%]" style={grid(160, '55', 0.4)} />
      <div className="absolute -inset-[30%]" style={grid(40, '30', 1)} />

      <div
        className="absolute top-1/2 left-1/2"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transformOrigin: '0 0',
          transition: tour || glide ? 'transform 1.2s cubic-bezier(0.2, 0, 0, 1)' : undefined,
        }}
      >
        {/* Soft pool of light under the hazard index, tinted by its level. */}
        <div className="pointer-events-none absolute size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${indexColor(s.index)} 22%, transparent), transparent 65%)` }} />
        <svg className="pointer-events-none absolute overflow-visible" width="1" height="1">
          <defs>
            <filter id="web-lift" filterUnits="userSpaceOnUse" x="-4000" y="-4000" width="8000" height="8000">
              <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#1D2822" floodOpacity="0.18" />
            </filter>
          </defs>
          <g filter="url(#web-lift)">
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
          </g>
        </svg>

        {factors.map((x) => {
          const p = pos[x.id]
          const l = look(x.status, x.tint)
          const on = selected === x.id
          return (
            <div
              key={x.id}
              data-node={x.id}
              className="absolute w-[160px] -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: p.x, top: p.y, zIndex: on ? 5 : undefined }}
              title={statusText[x.status] ? `${x.label}: ${statusText[x.status]}` : x.label}
            >
              <Panel size={12} edge={on ? color.accent : l.edge} fill={l.fill} style={{ filter: shadow(on ? 4 : l.depth + 1) }} inner="flex items-center gap-2 px-3 py-2">
                {x.status === 'ok' ? (
                  <Check className="size-3.5 shrink-0" style={{ color: color.signal }} strokeWidth={3} />
                ) : x.status === 'info' ? (
                  <span className="size-2 shrink-0 rounded-full" style={{ background: color.muted, opacity: 0.6 }} />
                ) : (
                  <TriangleAlert className={`size-3.5 shrink-0 ${x.status === 'danger' ? 'animate-beacon-pulse' : ''}`} style={{ color: x.tint }} strokeWidth={2.5} />
                )}
                <span className={`truncate text-[15px] ${x.status === 'caution' || x.status === 'danger' ? 'font-semibold' : ''}`} style={{ color: color.text }}>{x.label}</span>
              </Panel>
            </div>
          )
        })}

        {hubs.map((h) => {
          const p = pos[`hub:${h.id}`]
          const hot = h.status === 'danger' || h.status === 'caution'
          return (
            <div key={h.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y }}>
              <span
                className="flex items-center gap-2 rounded-md px-4 py-2 text-[15px] font-bold whitespace-nowrap"
                style={{ background: hot ? color.accent : color.surface, color: color.accentInk, boxShadow: `${hot ? `inset 0 0 0 2px ${h.tint}, ` : `inset 0 0 0 1px ${color.border}, `}0 8px 16px rgb(29 40 34 / 0.18), 0 2px 4px rgb(29 40 34 / 0.12)` }}
              >
                {hot && <TriangleAlert className="size-4" style={{ color: h.tint }} strokeWidth={2.5} />}
                {h.label}
              </span>
            </div>
          )
        })}

        <div className="absolute w-[240px] -translate-x-1/2 -translate-y-1/2" style={{ left: 0, top: 0 }}>
          <Panel size={12} edge={indexColor(s.index)} fill={color.surface} style={{ filter: 'drop-shadow(0 18px 24px rgb(29 40 34 / 0.22)) drop-shadow(0 4px 6px rgb(29 40 34 / 0.12))' }} inner="flex flex-col items-center gap-1 px-5 py-4 text-center">
            <span className="text-[13px] font-bold tracking-[0.02em] uppercase" style={{ color: color.muted }}>Hazard index</span>
            <span className="flex items-baseline gap-1">
              <span className="text-[76px] leading-[0.95] font-semibold" style={{ color: indexColor(s.index) }}>{s.index}</span>
              <span className="text-[24px]" style={{ color: color.muted }}>/10</span>
            </span>
            <span className="line-clamp-2 text-[13px] leading-snug">{s.index_reason}</span>
          </Panel>
        </div>
      </div>

      </div>

      {/* Edges fade into the page so the web sits on it, not in a box. */}
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 62%, ${backdrop} 98%)` }} />
    </div>
  )
})

export default FactorWeb
