import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSite } from '@/site/store'
import { isTakeover } from '@/site/types'
import { useFactorHistory } from '@/sweet-treats/useFactorHistory'
import HubBoard from '@/site/HubBoard'
import AlarmState from '@/site/AlarmState'
import { RotateCcw, Scan } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSlow } from '@/lib/useSlow'
import { useTitle } from '@/lib/useTitle'
import { formatCountdown } from '@/site/store'
import { color } from '@/tokens'
import { beaconSiteId } from '@/site/fakeGateway'
import { useDash } from '@/dashboard/store'

// HUB: the site page, built on the live factor web for one site, with the full screen alarm state during
// stop work. It follows the dashboard: /hub opens the site selected there (the
// beacon site if none), and a site opened here becomes the dashboard's selection.
export default function Hub() {
  const param = useParams().id
  const dashSelected = useDash((s) => s.selected)
  const id = Number(param ?? dashSelected ?? beaconSiteId)
  useEffect(() => {
    if (param) useDash.getState().select(Number(param))
  }, [param])
  const snapshot = useSite((s) => s.snapshot)
  const live = useSite((s) => s.live)
  const connect = useSite((s) => s.connect)

  useEffect(() => connect(id), [connect, id])

  const history = useFactorHistory(id, snapshot)
  const slow = useSlow(!snapshot, 8000, id)
  useTitle(!snapshot ? 'Hub' : isTakeover(snapshot) ? `Stop work${snapshot.countdown > 0 ? ` ${formatCountdown(snapshot.countdown)}` : ''} · ${snapshot.site.name}` : `${snapshot.site.name} · Hub`)

  if (!snapshot)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3" style={{ background: color.bg, color: color.text }}>
        <Scan className={`size-10 ${slow ? '' : 'animate-beacon-pulse'}`} style={{ color: color.accent }} strokeWidth={2} />
        <p className="text-[22px] font-semibold">{slow ? 'The site is not answering' : 'Reading the site'}</p>
        <p className="max-w-md px-6 text-center text-[14px]" style={{ color: color.muted }}>
          {slow ? 'No reading from the backend yet. Check the connection and retry; the beacon keeps enforcing stop work on its own.' : 'Waiting for the first reading from the backend.'}
        </p>
        {slow && (
          <div className="mt-2 flex gap-3">
            <button onClick={() => location.reload()} className="press flex h-11 items-center gap-2 rounded-md px-5 text-[15px] font-semibold" style={{ background: color.accent, color: color.accentInk }}>
              <RotateCcw className="size-4" /> Retry
            </button>
            <Link to="/dashboard" className="press flex h-11 items-center rounded-md px-5 text-[15px] font-semibold" style={{ boxShadow: `inset 0 0 0 1.5px ${color.border}` }}>Dashboard</Link>
          </div>
        )}
      </div>
    )

  const alarm = isTakeover(snapshot)

  return (
    <div className="relative min-h-dvh w-full bg-bg text-ink select-none lg:h-screen lg:overflow-hidden">
      {alarm ? <AlarmState s={snapshot} /> : <HubBoard key={snapshot.site.id} s={snapshot} live={live} history={history} />}
    </div>
  )
}
