import { NavLink } from 'react-router-dom'
import { color } from '@/tokens'

// Top level sections, MARSH tab style: amber when active. Keeps the query string (?fake=1).
const tabs = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/hub', label: 'Hub' },
]

export default function AppNav() {
  return (
    <nav className="flex gap-2">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={`${t.to}${location.search}`}
          className="rounded-md px-4 py-2 text-label font-semibold"
          style={({ isActive }) => ({
            background: isActive ? color.accent : color.surface,
            color: isActive ? color.accentInk : color.text,
            boxShadow: isActive ? undefined : `inset 0 0 0 1px ${color.border}`,
          })}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
