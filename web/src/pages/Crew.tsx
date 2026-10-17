import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Camera, Check, ChevronDown, LoaderCircle, LogIn, LogOut, MapPin, OctagonAlert, Scan, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { post } from '@/api'
import type { SiteRow } from '@/api'
import { useDash } from '@/dashboard/store'
import { formatCountdown, useSite } from '@/site/store'
import { isTakeover } from '@/site/types'
import { authOn, useAuth } from '@/lib/auth'
import { useSlow } from '@/lib/useSlow'
import { useTitle } from '@/lib/useTitle'
import { miles, useDeviceLocation } from '@/sweet-treats/useDeviceLocation'
import { color, hazard } from '@/tokens'

// The crew phone page (web guide section 8). Site and name are picked once and remembered on the
// phone. A status strip mirrors the site's alerts, I'M ON SITE / I'M LEAVING post /checkin with the
// phone's GPS, and REPORT HAZARD takes a photo, shrinks it to 1600 px and posts /reports, then shows
// the AI tag for confirmation. ?site=12 (a QR code at the site) picks the site, &name= the name.
// ?fake=1 simulates check in and reports with no login.

const SITE_KEY = 'omnirisk.crew.site'
const NAME_KEY = 'omnirisk.crew.name'
const query = new URLSearchParams(location.search)
const fake = query.has('fake')

function load(key: string) {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* remembered for this visit only */
  }
}

// The phone's position right now, or nulls if it is refused or slow.
function gps(): Promise<{ lat: number | null; lon: number | null }> {
  return new Promise((done) => {
    if (!('geolocation' in navigator)) return done({ lat: null, lon: null })
    navigator.geolocation.getCurrentPosition(
      (p) => done({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => done({ lat: null, lon: null }),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30_000 },
    )
  })
}

// A 12 MP photo shrunk to 1600 px on the long side as JPEG, so it uploads fast on hotspot Wi-Fi.
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, 1600 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return new Promise((done) => c.toBlob((b) => done(b ?? file), 'image/jpeg', 0.82))
}

type Tag = { tag: string; description: string; confidence: number }

export default function Crew() {
  const auth = useAuth()
  const { sites, status, connect: connectSites } = useDash()
  const [siteId, setSiteId] = useState(() => Number(query.get('site') ?? load(SITE_KEY)) || 0)
  const [name, setName] = useState(() => query.get('name') ?? load(NAME_KEY))
  const [picking, setPicking] = useState(false)
  useEffect(() => connectSites(), [connectSites])

  const site = sites.find((s) => s.site_id === siteId)
  const ready = site && name.trim()
  const needSignIn = authOn && auth.ready && !auth.signedIn && !fake
  useTitle(site ? `Crew · ${site.name}` : 'Crew')

  useEffect(() => {
    if (!name && auth.name) setName(auth.name)
  }, [auth.name]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh" style={{ background: color.bg, color: color.text }}>
      <header className="flex items-center justify-between px-4 py-3" style={{ background: color.chrome, color: color.chromeText }}>
        <span className="flex items-center gap-2">
          <Scan className="size-5" style={{ color: color.accent }} strokeWidth={2.25} />
          <span className="text-[18px] font-bold tracking-tight">OmniRisk</span>
          <span className="font-mono text-[11px] opacity-70">/ CREW</span>
        </span>
        {ready && (
          <button onClick={() => setPicking(true)} className="flex max-w-[55%] items-center gap-1 text-[13px] font-semibold">
            <span className="truncate">{site.name}</span> <ChevronDown className="size-4 shrink-0" />
          </button>
        )}
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
        {needSignIn ? (
          <SignIn onSignIn={auth.signIn} />
        ) : !ready || picking ? (
          <Setup
            sites={sites}
            failed={status === 'error'}
            siteId={siteId}
            name={name}
            onDone={(id, n) => {
              setSiteId(id)
              setName(n)
              save(SITE_KEY, String(id))
              save(NAME_KEY, n)
              setPicking(false)
            }}
          />
        ) : (
          <OnSite site={site} name={name.trim()} token={auth.token} />
        )}
      </main>
    </div>
  )
}

function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="mt-6 flex flex-col gap-4">
      <h1 className="text-[34px] leading-tight font-bold">Crew sign in</h1>
      <p className="text-[16px]" style={{ color: color.muted }}>Sign in once and this phone remembers you.</p>
      <BigButton onClick={onSignIn} fill={color.accent} ink={color.accentInk} icon={<LogIn className="size-7" />}>Sign in</BigButton>
    </section>
  )
}

