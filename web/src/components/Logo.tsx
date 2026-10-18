import type { CSSProperties } from 'react'

// The OmniRisk mark, drawn in the current text color through a mask so it works on the dark bars and the paper.
export function Logo({ className = 'size-6', style }: { className?: string; style?: CSSProperties }) {
  const mask = 'url(/omnirisk-mark.png) center / contain no-repeat'
  return <span role="img" aria-label="OmniRisk" className={`inline-block shrink-0 ${className}`} style={{ background: 'currentColor', mask, WebkitMask: mask, ...style }} />
}

// The wordmark as the logo sets it: capitals with wide spacing.
export function Wordmark({ className = 'text-[17px]' }: { className?: string }) {
  return <span className={`font-semibold tracking-[0.22em] ${className}`}>OMNIRISK</span>
}
