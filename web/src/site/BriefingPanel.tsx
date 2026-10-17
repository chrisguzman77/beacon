import { useEffect, useState } from 'react'
import { Play, RefreshCw, Square } from 'lucide-react'
import { cut } from '@/components/Panel'
import Fold from '@/components/Fold'
import { color } from '@/tokens'
import type { Snapshot } from './types'

// Draft (Cam: language toggle). Tomorrow's briefing in one language at a time, the numbers
// behind it, Play (browser speech in the shown language) and Run now (supervisor only).

type Lang = 'en' | 'es'
const KEY = 'beacon.briefing.lang'

function savedLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'es' ? 'es' : 'en'
  } catch {
    return 'en'
  }
}

const label = (k: string) => k.replace(/_/g, ' ').replace(/\b(f|mph|in|pct)\b/gi, (u) => u.toUpperCase())

export default function BriefingPanel({ s }: { s: Snapshot }) {
  const [lang, setLang] = useState<Lang>(savedLang)
  const [speaking, setSpeaking] = useState(false)
  const b = s.briefing
  const text = lang === 'en' ? b.english : b.spanish
  const fake = new URLSearchParams(location.search).has('fake')
  const date = b.for_date ? new Date(`${b.for_date}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''

  useEffect(() => () => speechSynthesis.cancel(), [])

  const choose = (l: Lang) => {
    setLang(l)
    speechSynthesis.cancel()
    setSpeaking(false)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      /* remembered for this visit only */
    }
  }

  const play = () => {
    if (speaking) {
      speechSynthesis.cancel()
      return setSpeaking(false)
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'en' ? 'en-US' : 'es-US'
    u.onend = () => setSpeaking(false)
    speechSynthesis.speak(u)
    setSpeaking(true)
  }

  return (
    <Fold id="hub.briefing" title="Briefing" summary={date || 'NOT YET'}>
     <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <p className="text-label text-dim">{date ? `${lang === 'en' ? 'For' : 'Para'} ${date}` : ''}</p>
        <div className="flex" role="group" aria-label="Language">
          {(['en', 'es'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => choose(l)}
              className="px-3 py-1 font-mono text-label font-bold tracking-wider uppercase"
              style={{ color: lang === l ? color.bg : color.muted, background: lang === l ? color.signal : 'transparent', boxShadow: `inset 0 0 0 1px ${lang === l ? color.signal : color.border}` }}
              aria-pressed={lang === l}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      {text ? (
        <p className="text-body leading-snug">{text}</p>
      ) : (
        <p className="text-label text-dim">
          Tomorrow's briefing has not been generated yet. It runs at {s.next_briefing} site time, or a supervisor can press Run now.
        </p>
      )}

      {b.payload && (
        <dl className="flex flex-wrap gap-2">
          {Object.entries(b.payload).slice(0, 4).map(([k, v]) => (
            <div key={k} className="px-2 py-1" style={{ boxShadow: `inset 0 0 0 1px ${color.border}` }}>
              <dt className="font-mono text-[10px] font-bold tracking-widest text-dim uppercase">{label(k)}</dt>
              <dd className="font-mono text-label font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex gap-2">
        <Action onClick={play} disabled={!text} icon={speaking ? <Square className="size-4" /> : <Play className="size-4" />}>
          {speaking ? 'Stop' : 'Play'}
        </Action>
        <Action
          disabled={fake || !import.meta.env.VITE_AUTH0_DOMAIN}
          title={fake ? 'Demo data: Run now is not sent' : 'Needs supervisor login'}
          icon={<RefreshCw className="size-4" />}
        >
          Run now
        </Action>
      </div>
     </div>
    </Fold>
  )
}

function Action({ children, icon, onClick, disabled, title }: { children: string; icon: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className="flex-1 p-[2px] disabled:opacity-40" style={{ clipPath: cut(10), background: color.border }}>
      <span className="flex items-center justify-center gap-2 px-3 py-2 font-mono text-label font-bold tracking-[0.14em] uppercase" style={{ clipPath: cut(9), background: color.raised }}>
        <span className="text-signal">{icon}</span>
        {children}
      </span>
    </button>
  )
}
