import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSite } from '@/site/store'
import { isTakeover } from '@/site/types'
import { buildFactors, isHazard } from '@/site/factors'
import { useIdle } from '@/site/useIdle'
import SiteBoard from '@/site/SiteBoard'
import AlarmState from '@/site/AlarmState'
import CautionScreen from '@/site/CautionScreen'

const FLASH_EVERY_MS = 10_000
const FLASH_FOR_MS = 3_000

export default function Site() {
  const id = Number(useParams().id)
  const snapshot = useSite((s) => s.snapshot)
  const live = useSite((s) => s.live)
  const connect = useSite((s) => s.connect)
  const setSimPaused = useSite((s) => s.setSimPaused)
  const idle = useIdle(30)
  const [flash, setFlash] = useState(false)

  useEffect(() => connect(id), [connect, id])
  useEffect(() => setSimPaused(!idle), [idle, setSimPaused])

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
        <div className="size-4 animate-beacon-pulse bg-signal" />
        <p className="text-heading font-semibold">Loading site {id}</p>
        <p className="text-body text-dim">Waiting for the first reading. Add ?fake=1 to the URL to use demo data.</p>
      </div>
    )

  const alarm = isTakeover(snapshot)
  const caution = idle && !alarm && (anyHazard ? flash : true)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-ink select-none">
      {alarm ? <AlarmState s={snapshot} /> : <SiteBoard s={snapshot} live={live} idle={idle} />}
      {caution && <CautionScreen hazards={hazards} site={snapshot.site.name} />}
    </div>
  )
}
