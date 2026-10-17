import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { Feature, FeatureCollection } from 'geojson'
import usRaw from 'us-atlas/states-10m.json?raw'
import type { SiteRow } from '@/api'
import type { LatLon } from '@/sweet-treats/useDeviceLocation'
import { color, hazard, indexColor } from '@/tokens'
import { reportTint } from '@/site/ReportsPanel'
import type { Report } from '@/site/types'

// The dashboard's map: only the United States (Albers USA, Census state shapes), drawn as SVG in
// the MARSH palette. Drag to pan, scroll to zoom, fit() shows the whole country. The selected
// site is centered; markers keep their size at any zoom. Index color fill, a ring when crew are
// on site, a pulsing red halo on stop work, an ink outline on the beacon site, and a small pin
// beside sites with crew hazard reports in the last 24 h (hazard color, count when more than one).

const W = 975
const H = 610
const us = JSON.parse(usRaw) as Topology<{ states: GeometryCollection; nation: GeometryCollection }>
const nation = feature(us, us.objects.nation) as FeatureCollection
const projection = geoAlbersUsa().fitExtent([[24, 24], [W - 24, H - 24]], nation)
const path = geoPath(projection)
const states = (feature(us, us.objects.states) as FeatureCollection).features.map((f: Feature) => ({ id: String(f.id), d: path(f) ?? '' }))
const borders = path(mesh(us, us.objects.states, (a, b) => a !== b)) ?? ''
const outline = path(nation) ?? ''
const at = (lat: number, lon: number) => projection([lon, lat])

type View = { x: number; y: number; k: number }
const whole: View = { x: 0, y: 0, k: 1 }
const ZOOM_TO = 2

type Props = { sites: SiteRow[]; selected: number | null; onSelect: (id: number) => void; here: LatLon | null; fitSignal: number; reports?: Record<number, Report[]> }

