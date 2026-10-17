import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSite } from './store'
import { isTakeover } from './types'
import { buildFactors, isHazard } from './factors'
import { useIdle } from './useIdle'
import { useFactorHistory } from './useFactorHistory'
import SiteBoard from './SiteBoard'
import AlarmState from './AlarmState'
import CautionScreen from './CautionScreen'
import AppNav from '@/components/AppNav'
import { beaconSiteId } from './fakeGateway'

const FLASH_EVERY_MS = 10_000
const FLASH_FOR_MS = 3_000

// FIELD VIEW (stored in sweet treats): frozen copy of the WEB page as of 2026-10-17. Self-contained;
// HUB continues from the same code in src/site. The live factor web for one site (default: the beacon site), with the idle caution
// screen and the full screen alarm state during stop work.
export default function FieldView() {
  const id = Number(useParams().id ?? beaconSiteId)
  const snapshot = useSite((s) => s.snapshot)
  const live = useSite((s) => s.live)
  const connect = useSite((s) => s.connect)
  const setSimPaused = useSite((s) => s.setSimPaused)
  const idle = useIdle(30)
  const [flash, setFlash] = useState(false)

  useEffect(() => connect(id), [connect, id])
  useEffect(() => setSimPaused(!idle), [idle, setSimPaused])

  const history = useFactorHistory(id, snapshot)

  const hazards = snapshot ? buildFactors(snapshot).filter(isHazard) : []
  const anyHazard = hazards.length > 0

  // While idle: hazards flash every 10 s for 3 s; with no hazards the NO HAZARDS card holds.
  useEffect(() => {
    if (!idle || !anyHazard) return setFlash(false)
    let off: ReturnType<typeof setTimeout>
    const pulse = () => {
      setFlash(true)
      off = setTimeout(() => setFlash(false), FLASH_FOR_MS)
    }
    pulse()
    const every = setInterval(pulse, FLASH_EVERY_MS)
    return () => {
      clearInterval(every)
      clearTimeout(off)
    }
  }, [idle, anyHazard])

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
  const caution = idle && !alarm && (anyHazard ? flash : true)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-ink select-none">
      {alarm ? <AlarmState s={snapshot} /> : <SiteBoard key={snapshot.site.id} s={snapshot} live={live} idle={idle} history={history} />}
      {caution && <CautionScreen hazards={hazards} site={snapshot.site.name} />}
    </div>
  )
}
