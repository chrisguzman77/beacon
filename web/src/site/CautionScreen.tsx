import { CircleCheck, TriangleAlert } from 'lucide-react'
import { color } from '@/tokens'
import type { Factor } from './factors'

// Shown only while nobody is using the screen: flashes the current hazards, or holds NO HAZARDS.
// MARSH style: the amber act-now banner over the hazard list, or a calm sage card when clear.
export default function CautionScreen({ hazards, site }: { hazards: Factor[]; site: string }) {
  const clear = hazards.length === 0

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 px-16" style={{ background: color.bg, color: color.text }}>
      {clear ? (
        <section className="flex w-full max-w-4xl items-center gap-6 rounded-md px-10 py-10" style={{ background: color.raised }}>
          <CircleCheck className="size-20 shrink-0" style={{ color: color.signal }} strokeWidth={1.75} />
          <div>
            <p className="font-mono text-[12px] tracking-[0.12em]" style={{ color: color.muted }}>{site.toUpperCase()} / ALL CLEAR</p>
            <h1 className="text-[56px] leading-tight font-bold">No hazards</h1>
            <p className="text-[18px]" style={{ color: color.muted }}>All monitored factors are normal at {site}.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="flex w-full max-w-5xl items-center gap-6 rounded-md px-8 py-6" style={{ background: color.accent, boxShadow: `inset 0 0 0 1.5px ${color.text}` }}>
            <TriangleAlert className="size-16 shrink-0" strokeWidth={1.75} />
            <div>
              <p className="font-mono text-[12px] tracking-[0.12em]">{site.toUpperCase()} / {hazards.length} ACTIVE HAZARD{hazards.length > 1 ? 'S' : ''}</p>
              <h1 className="text-[56px] leading-tight font-bold">Caution</h1>
            </div>
          </section>
          <div className="grid w-full max-w-5xl grid-cols-2 gap-3">
            {hazards.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-4 rounded-md py-4 pr-5 pl-4" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}`, borderLeft: `5px solid ${h.tint}` }}>
                <span className="text-[20px] font-semibold">{h.note}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-bold" style={{ color: h.tint }}>
                  <TriangleAlert className="size-4" /> {h.status === 'danger' ? 'Danger' : 'Caution'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="font-mono text-[11px] tracking-[0.12em]" style={{ color: color.muted }}>MOVE THE MOUSE OR PRESS ANY KEY TO RETURN</p>
    </div>
  )
}
