import { Hero } from '@/components/Hero'
import { DeviceTour } from '@/components/home/DeviceTour'
import { FinalCta } from '@/components/home/FinalCta'
import { HorizontalTypes } from '@/components/home/HorizontalTypes'
import { LiveDemo } from '@/components/home/LiveDemo'
import { WordReveal } from '@/components/home/WordReveal'

const TICKER = ['Subleases', 'Lease takeovers', 'Rooms', 'Roommates', 'Building reviews', 'Trojans housing Trojans']

/* A straight scroll, top to bottom, with nothing pinned or held: the promise (Hero), the problem
   and the turn (WordReveal), the product working (LiveDemo), what else it does (DeviceTour), the
   ways in (HorizontalTypes), and the close (FinalCta). Sections animate in once as they arrive. */
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
