import { useEffect, useState } from 'react'
import { LoaderCircle, Lock, LogIn, LogOut, MoreVertical, Repeat, Scan } from 'lucide-react'
import { useDash } from '@/dashboard/store'
import { useAuth } from '@/lib/auth'
import { useTitle } from '@/lib/useTitle'
import { crewText, useCrewLang } from '@/sweet-treats/crewText'
import type { CrewText } from '@/sweet-treats/crewText'
import { checkOut, demoSignIn, forgetSite, loadSession, saveSession, signOutSession, useDemoSignIn } from '@/sweet-treats/crewSession'
import type { Session } from '@/sweet-treats/crewSession'
import Setup from '@/crew/Setup'
import SafetyHome from '@/crew/SafetyHome'
import ChangeSite from '@/crew/ChangeSite'
import { BigButton, LangSwitch } from '@/crew/parts'
import { color } from '@/tokens'

// The crew phone page (web guide section 8), as three steps:
//   1. sign in (Auth0, or a plain demo step when it is not configured)
//   2. who you are (crew directory) and where (the phone's location first), then connect to that beacon
//   3. the safety home for that one beacon: what it says, check in and out, conditions, hazard reports
// The phone stays on its beacon; changing site needs a supervisor and checks the person out first.
// ?site=12 (a QR code at the site) and &name= prefill step 2. ?fake=1 simulates everything.
// The flow and session logic are a sweet treat (sweet-treats/crewSession.ts); English or Spanish.

const query = new URLSearchParams(location.search)

export default function Crew() {
  const auth = useAuth()
  const { sites, status, connect } = useDash()
  const [lang, setLang] = useCrewLang()
  const t = crewText[lang]
  const [session, setSession] = useState<Session>(() => loadSession(query))
  const [demoSigned, demoIn, demoOut] = useDemoSignIn()
  const [connected, setConnected] = useState(false) // past step 2 this visit
  const [menu, setMenu] = useState(false)
  const [changing, setChanging] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  useEffect(() => connect(), [connect])

  const signedIn = demoSignIn ? demoSigned : auth.signedIn
  const site = sites.find((s) => s.site_id === session.siteId)
  // A QR link (?site=) always shows step 2 first so the person confirms who and where.
  const home = signedIn && site && session.name && (connected || !query.has('site'))
  useTitle(site && home ? `${t.crew} · ${site.name}` : t.crew)

  const leave = async () => {
    if (site && session.name && checkedIn) await checkOut(site.site_id, session.name, await auth.token())
  }
  const logOut = async () => {
    setMenu(false)
    await leave()
    signOutSession()
    setSession((s) => ({ siteId: 0, name: s.name }))
    if (demoSignIn) demoOut()
    else auth.signOut()
  }
  const switched = async () => {
    setChanging(false)
    await leave()
    forgetSite()
    setSession((s) => ({ siteId: 0, name: s.name }))
    setConnected(false)
  }

  return (
    <div className="min-h-dvh" style={{ background: color.bg, color: color.text }}>
      <header className="relative flex items-center justify-between gap-3 px-4 py-3" style={{ background: color.chrome, color: color.chromeText }}>
        <span className="flex shrink-0 items-center gap-2">
          <Scan className="size-5" style={{ color: color.accent }} strokeWidth={2.25} />
          <span className="text-[18px] font-bold tracking-tight">OmniRisk</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {home && (
            <span className="flex min-w-0 items-center gap-1 text-[13px] font-semibold">
              <Lock className="size-3.5 shrink-0 opacity-70" /> <span className="truncate">{site.name}</span>
            </span>
          )}
          <LangSwitch lang={lang} onChange={setLang} />
          {signedIn && (
            <button onClick={() => setMenu(!menu)} className="rounded-md p-1.5" aria-label="Menu" aria-expanded={menu}>
              <MoreVertical className="size-5" />
            </button>
          )}
        </span>
        {menu && (
          <div className="absolute top-full right-3 z-40 mt-1 w-56 animate-in overflow-hidden rounded-lg duration-150 fade-in" style={{ background: color.surface, color: color.text, boxShadow: '0 16px 36px rgb(0 0 0 / 0.25)' }}>
            {home && (
              <button onClick={() => (setMenu(false), setChanging(true))} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px]">
                <Repeat className="size-5" style={{ color: color.muted }} /> {t.changeSite}
              </button>
            )}
            <button onClick={logOut} className="flex w-full items-center gap-3 border-t px-4 py-3 text-left text-[15px]" style={{ borderColor: color.border }}>
              <LogOut className="size-5" style={{ color: color.muted }} /> {t.logOut}
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 p-4" onClick={() => menu && setMenu(false)}>
        {!demoSignIn && !auth.ready ? (
          <LoaderCircle className="mx-auto mt-16 size-8 animate-spin" style={{ color: color.muted }} />
        ) : !signedIn ? (
          <SignIn t={t} demo={demoSignIn} onSignIn={demoSignIn ? demoIn : auth.signIn} />
        ) : !home ? (
          <Setup
            t={t}
            sites={sites}
            failed={status === 'error'}
            initial={{ siteId: session.siteId, name: session.name || auth.name || '' }}
            onDone={(s) => {
              saveSession(s)
              setSession(s)
              setConnected(true)
            }}
          />
        ) : (
          <SafetyHome t={t} lang={lang} site={site} name={session.name} token={auth.token} onCheckedIn={setCheckedIn} />
        )}
      </main>

      {changing && site && <ChangeSite t={t} site={site.name} token={auth.token} signIn={auth.signIn} onApproved={switched} onClose={() => setChanging(false)} />}
    </div>
  )
}

function SignIn({ t, demo, onSignIn }: { t: CrewText; demo: boolean; onSignIn: () => void }) {
  return (
    <section className="mt-6 flex flex-col gap-4">
      <h1 className="text-[34px] leading-tight font-bold">{t.signInTitle}</h1>
      <p className="text-[16px]" style={{ color: color.muted }}>{demo ? t.signInDemoBody : t.signInBody}</p>
      <BigButton onClick={onSignIn} fill={color.accent} ink={color.accentInk} icon={<LogIn className="size-7" />}>{demo ? t.signInDemo : t.signIn}</BigButton>
    </section>
  )
}
