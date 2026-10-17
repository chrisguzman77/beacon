import { useEffect, useState } from 'react'
import { get, post } from '@/api'
import { authOn } from '@/lib/auth'

// The crew phone's session, off roadmap (Cam): signed in, who the person is and the one site
// (beacon) the phone is connected to, all kept on the phone. A crew directory so people find their
// own name instead of typing it. Changing site needs a supervisor and checks the person out first.

const fake = new URLSearchParams(location.search).has('fake')
const SITE_KEY = 'omnirisk.crew.site'
const NAME_KEY = 'omnirisk.crew.name'
const NAMES_KEY = 'omnirisk.crew.names' // everyone who has used this phone
const SIGNED_KEY = 'omnirisk.crew.signed' // demo sign in when Auth0 is not configured

function read(key: string) {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
function write(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key)
    else localStorage.setItem(key, v)
  } catch {
    /* remembered for this visit only */
  }
}

// Sign in when Auth0 is off (no keys, or ?fake): a plain step so the flow is the same everywhere.
export const demoSignIn = !authOn || fake
export function useDemoSignIn(): [boolean, () => void, () => void] {
  const [signed, setSigned] = useState(() => read(SIGNED_KEY) === '1')
  return [signed, () => (write(SIGNED_KEY, '1'), setSigned(true)), () => (write(SIGNED_KEY, null), setSigned(false))]
}

export type Session = { siteId: number; name: string }

export function loadSession(query: URLSearchParams): Session {
  return { siteId: Number(query.get('site') ?? read(SITE_KEY)) || 0, name: query.get('name') ?? read(NAME_KEY) }
}

export function saveSession(s: Session) {
  write(SITE_KEY, s.siteId ? String(s.siteId) : null)
  write(NAME_KEY, s.name || null)
  if (s.name) {
    const names = new Set(phoneNames())
    names.add(s.name)
    write(NAMES_KEY, JSON.stringify([...names].slice(-20)))
  }
}

export function forgetSite() {
  write(SITE_KEY, null)
}

export function signOutSession() {
  write(SITE_KEY, null)
  write(SIGNED_KEY, null)
}

function phoneNames(): string[] {
  try {
    return JSON.parse(read(NAMES_KEY) || '[]')
  } catch {
    return []
  }
}

const DEMO_ROSTER = ['Alice Moreno', 'Bob Tran', 'Carlos Diaz', 'Dana Whit', 'Eli Park']

// The crew directory: names used on this phone plus the site's roster (GET /sites/{id}/muster),
// sorted, one entry per person.
export function useCrewDirectory(siteId?: number) {
  const [roster, setRoster] = useState<string[]>([])
  useEffect(() => {
    if (!siteId) return setRoster([])
    if (fake) return setRoster(DEMO_ROSTER)
    let stop = false
    get<{ in?: string[]; out?: string[] }>(`/sites/${siteId}/muster`)
      .then((m) => !stop && setRoster([...(m.in ?? []), ...(m.out ?? [])]))
      .catch(() => !stop && setRoster([]))
    return () => {
      stop = true
    }
  }, [siteId])
  const seen = new Map<string, string>()
  for (const n of [...phoneNames(), ...roster]) if (n.trim()) seen.set(n.trim().toLowerCase(), n.trim())
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

// A supervisor approves a site change on the crew's phone. ?fake=1 accepts 1234. Live, a supervisor
// signed in on this phone is enough; checking a typed PIN needs a backend route (asked of Viet).
export async function approveSiteChange(pin: string, token: string | null): Promise<{ ok: boolean; reason?: string }> {
  if (fake) return pin === '1234' ? { ok: true } : { ok: false, reason: 'wrong' }
  const role = token ? roleOf(token) : ''
  if (role === 'supervisor') return { ok: true }
  return { ok: false, reason: 'backend' }
}

function roleOf(token: string) {
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return String(claims['https://planit-beacon/role'] ?? '')
  } catch {
    return ''
  }
}

// Leaving a beacon: check the person out of the site they were connected to (best effort).
export async function checkOut(siteId: number, name: string, token: string | null) {
  if (fake) return
  await post('/checkin', { site_id: siteId, action: 'out', via: 'phone', name }, token).catch(() => {})
}
