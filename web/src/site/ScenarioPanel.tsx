import { CloudSun, Gamepad2, QrCode, Waves, Zap } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Fold from '@/components/Fold'
import { label, Pill } from '@/components/marsh'
import { color, hazard } from '@/tokens'
import type { SimEvent, Snapshot } from './types'

// The Roblox twin, beacon site only (web guide section 7): a QR code so judges join the
// experience from their phones, what the twin last did (its strikes, weather and water arrive
// on the site websocket marked source 'sim'), and the Roblox players inside the work zone.
// The backend keeps no "current scenario", so the panel shows the last sim events instead.

// Slavik's public Roblox experience link. Empty until it is published; the QR appears when set.
export const ROBLOX_JOIN_URL = ''

const icon = { strike: Zap, weather: CloudSun, water: Waves }
const tint = { strike: hazard.stopwork, weather: hazard.heat, water: hazard.flood }

function ago(ts: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60_000))
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

export default function ScenarioPanel({ s }: { s: Snapshot }) {
  const events: SimEvent[] = s.sim ?? []
  const players = s.crew.filter((c) => c.roblox && c.in)
  const recent = events[0] && Date.now() - new Date(events[0].ts).getTime() < 10 * 60_000

  return (
    <Fold id="hub.scenario" title="Roblox twin" defaultOpen summary={events[0] ? `${events[0].text}, ${ago(events[0].ts)}` : 'Waiting for the twin'} badge={recent ? <Pill tint={hazard.stopwork} solid>Playing</Pill> : undefined}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {ROBLOX_JOIN_URL ? (
            <span className="shrink-0 rounded-md p-2" style={{ background: '#fff' }}>
              <QRCodeSVG value={ROBLOX_JOIN_URL} size={112} fgColor={color.text} level="M" />
            </span>
          ) : (
            <span className="flex size-[128px] shrink-0 flex-col items-center justify-center gap-1 rounded-md text-center" style={{ background: color.bg, color: color.muted, boxShadow: `inset 0 0 0 1.5px ${color.border}` }}>
              <QrCode className="size-8" strokeWidth={1.5} />
              <span className="px-2 text-[11px] leading-tight">Join link coming</span>
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">Join the site in Roblox</p>
            <p className="text-[13px] leading-snug" style={{ color: color.muted }}>
              Scan with a phone camera. Walk into the work zone and you appear on the muster list; storms in the twin strike the real beacon.
            </p>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className={label} style={{ color: color.muted }}>Live from the twin</h3>
          {events.length === 0 ? (
            <p className="text-[13px]" style={{ color: color.muted }}>Nothing yet. Press play on a storm scenario in Roblox and its strikes and weather show here.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {events.slice(0, 5).map((e) => {
                const Icon = icon[e.kind]
                return (
                  <li key={e.kind + e.ts} className="flex items-center gap-3 rounded-md px-3 py-2" style={{ background: color.bg }}>
                    <Icon className="size-4 shrink-0" style={{ color: tint[e.kind] }} />
                    <span className="min-w-0 flex-1 truncate text-[14px]">{e.text}</span>
                    <span className="shrink-0 text-[12px]" style={{ color: color.muted }}>{ago(e.ts)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {players.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className={label} style={{ color: color.muted }}>Players in the work zone</h3>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: color.raised }}>
                  <Gamepad2 className="size-4" /> {p.name}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </Fold>
  )
}
