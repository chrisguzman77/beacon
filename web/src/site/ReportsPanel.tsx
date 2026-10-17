import { useState } from 'react'
import { Camera, ImageOff } from 'lucide-react'
import Fold from '@/components/Fold'
import { API } from '@/api'
import { color, hazard } from '@/tokens'
import { WILDLIFE } from './factors'
import type { Report, Snapshot } from './types'

// Crew hazard photo reports: pinned on a plot of the site (the site at the center, rings for
// distance, each pin at the report's GPS offset and in its hazard's color) and listed with the
// photo, the AI's tag and description, how long ago, and how sure the AI was. A pin and its row
// highlight each other. New reports arrive on the site websocket and appear without a reload.

const FLOOD = ['flood', 'flooding', 'standing_water', 'water', 'washout', 'erosion']
const ELECTRIC = ['downed_line', 'power_line', 'electrical', 'exposed_wire', 'arc']

export function reportTint(tag: string) {
  const t = tag.toLowerCase()
  if (WILDLIFE.includes(t) || WILDLIFE.includes(t.replace(/_/g, ' '))) return hazard.wildlife
  if (FLOOD.includes(t)) return hazard.flood
  if (ELECTRIC.includes(t)) return hazard.stopwork
  return hazard.heat
}

const pretty = (tag: string) => tag.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

function ago(ts: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

// Report position in meters north and east of the site.
function offset(site: Snapshot['site'], r: Report) {
  if (r.lat == null || r.lon == null || site.lat == null || site.lon == null) return null
  return { n: (r.lat - site.lat) * 110540, e: (r.lon - site.lon) * 111320 * Math.cos((site.lat * Math.PI) / 180) }
}

// Ring spacing that fits the farthest pin, in feet.
const STEPS_FT = [100, 250, 500, 1000, 2640, 5280, 10560]

export default function ReportsPanel({ s }: { s: Snapshot }) {
  const [on, setOn] = useState<number | null>(null)
  const reports = s.reports.map((r, i) => ({ ...r, key: r.report_id ?? -i - 1, at: offset(s.site, r) }))
  const pinned = reports.filter((r) => r.at)
  const far_ft = Math.max(1, ...pinned.map((r) => Math.hypot(r.at!.n, r.at!.e) * 3.281))
  const ring = STEPS_FT.find((f) => f * 2 >= far_ft) ?? STEPS_FT[STEPS_FT.length - 1]
  const R = 92 // plot radius in px for two rings
  const px = (m: number) => (m * 3.281 * R) / (ring * 2)
  const latest = reports[0]
  const ringLabel = (ft: number) => (ft >= 2640 ? `${ft / 5280} mi` : `${ft} ft`)

  return (
    <Fold id="hub.reports" title="Hazard reports" defaultOpen summary={reports.length ? `${reports.length} · ${pretty(latest.tag)}` : 'NONE'}>
      <div className="flex flex-col gap-3">
        <svg viewBox={`${-R - 14} ${-R - 14} ${2 * R + 28} ${2 * R + 28}`} className="mx-auto w-full max-w-[260px]" role="img" aria-label="Site plot with report pins">
          <circle r={R + 10} fill={color.raised} />
          {[R / 2, R].map((r) => (
            <circle key={r} r={r} fill="none" stroke={color.border} strokeWidth={1.5} strokeDasharray={r === R ? undefined : '3 4'} />
          ))}
          <line x1={-R - 10} x2={R + 10} y1={0} y2={0} stroke={color.border} strokeWidth={1} />
          <line y1={-R - 10} y2={R + 10} x1={0} x2={0} stroke={color.border} strokeWidth={1} />
          <text x={4} y={-R - 2} fontSize={9} fill={color.muted} fontFamily="JetBrains Mono Variable, monospace">N</text>
          <text x={3} y={R / 2 - 3} fontSize={8} fill={color.muted} fontFamily="JetBrains Mono Variable, monospace">{ringLabel(ring)}</text>
          <text x={3} y={R - 3} fontSize={8} fill={color.muted} fontFamily="JetBrains Mono Variable, monospace">{ringLabel(ring * 2)}</text>
          {/* The site (the beacon) at the center. */}
          <rect x={-6} y={-6} width={12} height={12} rx={2} fill={color.chrome} />
          {pinned.map((r) => {
            const x = px(r.at!.e)
            const y = -px(r.at!.n)
            const tint = reportTint(r.tag)
            const hot = on === r.key
            return (
              <g key={r.key} transform={`translate(${x} ${y})`} className="cursor-pointer" onPointerEnter={() => setOn(r.key)} onPointerLeave={() => setOn(null)}>
                {hot && <circle r={13} fill={tint} opacity={0.25} />}
                <path d="M0 0 C -7 -9 -7 -17 0 -17 C 7 -17 7 -9 0 0 Z" fill={tint} stroke={color.surface} strokeWidth={1.5} style={{ filter: 'drop-shadow(0 2px 2px rgb(0 0 0 / 0.25))' }} />
                <circle cy={-11.5} r={2.6} fill={color.surface} />
              </g>
            )
          })}
        </svg>

        {!reports.length && <p className="text-label text-dim">No hazard reports yet. Crew send them from the crew page with REPORT HAZARD.</p>}
        {reports.length > pinned.length && <p className="text-label text-dim">{reports.length - pinned.length} hazard report{reports.length - pinned.length > 1 ? 's' : ''} had no GPS and {reports.length - pinned.length > 1 ? 'are' : 'is'} listed only.</p>}

        <ul className="flex flex-col gap-2">
          {reports.map((r) => {
            const tint = reportTint(r.tag)
            const photo = r.photo_path ? `${API}${r.photo_path}` : ''
            return (
              <li
                key={r.key}
                onPointerEnter={() => setOn(r.key)}
                onPointerLeave={() => setOn(null)}
                className="grid grid-cols-[52px_1fr] gap-3 rounded-md p-2 transition-colors"
                style={{ background: on === r.key ? color.accentPale : color.bg, borderLeft: `4px solid ${tint}` }}
              >
                {photo ? (
                  <a href={photo} target="_blank" rel="noreferrer" title="Open the photo">
                    <img src={photo} alt={pretty(r.tag)} className="size-[52px] rounded-sm object-cover" loading="lazy" />
                  </a>
                ) : (
                  <span className="flex size-[52px] items-center justify-center rounded-sm" style={{ background: color.raised, color: color.muted }} title="No photo">
                    {r.photo_path === undefined ? <Camera className="size-5" /> : <ImageOff className="size-5" />}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate text-[15px]" style={{ color: tint }}>{pretty(r.tag)}</b>
                    <span className="shrink-0 font-mono text-[11px]" style={{ color: color.muted }}>{ago(r.ts)}</span>
                  </span>
                  <span className="line-clamp-2 block text-[13px] leading-snug">{r.description}</span>
                  <span className="block font-mono text-[10px] tracking-wider uppercase" style={{ color: color.muted }}>
                    {r.confidence != null ? `${Math.round(r.confidence * 100)}% sure` : ''}
                    {r.at ? ` · ${Math.round(Math.hypot(r.at.n, r.at.e) * 3.281)} ft ${dir(r.at)}` : ''}
                    {r.note && r.note !== 'seed' ? ` · “${r.note}”` : ''}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </Fold>
  )
}

// Compass direction from the site, eight points.
function dir(a: { n: number; e: number }) {
  const deg = (Math.atan2(a.e, a.n) * 180) / Math.PI
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((deg + 360) % 360) / 45) % 8]
}
