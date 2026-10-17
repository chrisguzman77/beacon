import { useState } from 'react'
import { KeyRound, LoaderCircle, LogIn } from 'lucide-react'
import { approveSiteChange } from '@/sweet-treats/crewSession'
import type { CrewText } from '@/sweet-treats/crewText'
import { color, hazard } from '@/tokens'

// Changing site on a crew phone: a supervisor approves with the PIN, then the phone checks the
// person out of this beacon and goes back to picking a site.

type Props = { t: CrewText; site: string; token: () => Promise<string | null>; signIn: () => void; onApproved: () => void; onClose: () => void }

export default function ChangeSite({ t, site, token, signIn, onApproved, onClose }: Props) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<'' | 'wrong' | 'backend'>('')

  const approve = async () => {
    setBusy(true)
    setProblem('')
    const r = await approveSiteChange(pin, await token())
    setBusy(false)
    if (r.ok) return onApproved()
    setProblem(r.reason === 'backend' ? 'backend' : 'wrong')
    setPin('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" style={{ background: 'rgb(23 34 29 / 0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md animate-in rounded-lg p-5 duration-200 slide-in-from-bottom-4" style={{ background: color.surface, color: color.text }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t.changeTitle}>
        <h2 className="flex items-center gap-2 text-[22px] font-bold"><KeyRound className="size-6" style={{ color: color.accent }} /> {t.changeTitle}</h2>
        <p className="mt-1 text-[15px]" style={{ color: color.muted }}>{t.changeBody(site)}</p>

        <label className="mt-4 flex flex-col gap-1">
          <span className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: color.muted }}>{t.supervisorPin}</span>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && approve()}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            className="h-14 rounded-md px-4 text-center font-mono text-[28px] tracking-[0.6em] outline-none"
            style={{ background: color.bg, boxShadow: `inset 0 0 0 1.5px ${problem ? hazard.stopwork : color.border}` }}
          />
        </label>
        {problem === 'wrong' && <p className="mt-2 text-[15px] font-semibold" style={{ color: hazard.stopwork }}>{t.wrongPin}</p>}
        {problem === 'backend' && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[14px]" style={{ color: color.muted }}>{t.needsSupervisor}</p>
            <button onClick={signIn} className="flex h-11 items-center justify-center gap-2 rounded-md text-[15px] font-semibold" style={{ boxShadow: `inset 0 0 0 1.5px ${color.border}` }}>
              <LogIn className="size-4" /> {t.supervisorSignIn}
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="h-12 rounded-md text-[16px] font-semibold" style={{ boxShadow: `inset 0 0 0 1.5px ${color.border}` }}>{t.cancel}</button>
          <button onClick={approve} disabled={pin.length !== 4 || busy} className="flex h-12 items-center justify-center rounded-md text-[16px] font-bold disabled:opacity-40" style={{ background: color.accent, color: color.accentInk }}>
            {busy ? <LoaderCircle className="size-5 animate-spin" /> : t.approve}
          </button>
        </div>
      </div>
    </div>
  )
}
