import Link from 'next/link'
import { AISearchBox } from '@/components/AISearch'
import { Hero } from '@/components/Hero'
import { DeviceTour } from '@/components/home/DeviceTour'
import { FinalCta } from '@/components/home/FinalCta'
import { HorizontalTypes } from '@/components/home/HorizontalTypes'
import { LetterZoom } from '@/components/home/LetterZoom'
import { WordReveal } from '@/components/home/WordReveal'
import { MatchDemo } from '@/components/MatchDemo'
import { Reveal } from '@/components/Reveal'

const TICKER = ['Subleases', 'Lease takeovers', 'Rooms', 'Roommates', 'Building reviews', 'Trojans housing Trojans']

export default function Home() {
  return (
    <>
      <Hero />

      <div className="overflow-hidden border-y border-line bg-cardinal py-4 text-gold" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {TICKER.map((t) => (
                <span key={t} className="display flex items-center px-6 text-3xl font-extrabold uppercase">
                  {t}
                  <span className="pl-12 text-xl">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="shell py-24">
        <Reveal>
          <div className="card grid items-start gap-8 p-6 shadow-[0_50px_120px_-60px_var(--glow)] sm:p-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-sm font-bold tracking-widest text-accent uppercase">AI matching</p>
              <h2 className="display mt-3 text-[clamp(2.2rem,5vw,3.8rem)] font-extrabold">
                Find apartments with <span className="hl">AI.</span>
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
                Say what you need: budget, dates, area, how you live, must-haves. HOMIE reads it,
                scores every open listing near campus and tells you why its top picks fit.
              </p>
            </div>
            <AISearchBox goTo />
          </div>
        </Reveal>
      </section>

      <WordReveal />
      <DeviceTour />
      <LetterZoom />
      <HorizontalTypes />

      <section className="shell grid items-center gap-12 py-28 lg:grid-cols-[1fr_1.05fr]">
        <Reveal>
          <p className="text-sm font-bold tracking-widest text-accent uppercase">Try it live</p>
          <h2 className="display mt-3 text-[clamp(2.6rem,6.5vw,5rem)] font-extrabold">
            Move a slider. <span className="hl">Watch it think.</span>
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            This card calls the real matching engine. Change the budget, the move-in date or your
            habits and every factor rescores on the spot.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/match" className="btn btn-cardinal">Find my match</Link>
            <Link href="/onboarding" className="btn btn-ghost">Take the quiz</Link>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <MatchDemo />
        </Reveal>
      </section>

      <FinalCta />
    </>
  )
}
