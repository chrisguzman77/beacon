import { useState } from 'react'
import { ChevronDown, Zap } from 'lucide-react'
import type { Alert } from '@/api'
import Fold from '@/components/Fold'
import { label, Pill } from '@/components/marsh'
import { color, hazard } from '@/tokens'
import type { Snapshot } from './types'

// The compliance log (web guide section 7): every stop work at the site, newest first, with when
// it started, the strikes that reset the clock, and how it ended: still active, released (by whom,
// when) or expired. Built from the alerts the site already sends; no extra endpoint.

const STOPS = ['stopwork', 'estop', 'beacon_unsafe']
const reasonOf: Record<string, string> = { stopwork: 'Lightning', estop: 'E-stop pressed', beacon_unsafe: 'Beacon unsafe' }

type Strike = { ts: string; distance_m?: number; source?: string }

const hhmm = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const day = (ts: string) => {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}
const mins = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000))
const span = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`)
const mi = (m?: number) => (m ? `${Math.round(m / 1609)} mi` : '')

function outcome(a: Alert) {
  const now = new Date().toISOString()
  if (a.cleared) return { kind: 'released' as const, end: a.cleared, text: `Released by ${a.cleared_by || 'supervisor'} at ${hhmm(a.cleared)}` }
  if (a.expires && a.expires < now && !a.awaiting_clear) return { kind: 'expired' as const, end: a.expires, text: `Clock ran out at ${hhmm(a.expires)}` }
  return { kind: 'active' as const, end: now, text: a.awaiting_clear ? 'Waiting for the supervisor PIN' : a.expires ? `Clock ends ${hhmm(a.expires)} unless it strikes again` : 'In effect' }
}

export default function CompliancePanel({ s }: { s: Snapshot }) {
  const log = (s.alert_log ?? []).filter((a) => STOPS.includes(a.type))
  const active = log.filter((a) => outcome(a).kind === 'active').length

  return (
    <Fold
      id="hub.compliance"
      title="Compliance log"
      summary={log.length ? `${log.length} stop work${log.length > 1 ? 's' : ''}` : 'None'}
      badge={active ? <Pill tint={hazard.stopwork} solid>Active</Pill> : undefined}
    >
      {log.length === 0 ? (
        <p className="text-[13px]" style={{ color: color.muted }}>No stop work recorded at this site yet. Every one is logged here with its strikes and who released it.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {log.map((a) => <Entry key={a.alert_id} a={a} />)}
        </ol>
      )}
    </Fold>
  )
}

function Entry({ a }: { a: Alert }) {
  const [open, setOpen] = useState(false)
  const o = outcome(a)
  const strikes = ((a.payload.history as Strike[] | undefined) ?? []).slice().sort((x, y) => x.ts.localeCompare(y.ts))
  const n = strikes.length || Number(a.payload.resets ?? 0) + 1
  const first = strikes[0]?.distance_m ?? (a.payload.distance_m as number | undefined)
  const tint = o.kind === 'active' ? hazard.stopwork : o.kind === 'released' ? color.signal : color.muted

  return (
    <li className="rounded-md" style={{ background: color.bg, borderLeft: `4px solid ${tint}` }}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left" aria-expanded={open}>
        <span className="min-w-0">
          <span className={label} style={{ color: color.muted }}>{day(a.started)} · {hhmm(a.started)}</span>
          <span className="block text-[15px] font-semibold">
            {reasonOf[a.type] ?? a.type}{a.type === 'stopwork' && first ? ` ${mi(first)}` : ''}
            {a.type === 'stopwork' && <span className="font-normal" style={{ color: color.muted }}> · {n} strike{n > 1 ? 's' : ''}</span>}
          </span>
          <span className="block text-[13px]" style={{ color: o.kind === 'active' ? hazard.stopwork : color.muted }}>{o.text}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Pill tint={tint} solid={o.kind === 'active'}>{o.kind}</Pill>
          <span className="text-[12px]" style={{ color: color.muted }}>{span(mins(a.started, o.end))}</span>
          {strikes.length > 0 && <ChevronDown className="size-4 transition-transform" style={{ color: color.muted, transform: open ? 'rotate(180deg)' : undefined }} />}
        </span>
      </button>
      {open && strikes.length > 0 && (
        <ul className="flex animate-in flex-col gap-1 px-3 pb-3 duration-200 fade-in">
          {strikes.map((k, i) => (
            <li key={k.ts + i} className="flex items-center gap-2 text-[13px]">
              <Zap className="size-3.5 shrink-0" style={{ color: hazard.heat }} />
              <span className="font-mono">{hhmm(k.ts)}</span>
              <span>{mi(k.distance_m) || 'strike'}</span>
              <span style={{ color: color.muted }}>{i === 0 ? 'started the stop' : 'reset the clock to 30 min'}{k.source === 'sim' ? ' · simulated' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
