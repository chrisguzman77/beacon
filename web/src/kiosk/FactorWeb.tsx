import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import Panel from '@/components/Panel'
import { color, indexColor } from '@/tokens'
import { buildFactors } from './factors'
import type { Factor } from './factors'
import type { Snapshot } from './types'

// The hazard index in the middle, every factor linked to it. Drag any node with the mouse;
// the layout is remembered in this browser. Reset clears it and remounts (key change).

type Pos = Record<string, { x: number; y: number }>
const KEY = 'beacon.web.layout'

function load(): Pos {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function resetLayout() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage blocked, layout just resets on reload */
  }
}

const ring = (i: number, n: number) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
  return { x: 0.5 + 0.4 * Math.cos(a), y: 0.5 + 0.38 * Math.sin(a) }
}
const clamp = (v: number) => Math.min(0.94, Math.max(0.06, v))

function look(x: Factor) {
  const tint = x.tint ?? color.border
  if (x.status === 'danger') return { edge: tint, fill: `color-mix(in srgb, ${tint} 42%, ${color.bg})`, value: color.text, line: tint }
  if (x.status === 'caution') return { edge: tint, fill: `color-mix(in srgb, ${tint} 16%, ${color.bg})`, value: tint, line: tint }
  if (x.status === 'ok') return { edge: color.signal, fill: color.surface, value: color.text, line: `color-mix(in srgb, ${color.signal} 55%, transparent)` }
  return { edge: color.border, fill: color.surface, value: color.text, line: color.border }
}

const tag = { danger: 'DANGER', caution: 'CAUTION', ok: 'OK', info: '' }

export default function FactorWeb({ s }: { s: Snapshot }) {
  const factors = buildFactors(s)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const [pos, setPos] = useState<Pos>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(pos))
    } catch {
      /* storage blocked, layout lasts this session */
    }
  }, [pos])

  const at = (id: string, i: number) => pos[id] ?? (id === 'index' ? { x: 0.5, y: 0.5 } : ring(i, factors.length))
  const center = at('index', 0)

  const grab = (id: string, i: number) => (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    const p = at(id, i)
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id, dx: e.clientX - (r.left + p.x * r.width), dy: e.clientY - (r.top + p.y * r.height) }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const r = box.current!.getBoundingClientRect()
    setPos((prev) => ({
      ...prev,
      [d.id]: { x: clamp((e.clientX - d.dx - r.left) / r.width), y: clamp((e.clientY - d.dy - r.top) / r.height) },
    }))
  }
  const drop = () => {
    drag.current = null
  }

  return (
    <div
      ref={box}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(${color.border}33 1px, transparent 1px), linear-gradient(90deg, ${color.border}33 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }}
      onPointerMove={move}
      onPointerUp={drop}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {factors.map((x, i) => {
          const p = at(x.id, i)
          const l = look(x)
          return (
            <line
              key={x.id}
              x1={`${center.x * 100}%`} y1={`${center.y * 100}%`} x2={`${p.x * 100}%`} y2={`${p.y * 100}%`}
              stroke={l.line}
              strokeWidth={x.status === 'danger' ? 3 : 2}
              strokeDasharray={x.status === 'info' ? '2 6' : x.status === 'danger' ? '12 8' : undefined}
              className={x.status === 'danger' ? 'web-flow' : undefined}
            />
          )
        })}
      </svg>

      {factors.map((x, i) => {
        const p = at(x.id, i)
        const l = look(x)
        return (
          <div
            key={x.id}
            onPointerDown={grab(x.id, i)}
            className="absolute w-[184px] -translate-x-1/2 -translate-y-1/2 cursor-grab select-none active:cursor-grabbing"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          >
            <Panel size={12} edge={l.edge} fill={l.fill} inner="flex flex-col gap-1 px-4 py-3">
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
              <span className="text-[30px] leading-none font-bold" style={{ color: l.value }}>{x.value}</span>
            </Panel>
          </div>
        )
      })}

      <div
        onPointerDown={grab('index', 0)}
        className="absolute w-[240px] -translate-x-1/2 -translate-y-1/2 cursor-grab select-none active:cursor-grabbing"
        style={{ left: `${center.x * 100}%`, top: `${center.y * 100}%` }}
      >
        <Panel size={20} edge={indexColor(s.index)} fill={color.raised} inner="flex flex-col items-center gap-1 px-5 py-4 text-center">
          <span className="text-label font-semibold uppercase tracking-[0.18em] text-dim">Hazard index</span>
          <span className="flex items-baseline gap-1">
            <span className="text-[88px] leading-[0.9] font-bold" style={{ color: indexColor(s.index) }}>{s.index}</span>
            <span className="text-heading font-semibold text-dim">/10</span>
          </span>
          <span className="line-clamp-2 text-label leading-snug">{s.index_reason}</span>
        </Panel>
      </div>
    </div>
  )
}
