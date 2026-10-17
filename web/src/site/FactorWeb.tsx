import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, CloudSun, Cog, MapPin, PawPrint, TriangleAlert, Users, Waves } from 'lucide-react'
import { color, indexColor } from '@/tokens'
import { buildFactors, groups, worst } from './factors'
import type { Factor, Group, Status } from './factors'
import type { Snapshot } from './types'
import { BandBar, Trend, fmt, hhmm } from './FactorDetail'
import type { Point } from './FactorDetail'

// The factor web, lying on the page with depth, opened one level at a time:
//   overview  the hazard index in the middle, the six categories around it
//   category  the category takes the middle, its factors around it
//   factor    the factor takes the middle, its readings around it (limits, trend and forecast,
//             what it means for the crew, the readings stored)
// Every category and factor is backlit in its status color: green OK, the hazard's color on
// caution, a stronger pulsing glow on danger, none for plain information.

export type Focus = { group?: Group; factor?: string }
type Props = { s: Snapshot; focus: Focus; onFocus: (f: Focus) => void; history: Record<string, Point[]> }

const icons: Record<Group, typeof CloudSun> = { weather: CloudSun, water: Waves, wildlife: PawPrint, crew: Users, equipment: Cog, site: MapPin }
const statusText: Record<Status, string> = { danger: 'Danger', caution: 'Caution', ok: 'Normal', info: 'Info' }
const hot = (st: Status) => st === 'danger' || st === 'caution'
const quiet = 'rgb(29 40 34 / 0.22)'

// The light behind a card: status color, or nothing for info.
const lightOf = (st: Status, tint?: string) => (hot(st) ? (tint ?? color.muted) : st === 'ok' ? color.signal : null)

export function groupStatus(kids: Factor[]): { status: Status; tint?: string } {
  const w = worst(kids)
  if (w && hot(w.status)) return { status: w.status, tint: w.tint }
  return { status: kids.some((k) => k.status === 'ok') ? 'ok' : 'info' }
}

// A card with a blurred light behind it (the backlight) and an edge in the same color.
function Lit({ status, tint, children, className = '', onClick, big }: { status: Status; tint?: string; children: ReactNode; className?: string; onClick?: () => void; big?: boolean }) {
  const light = lightOf(status, tint)
  const strong = status === 'danger'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`group relative block text-left ${onClick ? 'cursor-pointer' : ''} ${className}`}>
      {light && (
        <span
          className={`pointer-events-none absolute rounded-2xl ${strong ? 'animate-beacon-pulse' : ''}`}
          style={{ inset: big ? -22 : -12, background: light, opacity: strong ? 0.55 : status === 'caution' ? 0.42 : 0.28, filter: `blur(${big ? 28 : 16}px)` }}
        />
      )}
      <span
        className={`relative block rounded-lg transition-transform ${onClick ? 'group-hover:-translate-y-0.5' : ''}`}
        style={{
          background: hot(status) ? `color-mix(in srgb, ${tint} 9%, ${color.surface})` : color.surface,
          boxShadow: `inset 0 0 0 ${light ? 2 : 1}px ${light ?? color.border}, 0 10px 22px rgb(29 40 34 / 0.16), 0 2px 4px rgb(29 40 34 / 0.10)`,
        }}
      >
        {children}
      </span>
    </Tag>
  )
}

function StatusLine({ status, tint }: { status: Status; tint?: string }) {
  if (status === 'info') return null
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: status === 'ok' ? color.signal : tint }}>
      {status === 'ok' ? <Check className="size-4" strokeWidth={3} /> : <TriangleAlert className="size-4" strokeWidth={2.5} />}
      {statusText[status]}
    </span>
  )
}