function Setup({ sites, failed, siteId, name, onDone }: { sites: SiteRow[]; failed: boolean; siteId: number; name: string; onDone: (id: number, name: string) => void }) {
  const here = useDeviceLocation()
  const [n, setN] = useState(name)
  const [id, setId] = useState(siteId)
  // Nearest first once the phone shares its location; the beacon site leads until then.
  const list = [...sites].sort((a, b) => (here ? miles(here, a) - miles(here, b) : Number(b.beacon) - Number(a.beacon) || a.name.localeCompare(b.name)))

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[30px] leading-tight font-bold">Your site</h1>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: color.muted }}>Your name</span>
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          placeholder="First name"
          autoComplete="given-name"
          className="h-14 rounded-md px-4 text-[18px] outline-none"
          style={{ background: color.surface, boxShadow: `inset 0 0 0 1.5px ${color.border}` }}
        />
      </label>
      <span className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: color.muted }}>{here ? 'Nearest sites first' : 'Pick your site'}</span>
      <ul className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
        {!sites.length && (
          <li className="flex items-center justify-between gap-3 text-[15px]" style={{ color: failed ? hazard.stopwork : color.muted }}>
            {failed ? 'The site list did not load. Check the signal.' : 'Loading sites…'}
            {failed && <button onClick={() => location.reload()} className="font-semibold underline">Retry</button>}
          </li>
        )}
        {list.map((s) => (
          <li key={s.site_id}>
            <button
              onClick={() => setId(s.site_id)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left"
              style={{ background: id === s.site_id ? color.accentPale : color.surface, boxShadow: `inset 0 0 0 ${id === s.site_id ? 2 : 1}px ${id === s.site_id ? color.accent : color.border}` }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-semibold">{s.name}</span>
                <span className="block text-[13px]" style={{ color: color.muted }}>
                  {s.county}, {s.state}{here ? ` · ${Math.round(miles(here, s))} mi` : ''}
                </span>
              </span>
              {id === s.site_id && <Check className="size-6 shrink-0" style={{ color: color.signal }} strokeWidth={3} />}
            </button>
          </li>
        ))}
      </ul>
      <BigButton disabled={!id || !n.trim()} onClick={() => onDone(id, n.trim())} fill={color.accent} ink={color.accentInk} icon={<MapPin className="size-7" />}>
        Use this site
      </BigButton>
    </section>
  )
}

