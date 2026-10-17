import { useEffect } from 'react'

// The browser tab names the page, so a judge with several tabs open can find the alarm.
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · OmniRisk` : 'OmniRisk'
  }, [title])
}
