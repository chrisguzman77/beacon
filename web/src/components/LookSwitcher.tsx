import { color, lookId, looks } from '@/tokens'

// Compare the HUB looks: tech (original) and the MARSH style interpretations. Switching reloads
// the page with ?look=, which is also remembered in this browser.
const names: Record<string, string> = { tech: 'Tech', field: 'Field', night: 'Night', hybrid: 'Hybrid' }

export default function LookSwitcher({ onChrome }: { onChrome?: boolean }) {
  const go = (id: string) => {
    const q = new URLSearchParams(location.search)
    q.set('look', id)
    location.search = q.toString()
  }
  return (
    <div className="flex items-center gap-1 font-mono text-[11px] font-bold tracking-widest uppercase">
      <span className="mr-1" style={{ color: onChrome ? color.chromeText : color.muted, opacity: 0.7 }}>Look</span>
      {Object.keys(looks).map((id) => (
        <button
          key={id}
          onClick={() => go(id)}
          className="px-2 py-1"
          style={{
            background: id === lookId ? color.accent : 'transparent',
            color: id === lookId ? color.accentInk : onChrome ? color.chromeText : color.muted,
            boxShadow: `inset 0 0 0 1px ${id === lookId ? color.accent : onChrome ? 'rgb(255 255 255 / 0.2)' : color.border}`,
          }}
          aria-pressed={id === lookId}
        >
          {names[id] ?? id}
        </button>
      ))}
    </div>
  )
}
