import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSite } from '@/site/store'
import { isTakeover } from '@/site/types'
import { useFactorHistory } from '@/sweet-treats/useFactorHistory'
import HubBoard from '@/site/HubBoard'
import AlarmState from '@/site/AlarmState'
import AppNav from '@/components/AppNav'
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

  if (!snapshot)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AppNav />
        <div className="size-4 animate-beacon-pulse bg-signal" />
        <p className="text-heading font-semibold">Loading the web</p>
        <p className="text-body text-dim">Waiting for the first reading. Add ?fake=1 to the URL to use demo data.</p>
      </div>
    )

  const alarm = isTakeover(snapshot)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-ink select-none">
      {alarm ? <AlarmState s={snapshot} /> : <HubBoard key={snapshot.site.id} s={snapshot} live={live} history={history} />}
    </div>
  )
}
