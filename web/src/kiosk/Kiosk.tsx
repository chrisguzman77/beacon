import { useEffect, useState } from 'react'
import { useKiosk } from './store'
import { isTakeover } from './types'
import StatusScreen from './StatusScreen'
import StopWorkScreen from './StopWorkScreen'
import PendingScreen from './PendingScreen'

export type Screen = 'status' | 'crew' | 'supervisor' | 'briefing' | 'report'

export default function Kiosk() {
  const snapshot = useKiosk((s) => s.snapshot)
  const gateway = useKiosk((s) => s.gateway)
  const connect = useKiosk((s) => s.connect)
  const [screen, setScreen] = useState<Screen>('status')

  useEffect(() => connect(), [connect])

  let body
  if (!snapshot) body = <Connecting gateway={gateway} />
  else if (screen === 'supervisor') body = <PendingScreen title="Supervisor" onBack={() => setScreen('status')} />
  else if (isTakeover(snapshot)) body = <StopWorkScreen s={snapshot} onSupervisor={() => setScreen('supervisor')} />
  else if (screen === 'status') body = <StatusScreen s={snapshot} gateway={gateway} go={setScreen} />
  else body = <PendingScreen title={screen} onBack={() => setScreen('status')} />

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="relative h-[480px] w-[800px] overflow-hidden bg-bg text-ink select-none">{body}</div>
    </div>
  )
}

function Connecting({ gateway }: { gateway: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="size-4 rounded-full bg-dim animate-beacon-pulse" />
      <p className="text-heading font-semibold">Connecting to the beacon</p>
      <p className="text-body text-dim">
        {gateway ? 'Waiting for the first reading from the sensors.' : 'Looking for the gateway on this device.'}
      </p>
    </div>
  )
}
