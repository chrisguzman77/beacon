import { useState } from 'react'
import { Check, LocateFixed, MapPin, Search, UserPlus } from 'lucide-react'
import type { SiteRow } from '@/api'
import { useSlow } from '@/lib/useSlow'
import { useCrewDirectory } from '@/sweet-treats/crewSession'
import type { Session } from '@/sweet-treats/crewSession'
import type { CrewText } from '@/sweet-treats/crewText'
import { miles, nearest, useDeviceLocation } from '@/sweet-treats/useDeviceLocation'
import { color, hazard } from '@/tokens'
import { BigButton, sectionLabel } from './parts'

// Page 2 of the crew phone: who you are (found in the crew directory, or added) and where you are
// (the phone's live location first, the other sites under it). Then the phone connects to that beacon.

type Props = { t: CrewText; sites: SiteRow[]; failed: boolean; initial: Session; onDone: (s: Session) => void }

export default function Setup({ t, sites, failed, initial, onDone }: Props) {
  const here = useDeviceLocation()
  const near = here ? nearest(sites, here) : undefined
  const [name, setName] = useState(initial.name)
  const [siteId, setSiteId] = useState(initial.siteId || 0)
  // Roster of the picked site, else the nearest, else the beacon site, so people find themselves right away.
  const directory = useCrewDirectory(siteId || near?.site_id || sites.find((x) => x.beacon)?.site_id)
  const noLocation = useSlow(!here, 6000)

  const q = name.trim().toLowerCase()
  const exact = directory.find((n) => n.toLowerCase() === q)
  const matches = directory.filter((n) => !q || (n.toLowerCase().includes(q) && n.toLowerCase() !== q)).slice(0, 6)
  const others = [...sites].filter((s) => s.site_id !== near?.site_id).sort((a, b) => (here ? miles(here, a) - miles(here, b) : Number(b.beacon) - Number(a.beacon) || a.name.localeCompare(b.name)))

  return (
    <section className="flex flex-col gap-5">
      {/* Who you are */}
      <div className="flex flex-col gap-2">
        <span className={sectionLabel} style={{ color: color.muted }}>{t.yourName}</span>
        <label className="flex h-14 items-center gap-3 rounded-md px-4" style={{ background: color.surface, boxShadow: `inset 0 0 0 ${exact ? 2 : 1.5}px ${exact ? color.signal : color.border}` }}>
          <Search className="size-5 shrink-0" style={{ color: color.muted }} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.findName} autoComplete="off" className="w-full bg-transparent text-[18px] outline-none" />
          {exact && <Check className="size-5 shrink-0" style={{ color: color.signal }} strokeWidth={3} />}
        </label>
        {directory.length === 0 && !q && <p className="text-[13px]" style={{ color: color.muted }}>{t.noNames}</p>}
        {(matches.length > 0 || (q && !exact)) && (
          <ul className="flex flex-col overflow-hidden rounded-md" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
            {matches.map((n) => (
              <li key={n}>
                <button onClick={() => setName(n)} className="flex w-full items-center gap-3 border-b px-4 py-3 text-left text-[16px] last:border-b-0" style={{ borderColor: color.border }}>
                  <span className="flex size-8 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: color.raised }}>{n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                  {n}
                </button>
              </li>
            ))}
            {q && !exact && (
              <li className="flex items-center gap-3 px-4 py-3 text-[15px]" style={{ color: color.muted }}>
                <UserPlus className="size-5" /> {t.addMe(name.trim())}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Where you are: the phone's location first */}
      <div className="flex flex-col gap-2">
        <span className={sectionLabel} style={{ color: color.muted }}>{t.yourLocation}</span>
        {near && here ? (
          <button
            onClick={() => setSiteId(near.site_id)}
            className="flex items-center gap-4 rounded-md px-4 py-4 text-left"
            style={{ background: siteId === near.site_id ? color.accentPale : color.surface, boxShadow: `inset 0 0 0 ${siteId === near.site_id ? 2 : 1}px ${siteId === near.site_id ? color.accent : color.border}` }}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full" style={{ background: color.chrome, color: color.accent }}>
              <LocateFixed className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">{t.useMyLocation}</span>
              <span className="block truncate text-[14px]">{t.nearestIs(near.name, Math.round(miles(here, near)))}</span>
              <span className="block font-mono text-[11px]" style={{ color: color.muted }}>
                {Math.abs(here.lat).toFixed(4)}° {here.lat >= 0 ? 'N' : 'S'}, {Math.abs(here.lon).toFixed(4)}° {here.lon >= 0 ? 'E' : 'W'}
              </span>
            </span>
            {siteId === near.site_id && <Check className="size-6 shrink-0" style={{ color: color.signal }} strokeWidth={3} />}
          </button>
        ) : (
          <p className="flex items-center gap-3 rounded-md px-4 py-4 text-[15px]" style={{ background: color.surface, color: color.muted, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
            <LocateFixed className={`size-5 ${noLocation ? '' : 'animate-beacon-pulse'}`} /> {noLocation ? t.locationOff : t.locating}
          </p>
        )}

        <span className={`${sectionLabel} mt-2`} style={{ color: color.muted }}>{near ? t.otherSites : t.pickSite}</span>
        <ul className="flex max-h-[38dvh] flex-col gap-2 overflow-y-auto">
          {!sites.length && (
            <li className="flex items-center justify-between gap-3 text-[15px]" style={{ color: failed ? hazard.stopwork : color.muted }}>
              {failed ? t.listFailed : t.loadingSites}
              {failed && <button onClick={() => location.reload()} className="font-semibold underline">{t.retry}</button>}
            </li>
          )}
          {others.map((s) => (
            <li key={s.site_id}>
              <button
                onClick={() => setSiteId(s.site_id)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left"
                style={{ background: siteId === s.site_id ? color.accentPale : color.surface, boxShadow: `inset 0 0 0 ${siteId === s.site_id ? 2 : 1}px ${siteId === s.site_id ? color.accent : color.border}` }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-semibold">{s.name}</span>
                  <span className="block text-[13px]" style={{ color: color.muted }}>{s.county}, {s.state}{here ? ` · ${Math.round(miles(here, s))} mi` : ''}</span>
                </span>
                {siteId === s.site_id && <Check className="size-6 shrink-0" style={{ color: color.signal }} strokeWidth={3} />}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <BigButton disabled={!siteId || !name.trim()} onClick={() => onDone({ siteId, name: exact ?? name.trim() })} fill={color.accent} ink={color.accentInk} icon={<MapPin className="size-7" />}>
        {t.start}
      </BigButton>
    </section>
  )
}
