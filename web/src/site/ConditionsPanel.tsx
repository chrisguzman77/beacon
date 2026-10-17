import { useEffect, useState } from 'react'
import { Bar, BarChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { get } from '@/api'
import Fold from '@/components/Fold'
import { label } from '@/components/marsh'
import { chart, color } from '@/tokens'

// Conditions over the last 48 hours (web guide section 7): hourly heat index, rain and gusts from
// GET /sites/{id}/conditions?hours=48. Three measures in different units, so three small charts on
// one shared time axis (never two y scales), each one series named by its title, one crosshair
// synced across them, dashed caution and danger lines where limits exist, and a table view.

type Row = { ts: string; heat_max: number | null; precip: number | null; gust_max: number | null; soil?: number | null; water?: number | null }
type Point = { t: number; heat: number | null; rain: number | null; gust: number | null }

const fake = new URLSearchParams(location.search).has('fake')
const KMH_PER_MPH = 1.609

function fakeRows(): Row[] {
  const now = Date.now() - (Date.now() % 3_600_000)
  return Array.from({ length: 48 }, (_, i) => {
    const t = now - (47 - i) * 3_600_000
    const hour = new Date(t).getHours()
    const day = Math.sin(((hour - 9) / 24) * 2 * Math.PI)
    return {
      ts: new Date(t).toISOString(),
      heat_max: Math.round(84 + 14 * day + (i > 30 ? 5 : 0)),
      precip: hour >= 14 && hour <= 17 && i > 20 ? [0.4, 3.2, 6.1, 1.8][hour - 14] : 0,
      gust_max: Math.round(12 + 10 * Math.max(0, day) + (hour >= 14 && hour <= 17 && i > 20 ? 30 : 0)),
    }
  })
}

function useConditions(siteId: number) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (fake) return setRows(fakeRows())
    let stop = false
    const load = () =>
      get<Row[]>(`/sites/${siteId}/conditions?hours=48`)
        .then((r) => !stop && (setRows(r), setFailed(false)))
        .catch(() => !stop && setFailed(true))
    load()
    const t = setInterval(load, 10 * 60_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [siteId])
  return { rows, failed }
}

const hour = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric' })
const dayHour = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
const r1 = (n: number) => Math.round(n * 10) / 10

