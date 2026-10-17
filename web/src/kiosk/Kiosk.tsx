import { useEffect, useState } from 'react'
import { useKiosk } from './store'
import { isTakeover } from './types'
import { buildFactors, isHazard } from './factors'
import { useIdle } from './useIdle'
import StatusScreen from './StatusScreen'
import StopWorkScreen from './StopWorkScreen'
import PendingScreen from './PendingScreen'
import CautionScreen from './CautionScreen'

export type Screen = 'status' | 'crew' | 'supervisor' | 'briefing' | 'report'

const FLASH_EVERY_MS = 10_000
const FLASH_FOR_MS = 3_000

export default function Kiosk() {
  const snapshot = useKiosk((s) => s.snapshot)
  const gateway = useKiosk((s) => s.gateway)
  const connect = useKiosk((s) => s.connect)
  const [screen, setScreen] = useState<Screen>('status')
  const idle = useIdle(30)
  const [flash, setFlash] = useState(false)

  useEffect(() => connect(), [connect])

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

  let body
  if (!snapshot) body = <Connecting gateway={gateway} />
  else if (screen === 'supervisor') body = <PendingScreen title="Supervisor" onBack={() => setScreen('status')} />
  else if (isTakeover(snapshot)) body = <StopWorkScreen s={snapshot} onSupervisor={() => setScreen('supervisor')} />
  else if (screen === 'status') body = <StatusScreen s={snapshot} gateway={gateway} go={setScreen} />
  else body = <PendingScreen title={screen} onBack={() => setScreen('status')} />

  const caution = snapshot && idle && !isTakeover(snapshot) && (anyHazard ? flash : true)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-ink select-none">
      {body}
      {caution && <CautionScreen hazards={hazards} site={snapshot.site.name} />}
    </div>
  )
}

function Connecting({ gateway }: { gateway: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="size-4 bg-signal animate-beacon-pulse" />
      <p className="text-heading font-semibold">Connecting to the beacon</p>
      <p className="text-body text-dim">
        {gateway ? 'Waiting for the first reading from the sensors.' : 'Looking for the gateway on this device.'}
      </p>
    </div>
  )
}
