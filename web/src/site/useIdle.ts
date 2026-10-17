import { useEffect, useState } from 'react'

// True after `seconds` with no mouse, touch, wheel or key activity. ?idle=5 overrides for testing.
export function useIdle(seconds = 30) {
  const override = Number(new URLSearchParams(location.search).get('idle'))
  const limit = (override || seconds) * 1000
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), limit)
    const wake = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), limit)
    }
    const events = ['pointermove', 'pointerdown', 'wheel', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, wake))
    }
  }, [limit])

  return idle
}
