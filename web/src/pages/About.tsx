import type { ReactNode } from 'react'
import { BrainCircuit, CircleAlert, Gauge, Languages, Target } from 'lucide-react'
import Frame from '@/components/Frame'
import { label } from '@/components/marsh'
import { useTitle } from '@/lib/useTitle'
import { color, indexStops } from '@/tokens'

// About the hazard index. Text by Chris (ml/report/about.md), plain language, used as written.

export default function About() {
  useTitle('About the index')
  return (
    <div className="min-h-dvh w-full lg:h-screen lg:overflow-hidden">
      <Frame unit="ABOUT THE INDEX" active="about" status={null} footer={['How the hazard index is made and what it is for.', 'OMNIRISK']}>
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <article className="mx-auto flex max-w-3xl flex-col gap-5 pb-8">
            <header>
              <p className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: color.muted }}>About / Hazard index</p>
              <h1 className="mt-1 text-[30px] leading-tight font-bold">How the index works</h1>
            </header>

            <div className="flex flex-wrap gap-3">
              {[['0–3', 'Lower risk', indexStops.low], ['4–6', 'Elevated', indexStops.mid], ['7–10', 'High risk', indexStops.high]].map(([n, t, c]) => (
                <span key={n} className="flex items-center gap-3 rounded-md px-4 py-3" style={{ background: color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
                  <span className="text-[26px] font-semibold" style={{ color: c }}>{n}</span>
                  <span className="text-[14px]" style={{ color: color.muted }}>{t}</span>
                </span>
              ))}
            </div>

            <Section icon={<Gauge className="size-5" />} title="What the number means">
              Every site gets a hazard index from 0 to 10 for tomorrow. It answers one question: given tomorrow's forecast at this site, how likely is weather or
              ground conditions that can hurt a crew? A 7 means tomorrow looks riskier than 70% of the days the model was checked against. Next to the number are
              the three weather reasons that pushed it up, such as "3 day rain 111 mm" or "Gusts 49 km/h", so a crew lead can see why and argue with it.
            </Section>

            <Section icon={<BrainCircuit className="size-5" />} title="Where it comes from">
              A machine learning model (LightGBM) trained on nine years of history at our 50 power plant sites. It learned from the weather on each day and whether
              something went wrong nearby that day: a severe weather event recorded by NOAA within 40 km, a heat event in the same county, or an outdoor workplace
              injury reported to OSHA within 25 km. It was trained on 2016 to 2022 and tested on 2024, a year it never saw.
            </Section>

            <Section icon={<Target className="size-5" />} title="How good it is">
              On 2024, compared with the rule a supervisor would write by hand (heat index over 103 F, more than 75 mm of rain in three days, or gusts over 60 km/h),
              the model catches more of the bad days and raises fewer false alarms. Full numbers are in the project README.
            </Section>

            <Section icon={<CircleAlert className="size-5" />} title="What it is not" tint={color.accentPale}>
              It is not an injury forecast and it cannot tell whether a particular crew was exposed. Its history is recorded by county and by day, some heat events
              are missed, and injury reports are located by zip code. Use it to decide which sites to look at first, then look.
            </Section>

            <Section icon={<Languages className="size-5" />} title="The briefing and photo tags">
              The 6 PM briefing (English and Spanish), the one-sentence explanation of each index, and the tags on crew hazard photos are written by Google's
              Gemini. Every number in a briefing is checked against the data it was given; if Gemini adds a number that is not in the data, the briefing is
              rewritten from a template instead.
            </Section>
          </article>
        </div>
      </Frame>
    </div>
  )
}

function Section({ icon, title, tint, children }: { icon: ReactNode; title: string; tint?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg p-5" style={{ background: tint ?? color.surface, boxShadow: `inset 0 0 0 1px ${color.border}` }}>
      <h2 className={`mb-2 flex items-center gap-2 ${label}`} style={{ color: color.text }}>
        <span style={{ color: color.muted }}>{icon}</span> {title}
      </h2>
      <p className="text-[16px] leading-relaxed">{children}</p>
    </section>
  )
}
