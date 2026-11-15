import { Hero } from '@/components/Hero'
import { DeviceTour } from '@/components/home/DeviceTour'
import { FinalCta } from '@/components/home/FinalCta'
import { HorizontalTypes } from '@/components/home/HorizontalTypes'
import { LiveDemo } from '@/components/home/LiveDemo'
import { WordReveal } from '@/components/home/WordReveal'

const TICKER = ['Subleases', 'Lease takeovers', 'Rooms', 'Roommates', 'Building reviews', 'Trojans housing Trojans']

/* The page is a short run of beats, each of which lands and holds before the next one starts:
   the promise (Hero), the problem and the turn (WordReveal), the product working (LiveDemo, the
   peak and the longest section), what else it does (DeviceTour), the ways in (HorizontalTypes),
   and the close (FinalCta). See components/home/Beat.tsx for how the page settles on each. */
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

      <WordReveal />
      <LiveDemo />
      <DeviceTour />
      <HorizontalTypes />
      <FinalCta />
    </>
  )
}