export default function ConditionsPanel({ siteId }: { siteId: number }) {
  const { rows, failed } = useConditions(siteId)
  const [table, setTable] = useState(false)
  const data: Point[] = (rows ?? []).map((r) => ({
    t: new Date(r.ts).getTime(),
    heat: r.heat_max == null ? null : Math.round(r.heat_max),
    rain: r.precip == null ? null : r1(r.precip),
    gust: r.gust_max == null ? null : Math.round(r.gust_max / KMH_PER_MPH),
  }))
  const nums = (k: keyof Point) => data.map((d) => d[k]).filter((v): v is number => v != null)
  const peakHeat = nums('heat').length ? Math.max(...nums('heat')) : null
  const totalRain = r1(nums('rain').reduce((a, b) => a + b, 0))
  const peakGust = nums('gust').length ? Math.max(...nums('gust')) : null
  const summary = !rows ? (failed ? 'Not available' : 'Loading') : peakHeat == null ? 'No readings yet' : `Peak ${peakHeat}°F · ${totalRain} mm rain`

  return (
    <Fold id="hub.conditions" title="Conditions, 48 h" summary={summary}>
      {!rows ? (
        <p className="text-[13px]" style={{ color: color.muted }}>{failed ? 'The conditions history did not load. It retries every 10 minutes.' : 'Loading the last 48 hours…'}</p>
      ) : data.length === 0 ? (
        <p className="text-[13px]" style={{ color: color.muted }}>No hourly readings for this site yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Small title="Heat index" note={peakHeat == null ? '' : `peak ${peakHeat}°F`} data={data} k="heat" tint={chart.heat} unit="°F" limits={[91, 103]} />
          <Small title="Rain per hour" note={`${totalRain} mm in 48 h`} data={data} k="rain" tint={chart.rain} unit="mm" bars />
          <Small title="Wind gusts" note={peakGust == null ? '' : `peak ${peakGust} mph`} data={data} k="gust" tint={chart.gust} unit="mph" limits={[25, 35]} axis />
          <button onClick={() => setTable(!table)} className="self-start text-[12px] underline" style={{ color: color.muted }} aria-expanded={table}>
            {table ? 'Hide the table' : 'Show as a table'}
          </button>
          {table && (
            <div className="max-h-64 overflow-y-auto rounded-md" style={{ background: color.bg }}>
              <table className="w-full text-[12px]">
                <thead className="sticky top-0" style={{ background: color.raised }}>
                  <tr>{['Time', 'Heat °F', 'Rain mm', 'Gust mph'].map((h) => <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((d) => (
                    <tr key={d.t} className="border-t" style={{ borderColor: color.border }}>
                      <td className="px-2 py-1">{dayHour(d.t)}</td>
                      <td className="px-2 py-1 tabular-nums">{d.heat ?? '–'}</td>
                      <td className="px-2 py-1 tabular-nums">{d.rain ?? '–'}</td>
                      <td className="px-2 py-1 tabular-nums">{d.gust ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Fold>
  )
}

type SmallProps = { title: string; note: string; data: Point[]; k: 'heat' | 'rain' | 'gust'; tint: string; unit: string; limits?: [number, number]; bars?: boolean; axis?: boolean }

// One measure: a 2 px line (or thin rounded bars for rain), recessive axes, limit lines, hover readout.
function Small({ title, note, data, k, tint, unit, limits, bars, axis }: SmallProps) {
  const vals = data.map((d) => d[k]).filter((v): v is number => v != null)
  const top = Math.max(...vals, limits ? limits[1] + (limits[1] - limits[0]) * 0.4 : 0, bars ? 1 : 0)
  const bottom = bars ? 0 : Math.min(...vals, limits ? limits[0] - 5 : Infinity)
  const common = { data, syncId: 'conditions', margin: { top: 4, right: 4, bottom: 0, left: 0 } }
  const x = <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} hide={!axis} tickFormatter={hour} tick={{ fontSize: 10, fill: color.muted }} tickLine={false} axisLine={{ stroke: color.border }} minTickGap={24} />
  const y = <YAxis domain={[Math.floor(bottom), Math.ceil(top)]} width={30} tick={{ fontSize: 10, fill: color.muted }} tickLine={false} axisLine={false} tickCount={3} />
  const tip = <Tooltip cursor={{ stroke: color.muted, strokeDasharray: '3 3' }} content={({ active, payload }) => (active && payload?.[0] ? <Readout t={payload[0].payload.t} v={payload[0].payload[k]} unit={unit} title={title} /> : null)} />
  const lines = limits?.map((l, i) => <ReferenceLine key={l} y={l} stroke={tint} strokeOpacity={i ? 0.7 : 0.4} strokeDasharray="4 4" ifOverflow="extendDomain" />)

  return (
    <section>
      <p className="mb-1 flex items-baseline justify-between gap-2">
        <span className={label} style={{ color: color.text }}>
          <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: tint }} />
          {title}
        </span>
        <span className="text-[12px]" style={{ color: color.muted }}>{note}</span>
      </p>
      <div style={{ height: axis ? 82 : 64 }}>
        <ResponsiveContainer width="100%" height="100%">
          {bars ? (
            <BarChart {...common}>
              {x}
              {y}
              {tip}
              <Bar dataKey={k} fill={tint} radius={[3, 3, 0, 0]} maxBarSize={6} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart {...common}>
              {x}
              {y}
              {lines}
              {tip}
              <Line dataKey={k} stroke={tint} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: color.surface, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function Readout({ t, v, unit, title }: { t: number; v: number | null; unit: string; title: string }) {
  return (
    <div className="rounded-md px-2.5 py-1.5 text-[12px] shadow-md" style={{ background: color.chrome, color: color.chromeText }}>
      <div className="opacity-75">{dayHour(t)}</div>
      <div className="font-semibold">{title}: {v ?? '–'} {unit}</div>
    </div>
  )
}
