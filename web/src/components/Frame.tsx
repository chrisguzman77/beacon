import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Accessibility, Camera, Check, ClipboardList, Gauge, LayoutGrid, Scan } from 'lucide-react'
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
    <div className="flex h-full flex-col" style={{ background: color.chrome, color: color.text }}>
      <header className="flex h-14 shrink-0 items-center justify-between px-7" style={{ color: color.chromeText }}>
        <div className="flex items-center gap-3">
          <Scan className="size-6" style={{ color: color.accent }} strokeWidth={2.25} />
          <span className="text-[19px] font-bold tracking-tight">PLANIT</span>
          <span className="font-mono text-[12px] opacity-70">/ {unit}</span>
        </div>
        <div className="flex items-center gap-7 text-[13px]">
          {fake && <span className="font-semibold tracking-wide" style={{ color: color.accent }}>DEMO FEED</span>}
          {status}
          <span className="font-mono text-[18px] tracking-wider">{time}</span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 rounded-sm px-7 pt-5 pb-5" style={{ background: color.bg }}>
        {children}
      </main>

      <nav className="flex shrink-0 items-center gap-3 px-7 pt-3 pb-2">
        <Tab to="/dashboard" active={active === 'dashboard'} icon={<LayoutGrid className="size-5" />}>Dashboard</Tab>
        <Tab to={hubTo} active={active === 'hub'} icon={<Gauge className="size-5" />}>Hub</Tab>
        <Tab icon={<ClipboardList className="size-5" />} soon>Conditions</Tab>
        <Tab icon={<Camera className="size-5" />} soon>Reports</Tab>
        <button
          onClick={toggleMotion}
          className="ml-auto flex h-12 min-w-64 items-center justify-center gap-3 rounded-md px-5 text-[15px] font-semibold"
          style={{ color: color.chromeText, boxShadow: `inset 0 0 0 1.5px ${color.chromeText}` }}
          aria-pressed={reduced}
        >
          <Accessibility className="size-5" /> Reduced motion: {reduced ? 'ON' : 'OFF'} <Check className="size-4" style={{ color: color.accent }} />
        </button>
      </nav>
      <footer className="flex shrink-0 justify-between px-7 pb-2 font-mono text-[10px] tracking-[0.06em]" style={{ color: color.chromeText, opacity: 0.7 }}>
        <span>SITE SAFETY PLATFORM · {footer[0]}</span>
        <span>{footer[1]}</span>
      </footer>
    </div>
  )
}

function Tab({ children, icon, to, active, soon }: { children: string; icon: ReactNode; to?: string; active?: boolean; soon?: boolean }) {
  const body = (
    <span
      className="flex h-12 w-52 items-center gap-3 rounded-md px-5 text-[15px] font-semibold"
      style={{ background: active ? color.accent : color.chromeSoft, color: active ? color.accentInk : color.chromeText, opacity: soon ? 0.5 : 1 }}
      title={soon ? 'Not designed yet' : undefined}
    >
      {icon}
      {children}
    </span>
  )
  return to && !active ? <Link to={`${to}${location.search.replace(/[?&](node|step)=[^&]*/g, '').replace(/^&/, '?')}`}>{body}</Link> : body
}
