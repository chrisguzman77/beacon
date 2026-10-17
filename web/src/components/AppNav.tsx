import { NavLink } from 'react-router-dom'
import { cut } from '@/components/Panel'
import { color } from '@/tokens'

// Top level sections. Keeps the current query string (?fake=1) when switching.
const tabs = [
  { to: '/dashboard', label: 'Dashboard', code: '01' },
  { to: '/hub', label: 'Hub', code: '02' },
]

export default function AppNav() {
  return (
    <nav className="flex gap-2">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={`${t.to}${location.search}`}
          className="p-[2px]"
          style={({ isActive }) => ({ clipPath: cut(10), background: isActive ? color.signal : color.border })}
        >
          {({ isActive }) => (
            <span
              className="flex items-center gap-2 px-4 py-2 font-mono text-label font-bold tracking-[0.18em] uppercase"
              style={{ clipPath: cut(9), background: isActive ? `color-mix(in srgb, ${color.signal} 16%, ${color.bg})` : color.surface, color: isActive ? color.signal : color.muted }}
            >
              <span className="text-[10px] opacity-70">{t.code}</span>
              {t.label}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
