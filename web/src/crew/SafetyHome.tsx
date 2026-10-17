import { useEffect, useRef, useState } from 'react'
import { Camera, Check, LogIn, LogOut, OctagonAlert, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { post } from '@/api'
import type { SiteRow } from '@/api'
import { formatCountdown, useSite } from '@/site/store'
import { isTakeover } from '@/site/types'
import { buildFactors } from '@/site/factors'
import type { Factor } from '@/site/factors'
import { useSlow } from '@/lib/useSlow'
import { reasonIn } from '@/sweet-treats/crewText'
import type { CrewText, Lang } from '@/sweet-treats/crewText'
import { color, hazard } from '@/tokens'
import { BigButton, sectionLabel } from './parts'

// Page 3 of the crew phone, the safety home for the one beacon the phone is connected to: what the
// beacon is saying, your check in, the conditions that matter for your safety in the Field View
// style (each card backlit in its condition color; tap one for what to do), and hazard reports.

const fake = new URLSearchParams(location.search).has('fake')

// The conditions a crew member acts on; the rest stays on the supervisor's HUB.
const SAFETY = ['lightning', 'heat', 'wind', 'rain', 'water', 'flood', 'wildlife', 'equipment', 'tilt', 'zone']
const rank: Record<string, number> = { danger: 0, caution: 1, ok: 2, info: 3 }

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

type Props = { t: CrewText; lang: Lang; site: SiteRow; name: string; token: () => Promise<string | null>; onCheckedIn: (v: boolean) => void }

export default function SafetyHome({ t, lang, site, name, token, onCheckedIn }: Props) {
  const snapshot = useSite((s) => s.snapshot)
  const connect = useSite((s) => s.connect)
  useEffect(() => connect(site.site_id), [connect, site.site_id])

  const s = snapshot?.site.id === site.site_id ? snapshot : null
  const lost = useSlow(!s, 8000, site.site_id)
  const [fakeIn, setFakeIn] = useState(false)
  const [busy, setBusy] = useState<'in' | 'out' | null>(null)
  const [error, setError] = useState('')
  const [since, setSince] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const checkedIn = fake ? fakeIn : !!s?.crew.some((c) => c.in && c.name.toLowerCase() === name.toLowerCase())
  const stop = !!s && (isTakeover(s) || s.alert_type === 'stopwork')
  useEffect(() => onCheckedIn(checkedIn), [checkedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const conditions = s ? buildFactors(s).filter((f) => SAFETY.includes(f.id)).sort((a, b) => rank[a.status] - rank[b.status]) : []
  const picked = conditions.find((f) => f.id === open)

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
      {/* What the beacon is saying right now. */}
      {stop ? (
        <section className="flex items-center gap-3 rounded-md px-4 py-4" style={{ background: hazard.stopwork, color: '#fff' }}>
          <OctagonAlert className="size-9 shrink-0" />
          <span className="min-w-0 flex-1">
            <b className="block text-[24px] leading-tight">{t.stopWork}</b>
            <span className="block text-[14px] opacity-90">{s.reason ? `${reasonIn(s.reason, lang)} · ` : ''}{t.leaveZone}</span>
          </span>
          {s.countdown > 0 && <span className="font-mono text-[26px] font-bold">{formatCountdown(s.countdown)}</span>}
        </section>
      ) : s?.alert_type ? (
        <section className="flex items-center gap-3 rounded-md px-4 py-3" style={{ background: color.accentPale, borderLeft: `4px solid ${color.text}` }}>
          <TriangleAlert className="size-6 shrink-0" />
          <span className="text-[15px] font-semibold">{reasonIn(s.reason, lang)}</span>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-md px-4 py-3" style={{ background: color.raised }}>
          <ShieldCheck className="size-6 shrink-0" style={{ color: color.signal }} />
          <span className="flex-1 text-[15px] font-semibold">{s ? t.allClear : lost ? t.notConnected : t.connecting}</span>
          {!s && lost && <button onClick={() => location.reload()} className="text-[14px] font-semibold underline">{t.retry}</button>}
        </section>
      )}

      {/* You */}
      <section className="flex flex-col gap-3 rounded-md p-4" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
        <div>
          <p className={sectionLabel} style={{ color: color.muted }}>{name}</p>
          <p className="mt-1 flex items-center gap-2 text-[24px] font-bold">
            <span className="size-3 rounded-full" style={{ background: checkedIn ? color.signal : color.muted }} />
            {checkedIn ? t.onSite : t.offSite}
          </p>
          <p className="text-[14px]" style={{ color: color.muted }}>{checkedIn ? (since ? t.checkedInAt(since) : t.checkedIn) : t.checkInHint}</p>
        </div>
        {checkedIn ? (
          <BigButton onClick={() => checkin('out')} disabled={!!busy} busy={busy === 'out'} fill={color.chrome} ink={color.chromeText} icon={<LogOut className="size-7" />}>{t.imLeaving}</BigButton>
        ) : (
          <BigButton onClick={() => checkin('in')} disabled={!!busy} busy={busy === 'in'} fill={color.accent} ink={color.accentInk} icon={<LogIn className="size-7" />}>{t.imOn}</BigButton>
        )}
        {error && <p className="rounded-md px-4 py-3 text-[15px]" style={{ background: `color-mix(in srgb, ${hazard.stopwork} 12%, ${color.surface})`, color: hazard.stopwork }}>{error}</p>}
      </section>

      {/* Conditions that matter for your safety */}
      {conditions.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className={sectionLabel} style={{ color: color.muted }}>{t.conditions}</span>
            <span className="text-[12px]" style={{ color: color.muted }}>{t.tapCondition}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {conditions.map((f) => <Tile key={f.id} f={f} t={t} on={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)} />)}
          </div>
          {picked && (
            <p className="animate-in rounded-md p-4 text-[15px] leading-snug duration-200 fade-in" style={{ background: color.surface, borderLeft: `4px solid ${picked.tint ?? color.muted}`, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
              <b className="mb-1 block">{t.factor[picked.id] ?? picked.label}</b>
              {picked.guide}
            </p>
          )}
        </section>
      )}

      <Report t={t} site={site} token={token} />
    </>
  )
}

// A condition card in the Field View style: name, value and status, backlit in its condition color.
function Tile({ f, t, on, onClick }: { f: Factor; t: CrewText; on: boolean; onClick: () => void }) {
  const hot = f.status === 'danger' || f.status === 'caution'
  const tint = hot ? (f.tint ?? color.muted) : f.status === 'ok' ? color.signal : color.border
  return (
    <button onClick={onClick} className="relative rounded-lg text-left" aria-expanded={on}>
      {hot && <span className={`pointer-events-none absolute -inset-1.5 rounded-xl ${f.status === 'danger' ? 'animate-beacon-pulse' : ''}`} style={{ background: tint, opacity: 0.35, filter: 'blur(10px)' }} />}
      <span
        className="relative flex h-full flex-col gap-1 rounded-lg px-3 py-3"
        style={{ background: hot ? `color-mix(in srgb, ${tint} 10%, ${color.surface})` : color.surface, boxShadow: `inset 0 0 0 ${on || hot ? 2 : 1}px ${on ? color.accent : tint}` }}
      >
        <span className="text-[13px]" style={{ color: color.muted }}>{t.factor[f.id] ?? f.label}</span>
        <span className="text-[22px] leading-tight font-semibold">{f.value}</span>
        {t.status[f.status] && (
          <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: hot ? tint : color.signal }}>
            {hot ? <TriangleAlert className="size-3.5" /> : <Check className="size-3.5" strokeWidth={3} />} {t.status[f.status]}
          </span>
        )}
      </span>
    </button>
  )
}

