import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Accessibility, Check, Gauge, LayoutGrid, Scan } from 'lucide-react'
import { color } from '@/tokens'
import { useReducedMotion } from '@/sweet-treats/useReducedMotion'

// The MARSH frame shared by the dashboard and HUB: dark top bar (logo, `unit`, `status` items,
// clock), the paper content area, dark bottom tabs with the Reduced motion toggle, and the footer line.

const pad2 = (n: number) => String(n).padStart(2, '0')

export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return { now, time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`, date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() }
}

type Props = { unit: string; status: ReactNode; active: 'dashboard' | 'hub'; footer: [string, string]; hubTo?: string; children: ReactNode }

export default function Frame({ unit, status, active, footer, hubTo = '/hub', children }: Props) {
  const { time } = useClock()
  const [reduced, toggleMotion] = useReducedMotion()
  const fake = new URLSearchParams(location.search).has('fake')

  return (
    <div className="flex min-h-dvh flex-col lg:h-full lg:min-h-0" style={{ background: color.chrome, color: color.text }}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 lg:px-7" style={{ color: color.chromeText }}>
        <div className="flex items-center gap-3">
          <Scan className="size-6" style={{ color: color.accent }} strokeWidth={2.25} />
          <span className="text-[19px] font-bold tracking-tight">OmniRisk</span>
          <span className="hidden font-mono text-[12px] opacity-70 sm:inline">/ {unit}</span>
        </div>
        <div className="flex items-center gap-4 text-[13px] lg:gap-7">
          {fake && <span className="hidden font-semibold tracking-wide sm:inline" style={{ color: color.accent }}>DEMO FEED</span>}
          <span className="hidden items-center gap-7 md:flex">{status}</span>
          <span className="font-mono text-[18px] tracking-wider">{time}</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 rounded-sm px-4 pt-4 pb-5 lg:min-h-0 lg:px-7 lg:pt-5" style={{ background: color.bg }}>
        {children}
      </main>

      <nav className="sticky bottom-0 z-30 flex shrink-0 items-center gap-2 px-4 pt-3 pb-3 lg:static lg:gap-3 lg:px-7 lg:pb-2" style={{ background: color.chrome }}>
        <Tab to="/dashboard" active={active === 'dashboard'} icon={<LayoutGrid className="size-5" />}>Dashboard</Tab>
        <Tab to={hubTo} active={active === 'hub'} icon={<Gauge className="size-5" />}>Hub</Tab>
        <button
          onClick={toggleMotion}
          className="press ml-auto flex h-12 shrink-0 items-center justify-center gap-3 rounded-md px-3 text-[15px] font-semibold lg:min-w-64 lg:px-5"
          style={{ color: color.chromeText, boxShadow: `inset 0 0 0 1.5px ${color.chromeText}` }}
          aria-pressed={reduced}
        >
          <Accessibility className="size-5" /> <span className="hidden lg:inline">Reduced motion: {reduced ? 'ON' : 'OFF'}</span> <Check className="hidden size-4 lg:block" style={{ color: color.accent }} />
        </button>
      </nav>
      <footer className="hidden shrink-0 justify-between px-7 pb-2 lg:flex font-mono text-[10px] tracking-[0.06em]" style={{ color: color.chromeText, opacity: 0.7 }}>
        <span>SITE SAFETY PLATFORM · {footer[0]}</span>
        <span>{footer[1]}</span>
      </footer>
    </div>
  )
}

function Tab({ children, icon, to, active }: { children: string; icon: ReactNode; to?: string; active?: boolean }) {
  const body = (
    <span
      className={`flex h-12 flex-1 items-center justify-center gap-3 rounded-md px-4 text-[15px] font-semibold lg:w-52 lg:flex-none lg:justify-start lg:px-5 ${active ? '' : 'press'}`}
      style={{ background: active ? color.accent : color.chromeSoft, color: active ? color.accentInk : color.chromeText }}
    >
      {icon}
      {children}
    </span>
  )
  return to && !active ? <Link className="flex flex-1 lg:flex-none" to={`${to}${location.search.replace(/[?&](node|step)=[^&]*/g, '').replace(/^&/, '?')}`}>{body}</Link> : <span className="flex flex-1 lg:flex-none">{body}</span>
}