export default function UsMap({ sites, selected, onSelect, here, fitSignal, reports = {} }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)
  const [view, setView] = useState<View>(whole)
  const [glide, setGlide] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  const animateTo = (v: View) => {
    setGlide(true)
    setView(v)
  }
  useEffect(() => {
    if (!glide) return
    const t = setTimeout(() => setGlide(false), 900)
    return () => clearTimeout(t)
  }, [glide, view])

  // Center the selected site.
  const sel = sites.find((s) => s.site_id === selected)
  const selKey = sel ? `${sel.site_id}` : ''
  useEffect(() => {
    if (!sel) return
    const p = at(sel.lat, sel.lon)
    if (p) animateTo({ k: Math.max(view.k, ZOOM_TO), x: W / 2 - p[0] * Math.max(view.k, ZOOM_TO), y: H / 2 - p[1] * Math.max(view.k, ZOOM_TO) })
  }, [selKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (fitSignal) animateTo(whole)
  }, [fitSignal])

  // Screen px to map units (the SVG keeps its aspect, so one factor for both axes).
  const unit = () => {
    const r = svg.current!.getBoundingClientRect()
    return { u: Math.max(W / r.width, H / r.height), r }
  }
  const down = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true
    const { u } = unit()
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x) * u, y: d.vy + (e.clientY - d.y) * u }))
  }
  const up = (e: PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) {
      const id = (e.target as Element).closest<SVGElement>('[data-site]')?.dataset.site
      if (id) onSelect(Number(id))
    }
  }
  const wheel = (e: WheelEvent) => {
    const { u, r } = unit()
    // Cursor in map units, relative to the centered viewBox.
    const cx = (e.clientX - r.left - r.width / 2) * u + W / 2
    const cy = (e.clientY - r.top - r.height / 2) * u + H / 2
    setView((v) => {
      const k = Math.min(12, Math.max(1, v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }
    })
  }

  const r = (px: number) => px / view.k
  // Draw order: quiet sites first, the selected and hovered last so they sit on top.
  const order = [...sites].sort((a, b) => Number(a.site_id === selected || a.site_id === hover) - Number(b.site_id === selected || b.site_id === hover) || (a.index ?? 0) - (b.index ?? 0))
  const label = sites.find((s) => s.site_id === (hover ?? selected))
  const lp = label && at(label.lat, label.lon)
  const hp = here && at(here.lat, here.lon)

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onWheel={wheel}
      role="img"
      aria-label="Map of the United States with every site"
    >
      <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transition: glide ? 'transform 0.9s cubic-bezier(0.2, 0, 0, 1)' : undefined }}>
        <path d={outline} fill={color.raised} stroke="none" style={{ filter: 'drop-shadow(0 3px 6px rgb(0 0 0 / 0.10))' }} />
        {states.map((s) => (
          <path key={s.id} d={s.d} fill={color.raised} className="transition-colors hover:fill-[#d2dcc8]" />
        ))}
        <path d={borders} fill="none" stroke={color.surface} strokeWidth={r(1.2)} strokeLinejoin="round" />
        <path d={outline} fill="none" stroke={color.forest} strokeOpacity={0.35} strokeWidth={r(1)} />

        {order.map((s) => {
          const p = at(s.lat, s.lon)
          if (!p) return null
          const stop = s.alerts.some((a) => a.type === 'stopwork')
          const on = s.site_id === selected
          const fill = s.index == null ? color.muted : indexColor(s.index)
          return (
            <g key={s.site_id} data-site={s.site_id} className="cursor-pointer" transform={`translate(${p[0]} ${p[1]})`} onPointerEnter={() => setHover(s.site_id)} onPointerLeave={() => setHover(null)}>
              {stop && <circle r={r(16)} fill={hazard.stopwork} opacity={0.35} className="animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />}
              {on && <circle r={r(14)} fill="none" stroke={color.accent} strokeWidth={r(4)} />}
              {s.crew_on_site > 0 && <circle r={r(10)} fill="none" stroke={color.signal} strokeWidth={r(2)} />}
              <circle r={r(s.beacon ? 7.5 : 6)} fill={fill} stroke={s.beacon ? color.text : color.surface} strokeWidth={r(s.beacon ? 2.5 : 1.5)} />
              {(reports[s.site_id]?.length ?? 0) > 0 && <ReportPin rs={reports[s.site_id]} k={view.k} />}
              <circle r={r(14)} fill="transparent" />
            </g>
          )
        })}

        {hp && (
          <g transform={`translate(${hp[0]} ${hp[1]})`} className="pointer-events-none">
            <circle r={r(12)} fill={color.text} opacity={0.12} />
            <circle r={r(5)} fill={color.text} stroke={color.surface} strokeWidth={r(2)} />
          </g>
        )}

        {label && lp && (
          <g transform={`translate(${lp[0]} ${lp[1]}) scale(${1 / view.k})`} className="pointer-events-none">
            <rect x={18} y={-15} rx={4} height={30} width={label.name.length * 7.4 + 54 + (reports[label.site_id]?.length ? 86 : 0)} fill={color.chrome} />
            <text x={28} y={5} fontSize={13} fontWeight={600} fill={color.chromeText} fontFamily="Space Grotesk Variable, sans-serif">
              {label.name}
              <tspan dx={8} fill={color.accent} fontFamily="JetBrains Mono Variable, monospace" fontSize={12}>{label.index ?? '–'}</tspan>
              {reports[label.site_id]?.length ? <tspan dx={10} fontSize={12} fontWeight={500} fill={color.chromeText} opacity={0.8}>{reports[label.site_id].length} report{reports[label.site_id].length > 1 ? 's' : ''}</tspan> : null}
            </text>
          </g>
        )}
      </g>
    </svg>
  )
}

// A small map pin up and to the right of the site, the newest report's hazard color, a count badge for more.
function ReportPin({ rs, k }: { rs: Report[]; k: number }) {
  const newest = [...rs].sort((a, b) => b.ts.localeCompare(a.ts))[0]
  return (
    <g transform={`translate(${9 / k} ${-6 / k}) scale(${1 / k})`} className="pointer-events-none">
      <path d="M0 0 C -6 -8 -6 -15 0 -15 C 6 -15 6 -8 0 0 Z" fill={reportTint(newest.tag)} stroke={color.surface} strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.3))' }} />
      <circle cy={-10} r={2.3} fill={color.surface} />
      {rs.length > 1 && (
        <g transform="translate(7 -15)">
          <circle r={6} fill={color.chrome} />
          <text y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill={color.chromeText} fontFamily="Space Grotesk Variable, sans-serif">{rs.length}</text>
        </g>
      )}
    </g>
  )
}