export default function FactorWeb({ s, focus, onFocus, history }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(box.current!)
    return () => ro.disconnect()
  }, [])

  const factors = buildFactors(s)
  const factor = focus.factor ? factors.find((f) => f.id === focus.factor) : undefined
  const group = factor?.group ?? focus.group
  const level = factor ? 'factor' : group ? 'group' : 'overview'
  const { w, h } = size

  // Points on an ellipse around the middle, starting at the top.
  const ring = (n: number) => Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { x: Math.cos(a) * w * 0.36, y: Math.sin(a) * h * 0.34 }
  })

  let center: ReactNode = null
  let around: { key: string; x: number; y: number; line: string; status: Status; anchor?: 'top' | 'bottom'; node: ReactNode }[] = []

  if (level === 'overview') {
    center = (
      <Lit status={s.index >= 7 ? 'danger' : s.index >= 4 ? 'caution' : 'ok'} tint={indexColor(s.index)} big className="w-[260px]">
        <span className="flex flex-col items-center gap-1 px-5 py-4 text-center">
          <span className="text-[13px] font-bold tracking-[0.02em] uppercase" style={{ color: color.muted }}>Hazard index</span>
          <span className="flex items-baseline gap-1">
            <span className="text-[80px] leading-[0.95] font-semibold" style={{ color: indexColor(s.index) }}>{s.index}</span>
            <span className="text-[24px]" style={{ color: color.muted }}>/10</span>
          </span>
          {s.index_reasons?.length ? (
            <span className="mt-1 flex flex-col items-center gap-1">
              {s.index_reasons.map((r) => <span key={r} className="rounded-sm px-2 py-0.5 text-[12px] font-medium" style={{ background: color.raised }}>{r}</span>)}
            </span>
          ) : (
            <span className="line-clamp-2 text-[13px] leading-snug">{s.index_reason}</span>
          )}
        </span>
      </Lit>
    )
    const pts = ring(groups.length)
    around = groups.map((g, i) => {
      const kids = factors.filter((f) => f.group === g.id)
      const st = groupStatus(kids)
      const n = kids.filter((k) => hot(k.status)).length
      const Icon = icons[g.id]
      return {
        key: g.id, ...pts[i], status: st.status, line: lightOf(st.status, st.tint) ?? quiet,
        node: (
          <Lit status={st.status} tint={st.tint} onClick={() => onFocus({ group: g.id })} className="w-[200px]">
            <span className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-7 shrink-0" style={{ color: hot(st.status) ? st.tint : color.text }} strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="block text-[19px] leading-tight font-bold">{g.label}</span>
                <span className="block text-[13px]" style={{ color: hot(st.status) ? st.tint : color.muted }}>
                  {n ? `${n} need${n > 1 ? '' : 's'} attention` : `${kids.length} factor${kids.length > 1 ? 's' : ''} normal`}
                </span>
              </span>
            </span>
          </Lit>
        ),
      }
    })
  }

  if (level === 'group' && group) {
    const g = groups.find((x) => x.id === group)!
    const kids = factors.filter((f) => f.group === group)
    const st = groupStatus(kids)
    const Icon = icons[group]
    center = (
      <Lit status={st.status} tint={st.tint} big className="w-[260px]">
        <span className="flex flex-col items-center gap-2 px-5 py-5 text-center">
          <Icon className="size-10" style={{ color: hot(st.status) ? st.tint : color.text }} strokeWidth={1.5} />
          <span className="text-[30px] leading-none font-bold">{g.label}</span>
          <StatusLine status={st.status} tint={st.tint} />
          <span className="text-[13px]" style={{ color: color.muted }}>{kids.length} factors · click one to see its readings</span>
        </span>
      </Lit>
    )
    const pts = ring(kids.length)
    around = kids.map((k, i) => ({
      key: k.id, ...pts[i], status: k.status, line: lightOf(k.status, k.tint) ?? quiet,
      node: (
        <Lit status={k.status} tint={k.tint} onClick={() => onFocus({ group, factor: k.id })} className="w-[180px]">
          <span className="flex flex-col gap-1 px-4 py-3">
            <span className="truncate text-[16px] font-bold">{k.label}</span>
            {k.status === 'info' ? <span className="text-[13px]" style={{ color: color.muted }}>Information</span> : <StatusLine status={k.status} tint={k.tint} />}
          </span>
        </Lit>
      ),
    }))
  }

  if (level === 'factor' && factor) {
    const tint = lightOf(factor.status, factor.tint) ?? color.muted
    const pts = history[factor.id] ?? []
    center = (
      <Lit status={factor.status} tint={factor.tint} big className="w-[300px]">
        <span className="flex flex-col items-center gap-2 px-5 py-5 text-center">
          <span className="font-mono text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: color.muted }}>{groups.find((x) => x.id === factor.group)?.label}</span>
          <span className="text-[24px] leading-tight font-bold">{factor.label}</span>
          <span className="text-[56px] leading-none font-semibold" style={{ color: hot(factor.status) ? factor.tint : color.text }}>{factor.value}</span>
          <StatusLine status={factor.status} tint={factor.tint} />
          {hot(factor.status) && factor.note && <span className="text-[13px] leading-snug" style={{ color: color.muted }}>{factor.note}</span>}
        </span>
      </Lit>
    )
    const vs = pts.map((p) => p.v)
    const cards: { key: string; title: string; body: ReactNode }[] = []
    if (factor.bands && factor.raw !== undefined) cards.push({ key: 'limits', title: '', body: <BandBar v={factor.raw} b={factor.bands} tint={factor.tint ?? color.muted} /> })
    if (factor.raw !== undefined) cards.push({ key: 'trend', title: 'Trend and forecast', body: <Trend points={pts} bands={factor.bands} tint={factor.tint ?? color.text} unit={factor.bands?.unit ?? ''} /> })
    cards.push({ key: 'crew', title: 'What it means for the crew', body: <p className="text-[15px] leading-snug">{factor.guide}</p> })
    cards.push({
      key: 'stored', title: 'Readings stored',
      body: vs.length ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
          <dt style={{ color: color.muted }}>Readings</dt><dd className="font-semibold">{vs.length} since {hhmm(pts[0].t)}</dd>
          <dt style={{ color: color.muted }}>Latest</dt><dd className="font-semibold">{fmt(Number(vs[vs.length - 1].toFixed(1)))} {factor.bands?.unit}</dd>
          <dt style={{ color: color.muted }}>Low · high</dt><dd className="font-semibold">{fmt(Number(Math.min(...vs).toFixed(1)))} · {fmt(Number(Math.max(...vs).toFixed(1)))} {factor.bands?.unit}</dd>
        </dl>
      ) : (
        <p className="text-[14px] leading-snug" style={{ color: color.muted }}>A condition reported by the site, not a number over time. Kept with the site's events.</p>
      ),
    })
    // Corners: the readings sit around the factor, two above and two below.
    const slots: { x: number; anchor: 'top' | 'bottom' }[] = [
      { x: -1, anchor: 'top' }, { x: 1, anchor: 'top' }, { x: -1, anchor: 'bottom' }, { x: 1, anchor: 'bottom' },
    ]
    around = cards.map((c, i) => {
      const sl = slots[i]
      return {
        key: c.key, x: sl.x * Math.max(330, w / 2 - 200), y: (sl.anchor === 'top' ? -1 : 1) * (h / 2 - 12), anchor: sl.anchor, status: factor.status, line: tint,
        node: (
          <div className="w-[360px] rounded-lg p-4" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}, 0 10px 22px rgb(29 40 34 / 0.14)` }}>
            {c.title && <h3 className="mb-3 font-mono text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: color.muted }}>{c.title}</h3>}
            {c.body}
          </div>
        ),
      }
    })
  }

  // Lines reach each card's near edge: for corner cards, a point a little inside the card.
  const lineEnd = (a: (typeof around)[number]) => (a.anchor ? { x: a.x * 0.8, y: a.y * 0.55 } : a)

  // Narrow screens (phones): no ring. The middle card on top, the rest in a grid below, no lines.
  if (w > 0 && w < 720)
    return (
      <div ref={box} className="relative w-full">
        <div key={`${level}:${group ?? ''}:${factor?.id ?? ''}`} className="flex animate-in flex-col items-center gap-5 py-12 duration-300 fade-in">
          {center}
          <div className={`grid w-full gap-4 [&>*>*]:!w-full ${level === 'factor' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {around.map((a) => <div key={a.key}>{a.node}</div>)}
          </div>
        </div>
      </div>
    )

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden">
      {/* The floor: a grid tipped back in perspective, so the web reads as lying on a surface. */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: 'perspective(1800px) rotateX(14deg)', transformOrigin: '50% 60%' }}>
        <div
          className="absolute -inset-[30%]"
          style={{
            backgroundImage: `linear-gradient(${color.border}55 1px, transparent 1px), linear-gradient(90deg, ${color.border}55 1px, transparent 1px), linear-gradient(${color.border}30 1px, transparent 1px), linear-gradient(90deg, ${color.border}30 1px, transparent 1px)`,
            backgroundSize: '160px 160px, 160px 160px, 40px 40px, 40px 40px',
            backgroundPosition: 'center',
          }}
        />
      </div>

      {w > 0 && (
        <div key={`${level}:${group ?? ''}:${factor?.id ?? ''}`} className="absolute inset-0 animate-in duration-500 fade-in zoom-in-95">
          {/* Soft pool of the middle's status color on the floor. */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${level === 'overview' ? indexColor(s.index) : (around[0]?.line ?? quiet)} 18%, transparent), transparent 65%)` }} />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}>
            <defs>
              <filter id="web-lift" filterUnits="userSpaceOnUse" x={-w} y={-h} width={w * 2} height={h * 2}>
                <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#1D2822" floodOpacity="0.18" />
              </filter>
            </defs>
            <g filter="url(#web-lift)">
              {around.map((a) => {
                const e = lineEnd(a)
                return <line key={a.key} x1={0} y1={0} x2={e.x} y2={e.y} stroke={a.line} strokeWidth={a.status === 'danger' ? 4 : 3} strokeDasharray={a.status === 'info' ? '2 7' : a.status === 'danger' ? '10 7' : undefined} className={a.status === 'danger' ? 'web-flow' : undefined} />
              })}
            </g>
          </svg>

          {around.map((a) => (
            <div
              key={a.key}
              className="absolute"
              style={{ left: `calc(50% + ${a.x}px)`, top: `calc(50% + ${a.y}px)`, transform: `translate(-50%, ${a.anchor === 'top' ? '0' : a.anchor === 'bottom' ? '-100%' : '-50%'})` }}
            >
              {a.node}
            </div>
          ))}

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{center}</div>
        </div>
      )}

      {/* Edges fade into the page so the web sits on it, not in a box (not behind the readings cards). */}
      {level !== 'factor' && <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 70%, ${color.bg} 100%)` }} />}
    </div>
  )
}