type Tag = { tag: string; description: string; confidence: number }

function Report({ t, site, token }: { t: CrewText; site: SiteRow; token: () => Promise<string | null> }) {
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
        <BigButton onClick={() => input.current?.click()} fill={color.surface} ink={color.text} edge={color.text} icon={<Camera className="size-7" />}>{t.reportHazard}</BigButton>
      ) : (
        <div className="flex flex-col gap-3 rounded-md p-3" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
          <div className="relative">
            <img src={preview} alt={t.photoAlt} className="max-h-[40dvh] w-full rounded-sm object-cover" />
            {!busy && (
              <button onClick={reset} className="absolute top-2 right-2 rounded-full p-2" style={{ background: color.chrome, color: color.chromeText }} aria-label={t.discard}>
                <X className="size-5" />
              </button>
            )}
          </div>
          {result ? (
            <div className="flex flex-col gap-2 rounded-sm p-3" style={{ background: color.raised }}>
              <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.04em] uppercase" style={{ color: color.signal }}>
                <Check className="size-4" strokeWidth={3} /> {t.saved}
              </p>
              <p className="text-[22px] leading-tight font-bold capitalize">{result.tag.replace(/_/g, ' ')}</p>
              <p className="text-[15px] leading-snug">{result.description}</p>
              <p className="font-mono text-[11px] uppercase" style={{ color: color.muted }}>{t.sure(Math.round(result.confidence * 100))}</p>
              <BigButton onClick={reset} fill={color.accent} ink={color.accentInk} icon={<Camera className="size-7" />}>{t.another}</BigButton>
            </div>
          ) : (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.note}
                rows={2}
                className="rounded-md px-4 py-3 text-[16px] outline-none"
                style={{ background: color.bg, boxShadow: `inset 0 0 0 1.5px ${color.border}` }}
              />
              <BigButton onClick={send} disabled={busy} busy={busy} fill={color.accent} ink={color.accentInk} icon={<TriangleAlert className="size-7" />}>
                {busy ? t.sending : t.send}
              </BigButton>
            </>
          )}
          {error && <p className="text-[15px]" style={{ color: hazard.stopwork }}>{error}</p>}
        </div>
      )}
    </section>
  )
}
