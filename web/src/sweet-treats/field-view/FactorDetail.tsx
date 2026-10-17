import { useState } from 'react'
import type { PointerEvent } from 'react'
import { X } from 'lucide-react'
import Panel from '@/components/Panel'
import { color } from '@/tokens'
import { groups } from './factors'
import type { Bands, Factor } from './factors'

export type Point = { t: number; v: number }

// Side panel for one selected factor: value and status, where it sits against its limits,
// its live trend since the page opened, and what it means for the crew.
export default function FactorDetail({ x, history, onClose }: { x: Factor; history: Point[]; onClose: () => void }) {
  const tint = x.status === 'ok' ? color.signal : x.status === 'info' ? color.muted : (x.tint ?? color.muted)
  const status = { ok: 'OK', info: 'INFO', caution: 'CAUTION', danger: 'DANGER' }[x.status]

  return (
    <div className="absolute top-4 right-4 bottom-4 z-20 w-[380px]" onPointerDown={(e) => e.stopPropagation()}>
      <Panel className="h-full" size={18} depth={3} edge={tint} fill={color.surface} inner="flex h-full flex-col gap-5 overflow-y-auto p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.2em] text-dim uppercase">{groups.find((g) => g.id === x.group)?.label}</p>
            <h2 className="text-heading leading-tight font-semibold">{x.label}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-dim hover:text-ink" aria-label="Close detail">
            <X className="size-6" />
          </button>
        </header>

        <div className="flex items-end justify-between">
          <span className="text-[56px] leading-none font-bold" style={{ color: x.status === 'info' || x.status === 'ok' ? color.text : tint }}>{x.value}</span>
          <span className="px-2 py-1 font-mono text-label font-bold tracking-wider" style={{ color: tint, boxShadow: `inset 0 0 0 1px ${tint}` }}>{status}</span>
        </div>

        {x.bands && x.raw !== undefined && <BandBar v={x.raw} b={x.bands} tint={x.tint ?? color.muted} />}

        {x.raw !== undefined && (
          <section className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-dim uppercase">Trend, since this page opened</h3>
            <Trend points={history} bands={x.bands} tint={x.tint ?? color.text} unit={x.bands?.unit ?? ''} />
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-dim uppercase">What it means for the crew</h3>
          <p className="text-body leading-snug">{x.guide}</p>
        </section>
      </Panel>
    </div>
  )
}

// Horizontal limit band: OK, caution and danger zones on 0..max with a tick at the value.
function BandBar({ v, b, tint }: { v: number; b: Bands; tint: string }) {
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / b.max) * 100))}%`
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-dim uppercase">Limits</h3>
      <div className="relative h-4">
        <div className="absolute inset-y-0 left-0" style={{ width: pct(b.caution), background: `color-mix(in srgb, ${color.signal} 35%, ${color.bg})` }} />
        <div className="absolute inset-y-0" style={{ left: pct(b.caution), width: `calc(${pct(b.danger)} - ${pct(b.caution)})`, background: `color-mix(in srgb, ${tint} 35%, ${color.bg})` }} />
        <div className="absolute inset-y-0 right-0" style={{ left: pct(b.danger), background: `color-mix(in srgb, ${tint} 75%, ${color.bg})` }} />
        <div className="absolute -top-1.5 h-7 w-1.5 -translate-x-1/2 bg-ink outline-2 outline-bg" style={{ left: pct(v) }} />
      </div>
      <div className="relative h-4 font-mono text-[11px] text-dim">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(b.caution) }}>{fmt(b.caution)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(b.danger) }}>{fmt(b.danger)}</span>
        <span className="absolute right-0">{fmt(b.max)} {b.unit}</span>
      </div>
      <p className="text-label text-dim">Caution from {fmt(b.caution)} {b.unit}, danger from {fmt(b.danger)} {b.unit}.</p>
    </section>
  )
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const W = 340
const H = 120

// Single series line with the caution and danger zones shaded behind it and a hover readout.
function Trend({ points, bands, tint, unit }: { points: Point[]; bands?: Bands; tint: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return <p className="text-label text-dim">Collecting readings. The trend appears after a few seconds.</p>

  const vs = points.map((p) => p.v)
  // Scale fits the readings plus both limits, with a little headroom, so the line and zones fill the plot.
  const top = Math.max(...vs, bands?.danger ?? -Infinity)
  const bottom = Math.min(...vs, bands?.caution ?? Infinity)
  const pad = (top - bottom || 1) * 0.25
  const lo = Math.max(0, bottom - pad)
  const hi = top + pad
  const span = hi - lo || 1
  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W
  const y = (v: number) => H - 4 - ((v - lo) / span) * (H - 8)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const h = hover === null ? null : points[hover]

  const track = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = t0 + ((e.clientX - r.left) / r.width) * (t1 - t0)
    let best = 0
    points.forEach((p, i) => Math.abs(p.t - t) < Math.abs(points[best].t - t) && (best = i))
    setHover(best)
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" onPointerMove={track} onPointerLeave={() => setHover(null)}>
        {bands && (
          <>
            <rect x={0} width={W} y={y(Math.min(bands.danger, hi))} height={Math.max(0, y(bands.caution) - y(Math.min(bands.danger, hi)))} fill={tint} opacity={0.1} />
            <rect x={0} width={W} y={0} height={Math.max(0, y(bands.danger))} fill={tint} opacity={0.22} />
            <text x={W - 4} y={y(bands.danger) - 4} textAnchor="end" fontSize={10} fontFamily="monospace" fill={color.muted}>DANGER {fmt(bands.danger)}</text>
            <text x={W - 4} y={y(bands.caution) - 4} textAnchor="end" fontSize={10} fontFamily="monospace" fill={color.muted}>CAUTION {fmt(bands.caution)}</text>
          </>
        )}
        <line x1={0} x2={W} y1={H - 4} y2={H - 4} stroke={color.border} strokeWidth={1} />
        <path d={path} fill="none" stroke={tint} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <>
            <line x1={x(h.t)} x2={x(h.t)} y1={0} y2={H - 4} stroke={color.muted} strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(h.t)} cy={y(h.v)} r={4} fill={tint} stroke={color.surface} strokeWidth={2} />
          </>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute -top-8 font-mono text-[11px] font-bold whitespace-nowrap" style={{ left: `${(x(h.t) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          <span className="bg-bg px-2 py-1" style={{ boxShadow: `inset 0 0 0 1px ${color.border}` }}>
            {fmt(h.v)} {unit} · {new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}
      <div className="mt-1 flex justify-between font-mono text-[11px] text-dim">
        <span>{new Date(t0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>now</span>
      </div>
    </div>
  )
}