function OnSite({ site, name, token }: { site: SiteRow; name: string; token: () => Promise<string | null> }) {
  const snapshot = useSite((s) => s.snapshot)
  const connect = useSite((s) => s.connect)
  useEffect(() => connect(site.site_id), [connect, site.site_id])

  const s = snapshot?.site.id === site.site_id ? snapshot : null
  const lost = useSlow(!s, 8000, site.site_id)
  const [fakeIn, setFakeIn] = useState(false)
  const [busy, setBusy] = useState<'in' | 'out' | null>(null)
  const [error, setError] = useState('')
  const [since, setSince] = useState<string>('')
  const checkedIn = fake ? fakeIn : !!s?.crew.some((c) => c.in && c.name.toLowerCase() === name.toLowerCase())
  const stop = !!s && (isTakeover(s) || s.alert_type === 'stopwork')

  const checkin = async (action: 'in' | 'out') => {
    setBusy(action)
    setError('')
    try {
      if (fake) await new Promise((r) => setTimeout(r, 700))
      else await post('/checkin', { site_id: site.site_id, action, via: 'phone', name, ...(await gps()) }, await token())
      if (fake) setFakeIn(action === 'in')
      setSince(action === 'in' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
      navigator.vibrate?.(60)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {/* Status strip: what the site's beacon is saying right now. */}
      {stop ? (
        <section className="flex items-center gap-3 rounded-md px-4 py-4" style={{ background: hazard.stopwork, color: '#fff' }}>
          <OctagonAlert className="size-9 shrink-0" />
          <span className="min-w-0 flex-1">
            <b className="block text-[24px] leading-tight">STOP WORK</b>
            <span className="block text-[14px] opacity-90">
              {s.reason ? `${s.reason.toLowerCase().replace(/^./, (c) => c.toUpperCase())} · ` : ''}Leave the work zone now
            </span>
          </span>
          {s.countdown > 0 && <span className="font-mono text-[26px] font-bold">{formatCountdown(s.countdown)}</span>}
        </section>
      ) : s?.alert_type ? (
        <section className="flex items-center gap-3 rounded-md px-4 py-3" style={{ background: color.accentPale, borderLeft: `4px solid ${color.text}` }}>
          <TriangleAlert className="size-6 shrink-0" />
          <span className="text-[15px] font-semibold">{s.reason.toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-md px-4 py-3" style={{ background: color.raised }}>
          <ShieldCheck className="size-6 shrink-0" style={{ color: color.signal }} />
          <span className="flex-1 text-[15px] font-semibold">{s ? 'All clear on site' : lost ? 'Not connected to the site yet' : 'Connecting to the site…'}</span>
          {!s && lost && <button onClick={() => location.reload()} className="text-[14px] font-semibold underline">Retry</button>}
        </section>
      )}

      <section className="rounded-md p-4" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
        <p className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: color.muted }}>{name}</p>
        <p className="mt-1 flex items-center gap-2 text-[24px] font-bold">
          <span className="size-3 rounded-full" style={{ background: checkedIn ? color.signal : color.muted }} />
          {checkedIn ? 'On site' : 'Off site'}
        </p>
        <p className="text-[14px]" style={{ color: color.muted }}>
          {checkedIn ? (since ? `Checked in at ${since}` : 'Checked in') : 'Check in when you arrive so the beacon counts you'}
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <BigButton onClick={() => checkin('in')} disabled={!!busy || checkedIn} busy={busy === 'in'} fill={color.accent} ink={color.accentInk} icon={<LogIn className="size-7" />}>
          I'M ON SITE
        </BigButton>
        <BigButton onClick={() => checkin('out')} disabled={!!busy || !checkedIn} busy={busy === 'out'} fill={color.chrome} ink={color.chromeText} icon={<LogOut className="size-7" />}>
          I'M LEAVING
        </BigButton>
        {error && <p className="rounded-md px-4 py-3 text-[15px]" style={{ background: `color-mix(in srgb, ${hazard.stopwork} 12%, ${color.surface})`, color: hazard.stopwork }}>{error}</p>}
      </div>

      <Report site={site} token={token} />
    </>
  )
}

function Report({ site, token }: { site: SiteRow; token: () => Promise<string | null> }) {
  const input = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Tag | null>(null)
  const [error, setError] = useState('')

  const pick = (f?: File) => {
    if (!f) return
    setPhoto(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }
  const reset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPhoto(null)
    setPreview('')
    setNote('')
    setResult(null)
    setError('')
  }
  const send = async () => {
    if (!photo) return
    setBusy(true)
    setError('')
    try {
      if (fake) {
        await new Promise((r) => setTimeout(r, 1500))
        setResult({ tag: 'alligator', description: 'An alligator resting near standing water at the edge of the work area.', confidence: 0.91 })
      } else {
        const [img, at] = await Promise.all([shrink(photo), gps()])
        const form = new FormData()
        form.append('photo', img, 'hazard.jpg')
        form.append('site_id', String(site.site_id))
        if (at.lat !== null) form.append('lat', String(at.lat))
        if (at.lon !== null) form.append('lon', String(at.lon))
        form.append('note', note)
        setResult(await post<Tag>('/reports', form, await token()))
      }
      navigator.vibrate?.(60)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {!photo ? (
        <BigButton onClick={() => input.current?.click()} fill={color.surface} ink={color.text} edge={color.text} icon={<Camera className="size-7" />}>
          REPORT HAZARD
        </BigButton>
      ) : (
        <div className="flex flex-col gap-3 rounded-md p-3" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
          <div className="relative">
            <img src={preview} alt="The hazard photo" className="max-h-[40dvh] w-full rounded-sm object-cover" />
            {!busy && (
              <button onClick={reset} className="absolute top-2 right-2 rounded-full p-2" style={{ background: color.chrome, color: color.chromeText }} aria-label="Discard photo">
                <X className="size-5" />
              </button>
            )}
          </div>
          {result ? (
            <div className="flex flex-col gap-2 rounded-sm p-3" style={{ background: color.raised }}>
              <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.04em] uppercase" style={{ color: color.signal }}>
                <Check className="size-4" strokeWidth={3} /> Saved and pinned to the site
              </p>
              <p className="text-[22px] leading-tight font-bold capitalize">{result.tag}</p>
              <p className="text-[15px] leading-snug">{result.description}</p>
              <p className="font-mono text-[11px]" style={{ color: color.muted }}>{Math.round(result.confidence * 100)}% SURE</p>
              <BigButton onClick={reset} fill={color.accent} ink={color.accentInk} icon={<Camera className="size-7" />}>Report another</BigButton>
            </div>
          ) : (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                rows={2}
                className="rounded-md px-4 py-3 text-[16px] outline-none"
                style={{ background: color.bg, boxShadow: `inset 0 0 0 1.5px ${color.border}` }}
              />
              <BigButton onClick={send} disabled={busy} busy={busy} fill={color.accent} ink={color.accentInk} icon={<TriangleAlert className="size-7" />}>
                {busy ? 'Sending…' : 'SEND REPORT'}
              </BigButton>
            </>
          )}
          {error && <p className="text-[15px]" style={{ color: hazard.stopwork }}>{error}</p>}
        </div>
      )}
    </section>
  )
}

function BigButton({ children, icon, onClick, disabled, busy, fill, ink, edge }: { children: ReactNode; icon: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; fill: string; ink: string; edge?: string }) {
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
