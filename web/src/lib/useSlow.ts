import { useEffect, useState } from 'react'

// True once something has been waiting longer than `ms`, so a screen can stop saying "loading"
// and say what is wrong instead. Resets when `waiting` goes false or `key` changes.
export function useSlow(waiting: boolean, ms = 8000, key?: unknown) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setSlow(false)
    if (!waiting) return
    const t = setTimeout(() => setSlow(true), ms)
    return () => clearTimeout(t)
  }, [waiting, ms, key])
  return slow
}
