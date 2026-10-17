import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { color } from '@/tokens'
import type { Lang } from '@/sweet-treats/crewText'

// Shared pieces of the crew phone screens: the big gloved-thumb button and the EN / ES switch.

export function BigButton({ children, icon, onClick, disabled, busy, fill, ink, edge }: { children: ReactNode; icon: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; fill: string; ink: string; edge?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-tap w-full items-center justify-center gap-3 rounded-md text-[20px] font-bold tracking-wide transition-transform active:scale-[0.98] disabled:opacity-40"
      style={{ background: fill, color: ink, boxShadow: `${edge ? `inset 0 0 0 2px ${edge}, ` : ''}0 6px 14px rgb(29 40 34 / 0.14)` }}
    >
      {busy ? <LoaderCircle className="size-7 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <span className="flex shrink-0 rounded-md p-0.5" style={{ background: color.chromeSoft }} role="group" aria-label="Language / Idioma">
      {(['en', 'es'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          className="rounded-[5px] px-2.5 py-1 text-[12px] font-bold uppercase"
          style={{ background: lang === l ? color.accent : 'transparent', color: lang === l ? color.accentInk : color.chromeText }}
        >
          {l}
        </button>
      ))}
    </span>
  )
}

export const sectionLabel = 'font-mono text-[11px] font-bold tracking-[0.12em] uppercase'
