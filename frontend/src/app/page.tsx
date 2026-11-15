import Link from 'next/link'
import { Hero } from '@/components/Hero'
import { Magnetic } from '@/components/Magnetic'
import { MatchDemo } from '@/components/MatchDemo'
import { Reveal } from '@/components/Reveal'

const TICKER = ['Subleases', 'Lease takeovers', 'Rooms', 'Roommates', 'Building reviews', 'Trojans housing Trojans']

const FEATURES = [
  {
    title: 'Swipe your matches',
    body: 'Every listing and roommate comes with a score and the reasons behind it. Right to save, left to pass.',
    href: '/discover',
    span: 'lg:col-span-2',
    big: '92',
  },
  {
    title: 'Know the building',
    body: 'Residents review pests, maintenance, management, noise and what they really pay. HOMIE surfaces what keeps coming up.',
    href: '/buildings',
    span: '',
  },
  {
    title: 'Ask a building anything',
    body: '"Is the wifi bad?" Answers come from reviews, with the quotes and the sample size shown.',
    href: '/buildings',
    span: '',
  },
  {
    title: 'Red flags, flagged',
    body: 'Rent far below market, pay-before-viewing, copied descriptions. Each listing is checked before you see it.',
    href: '/listings',
    span: '',
  },
  {
    title: 'See it on the map',
    body: 'Every listing with its walk and bike time to campus.',
    href: '/map',
    span: '',
  },
  {
    title: 'Review people too',
    body: 'After you have dealt with someone, rate them as a roommate, subletter or lister. Good Trojans build a reputation.',
    href: '/messages',
    span: 'lg:col-span-2',
  },
  {
    title: 'Is the rent fair?',
    body: 'Each price is compared with similar listings in the same building or neighborhood.',
    href: '/listings',
    span: '',
  },
]

export default function Home() {
  return (
    <>
      <Hero />

      <div className="overflow-hidden border-b border-line bg-cardinal py-4 text-gold" aria-hidden>
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

      <section className="shell grid items-center gap-12 py-24 lg:grid-cols-[1fr_1.05fr]">
        <Reveal>
          <p className="text-sm font-bold tracking-widest text-accent uppercase">The matching engine</p>
          <h2 className="display mt-3 text-[clamp(2.6rem,6.5vw,5rem)] font-extrabold">
            A score you can <span className="hl">argue with.</span>
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            Move the budget or the move-in date and watch the number respond. This card calls the
            real engine, and every point of the score is explained.
          </p>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-soft">
            Take the two-minute lifestyle quiz and HOMIE ranks every open room for you the same way.
          </p>
          <Link href="/onboarding" className="btn btn-cardinal mt-8">
            Take the quiz
          </Link>
        </Reveal>
        <Reveal delay={0.15}>
          <MatchDemo />
        </Reveal>
      </section>

      <section className="border-y border-line bg-surface/60 py-24">
        <div className="shell">
          <Reveal>
            <h2 className="display max-w-4xl text-[clamp(2.6rem,6.5vw,5rem)] font-extrabold">
              Everything between <span className="hl">“I need a place”</span> and move-in day.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08} className={f.span}>
                <Link href={f.href} className="card card-hover group relative flex h-full min-h-52 flex-col justify-end overflow-hidden p-7">
                  {f.big && (
                    <span className="display text-shine pointer-events-none absolute -top-6 right-4 text-[11rem] font-extrabold opacity-90" aria-hidden>
                      {f.big}
                    </span>
                  )}
                  <h3 className="display relative text-3xl font-bold">{f.title}</h3>
                  <p className="relative mt-3 max-w-md leading-relaxed text-ink-soft">{f.body}</p>
                  <span className="relative mt-4 text-sm font-bold text-accent transition-transform group-hover:translate-x-1.5">
                    Open →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-cardinal py-24 text-[#fff6e3]">
        <div className="shell flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <h2 className="display max-w-3xl text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold">
              Got a room? <span className="text-gold">Someone needs it.</span>
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#fff6e3]/80">
              Paste your rough notes and HOMIE writes the listing. Open to anyone with a usc.edu
              address.
            </p>
          </Reveal>
          <Magnetic>
            <Link href="/listings/new" className="btn btn-gold px-8 py-4 text-base">
              Post a listing <span aria-hidden>→</span>
            </Link>
          </Magnetic>
        </div>
      </section>
    </>
  )
}
