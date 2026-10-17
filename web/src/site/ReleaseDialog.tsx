import { useEffect, useState } from 'react'
import { Delete, KeyRound, LoaderCircle, LogIn, X } from 'lucide-react'
import { post } from '@/api'
import { authOn, useAuth } from '@/lib/auth'
import { color, hazard } from '@/tokens'

// Supervisor release of a stop work: the same four digit PIN as the beacon's IR remote, sent to
// POST /alerts/{id}/clear with the supervisor's token and who released it. The alarm leaves when
// the backend broadcasts the cleared alert, not when this dialog closes. ?fake=1 accepts 1234.

type Props = { alertId?: number; site: string; onClose: () => void; onReleased?: () => void }

const fake = new URLSearchParams(location.search).has('fake')

export default function ReleaseDialog({ alertId, site, onClose, onReleased }: Props) {
  const auth = useAuth()
  const [pin, setPin] = useState('')
  const [by, setBy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const needSignIn = authOn && auth.ready && !auth.signedIn && !fake

  useEffect(() => {
    if (!by && auth.name) setBy(auth.name)
  }, [auth.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: string) => {
    setError('')
    if (k === 'del') return setPin((p) => p.slice(0, -1))
    if (pin.length < 4) setPin(pin + k)
  }

  const submit = async () => {
    if (pin.length !== 4) return setError('Enter all four digits')
    setBusy(true)
    setError('')
    try {
      if (fake) {
        await new Promise((r) => setTimeout(r, 600))
        if (pin !== '1234') throw new Error('Wrong PIN')
      } else {
        if (!alertId) throw new Error('No open alert to release')
        await post(`/alerts/${alertId}/clear`, { pin, by: by.trim() || 'Supervisor' }, await auth.token())
      }
      setDone(true)
      onReleased?.()
      setTimeout(onClose, 1400)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      setError(m === 'wrong PIN' ? 'Wrong PIN' : m === 'supervisor only' ? 'This login is not a supervisor' : m)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  // Keyboard: digits, Backspace, Enter, Escape.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') submit()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgb(23 34 29 / 0.6)' }} onClick={onClose}>
      <div className="w-full max-w-[360px] rounded-lg p-6" style={{ background: color.surface, color: color.text, boxShadow: '0 24px 60px rgb(0 0 0 / 0.35)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Supervisor release">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: color.muted }}>{site}</p>
            <h2 className="flex items-center gap-2 text-[24px] font-bold"><KeyRound className="size-6" style={{ color: color.accent }} /> Release stop work</h2>
          </div>
          <button onClick={onClose} className="rounded-sm p-1" style={{ color: color.muted }} aria-label="Close"><X className="size-6" /></button>
        </header>

        {needSignIn ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px]" style={{ color: color.muted }}>Only a supervisor can release stop work. Sign in first.</p>
            <button onClick={auth.signIn} className="flex h-14 items-center justify-center gap-2 rounded-md text-[17px] font-bold" style={{ background: color.accent, color: color.accentInk }}>
              <LogIn className="size-5" /> Sign in
            </button>
          </div>
        ) : done ? (
          <p className="py-8 text-center text-[20px] font-bold" style={{ color: color.signal }}>Released. Equipment power is restored.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-center gap-3" aria-label={`${pin.length} of 4 digits`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="flex size-14 items-center justify-center rounded-md text-[28px] font-bold" style={{ background: color.bg, boxShadow: `inset 0 0 0 2px ${error ? hazard.stopwork : i === pin.length ? color.accent : color.border}` }}>
                  {pin[i] ? '•' : ''}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <Key key={k} onClick={() => press(k)}>{k}</Key>)}
              <Key onClick={() => press('del')} label="Delete"><Delete className="size-6" /></Key>
              <Key onClick={() => press('0')}>0</Key>
              <button onClick={submit} disabled={busy} className="flex h-14 items-center justify-center rounded-md text-[18px] font-bold disabled:opacity-60" style={{ background: color.accent, color: color.accentInk }}>
                {busy ? <LoaderCircle className="size-6 animate-spin" /> : 'OK'}
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: color.muted }}>Released by (shown on the beacon)</span>
              <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" className="h-11 rounded-md px-3 text-[15px] outline-none" style={{ background: color.bg, boxShadow: `inset 0 0 0 1.5px ${color.border}` }} />
            </label>
            {error && <p className="text-center text-[15px] font-semibold" style={{ color: hazard.stopwork }}>{error}</p>}
            {fake && <p className="text-center font-mono text-[10px] tracking-wider uppercase" style={{ color: color.muted }}>Demo: PIN 1234</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function Key({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="flex h-14 items-center justify-center rounded-md text-[22px] font-semibold transition-transform active:scale-95" style={{ background: color.bg, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
      {children}
    </button>
  )
}
