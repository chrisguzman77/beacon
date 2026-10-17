import { ShieldCheck, TriangleAlert } from 'lucide-react'
import Panel from '@/components/Panel'
import { color } from '@/tokens'
import type { Factor } from './factors'

// Shown only while nobody is using the screen: flashes the current hazards, or holds NO HAZARDS.
export default function CautionScreen({ hazards, site }: { hazards: Factor[]; site: string }) {
  const clear = hazards.length === 0
  const accent = clear ? color.signal : color.offline
  return (
    <div className="absolute inset-0 z-50 bg-bg p-4">
      <div
        className="h-full p-3"
        style={{ background: `repeating-linear-gradient(-45deg, ${accent} 0 18px, ${color.bg} 18px 36px)` }}
      >
        <div className="flex h-full flex-col items-center justify-center gap-8 bg-bg px-12">
          <div className="flex items-center gap-5" style={{ color: accent }}>
            {clear ? <ShieldCheck className="size-24" strokeWidth={2.5} /> : <TriangleAlert className="size-24" strokeWidth={2.5} />}
            <span className="text-[104px] leading-none font-black tracking-[0.06em]">{clear ? 'NO HAZARDS' : 'CAUTION'}</span>
          </div>

          {clear ? (
            <p className="text-heading text-dim">All monitored factors are normal at {site}.</p>
          ) : (
            <div className="flex w-full max-w-5xl flex-wrap justify-center gap-4">
              {hazards.map((h) => (
                <Panel
                  key={h.id}
                  className="w-[480px]"
                  size={14}
                  edge={h.tint}
                  fill={`color-mix(in srgb, ${h.tint} ${h.status === 'danger' ? 40 : 16}%, ${color.bg})`}
                  inner="flex items-center justify-between gap-4 px-6 py-4"
                >
                  <span className="text-heading font-bold">{h.note}</span>
                  <span className="font-mono text-body font-bold">{h.status.toUpperCase()}</span>
                </Panel>
              ))}
            </div>
          )}

          <p className="font-mono text-label tracking-[0.2em] text-dim">MOVE THE MOUSE OR PRESS ANY KEY TO RETURN</p>
        </div>
      </div>
    </div>
  )
}
