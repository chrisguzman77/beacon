import { useEffect, useState } from 'react'

// Reduced motion toggle (from the MARSH design's bottom bar). Starts from the system setting,
// remembered in this browser, and sets data-motion="reduced" on <html>; index.css then stops
// pulses, glides and slides.
const KEY = 'reduced-motion'

function initial() {
  try {
    const v = localStorage.getItem(KEY)
    if (v !== null) return v === '1'
  } catch {
    /* no storage */
  }
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(initial)
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
    try {
      localStorage.setItem(KEY, reduced ? '1' : '0')
    } catch {
      /* remembered for this visit only */
    }
  }, [reduced])
  return [reduced, () => setReduced((r) => !r)] as const
}
