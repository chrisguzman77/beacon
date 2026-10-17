import { useEffect, useState } from 'react'
import { LoaderCircle, Play, RefreshCw, Square } from 'lucide-react'
import { post } from '@/api'
import { useAuth } from '@/lib/auth'
import Fold from '@/components/Fold'
import { Button, label as labelCls, Segmented } from '@/components/marsh'
import { color, hazard } from '@/tokens'
import type { Snapshot } from './types'

// Draft (Cam: language toggle). Tomorrow's briefing in one language at a time, the numbers
// behind it, Play (browser speech in the shown language) and Run now: POST /briefings/{site_id}/run
// (bearer token when signed in; the route is open for now), 5 to 30 s of Gemini plus the number guard,
// then the returned text shows straight away.

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
  const auth = useAuth()
  const [fresh, setFresh] = useState<Partial<Snapshot['briefing']> & { source?: string }>({})
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const b = { ...s.briefing, ...fresh }
  const text = lang === 'en' ? b.english : b.spanish
  const fake = new URLSearchParams(location.search).has('fake')

  const run = async () => {
    setRunning(true)
    setError('')
    try {
      if (fake) {
        await new Promise((r) => setTimeout(r, 2500))
        setFresh({ english: `Fresh demo briefing for ${s.site.name}: hot afternoon, water and shade every hour, storms possible after 2 PM.`, spanish: `Nuevo informe de prueba para ${s.site.name}: tarde calurosa, agua y sombra cada hora, posibles tormentas después de las 2 PM.`, source: 'demo' })
      } else {
        const r = await post<{ english: string; spanish: string; source?: string; for_date?: string; payload?: Snapshot['briefing']['payload'] }>(`/briefings/${s.site.id}/run`, {}, await auth.token())
        setFresh(r)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }
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
    <Fold id="hub.briefing" title="Briefing" summary={date || 'Not yet'}>
     <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <p className="text-label text-dim">{date ? `${lang === 'en' ? 'For' : 'Para'} ${date}` : ''}</p>
        <Segmented<Lang> label="Language" value={lang} onChange={choose} options={[{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }]} />
      </header>

      {text ? (
        <p className="text-[15px] leading-relaxed">{text}</p>
      ) : (
        <p className="text-label text-dim">
          Tomorrow's briefing has not been generated yet. It runs at {s.next_briefing} site time, or a supervisor can press Run now.
        </p>
      )}

      {b.payload && (
        <dl className="flex flex-wrap gap-2">
          {Object.entries(b.payload).slice(0, 4).map(([k, v]) => (
            <div key={k} className="rounded-md px-3 py-1.5" style={{ background: color.bg }}>
              <dt className={labelCls} style={{ color: color.muted }}>{label(k)}</dt>
              <dd className="text-[14px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={play} disabled={!text} icon={speaking ? <Square className="size-4" /> : <Play className="size-4" />}>
          {speaking ? 'Stop' : 'Play'}
        </Button>
        <Button
          primary
          className="flex-1"
          onClick={run}
          disabled={running}
          title={fake ? 'Demo data: simulated, nothing is sent' : 'Generate tomorrow’s briefing now (5 to 30 s)'}
          icon={running ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        >
          {running ? 'Writing…' : 'Run now'}
        </Button>
      </div>
      {running && <p className="text-label text-dim">Writing tomorrow’s briefing in English and Spanish. This takes up to 30 seconds.</p>}
      {fresh.source && !running && <p className="text-[12px] text-dim">Just generated · {fresh.source === 'gemini' ? 'AI written, numbers checked' : fresh.source}</p>}
      {error && <p className="text-label" style={{ color: hazard.stopwork }}>Run now failed: {error}</p>}
     </div>
    </Fold>
  )
}
