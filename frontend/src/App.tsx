import { ApiStatus } from './components/ApiStatus'
import { MatchDemo } from './components/MatchDemo'
import { ResidentReport } from './components/ResidentReport'

const WAYS = [
  {
    title: 'Sublease your place',
    body: 'Going abroad or graduating early? List your room and get matched with students whose dates and budget actually fit.',
  },
  {
    title: 'Take over a lease',
    body: 'Step into an existing lease near campus, often below current market rent, without the application scramble.',
  },
  {
    title: 'Find a room',
    body: 'Tell HOMIE your budget, move-in date and how you live. It ranks open rooms and explains each match.',
  },
  {
    title: 'Replace a roommate',
    body: 'Someone moving out? Find a replacement who fits the household you already have.',
  },
]

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label="HOMIE home">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="display text-2xl font-extrabold text-jacaranda">HOMIE</span>
        </a>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <a href="#matching" className="hidden hover:text-jacaranda sm:inline">
            Matching
          </a>
          <a href="#reviews" className="hidden hover:text-jacaranda sm:inline">
            Resident reviews
          </a>
          <a
            href="#join"
            className="rounded-full bg-jacaranda px-4 py-2 text-petal hover:bg-jacaranda-dark"
          >
            Join with USC email
          </a>
        </nav>
      </header>

      <main>
        <section
          id="matching"
          className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-8 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16"
        >
          <div>
            <h1 className="display text-[clamp(3.25rem,9vw,7rem)] font-extrabold text-ink">
              Find your place. Find your people.
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
              HOMIE is the housing network for USC students. Post a sublease, take over a lease or
              find a room, and get matched on rent, dates, location and how you actually live.
            </p>
            <p className="mt-4 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
              Change the budget or move-in date on the card and watch the score respond. That is
              the real matching engine, not a mockup.
            </p>
          </div>
          <MatchDemo />
        </section>

        <section id="reviews" className="bg-petal-deep/60 py-20">
          <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
            <div className="lg:sticky lg:top-12">
              <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)] font-bold">
                Know the building before you sign.
              </h2>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
                Current and former residents review maintenance, pests, management, safety,
                cleanliness, noise, internet and what they really pay each month. HOMIE reads every
                review and surfaces the problems that keep coming up.
              </p>
              <p className="mt-4 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
                Every answer shows how many reviews it rests on, how many came from verified
                residents and when they were written. If the evidence is thin, HOMIE says so.
              </p>
            </div>
            <ResidentReport />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="display max-w-3xl text-[clamp(2.25rem,5vw,3.75rem)] font-bold">
            Four ways in, one network of Trojans.
          </h2>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {WAYS.map((w) => (
              <div key={w.title} className="border-l-4 border-jacaranda pl-5">
                <h3 className="font-display text-2xl font-semibold">{w.title}</h3>
                <p className="mt-2 max-w-[30rem] leading-relaxed text-ink-soft">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="join" className="bg-jacaranda py-20 text-petal">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)] font-bold">
                Spring move-ins are already being posted.
              </h2>
              <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-petal/80">
                HOMIE is open to students with a usc.edu address. Sign-up opens with the first
                release.
              </p>
            </div>
            <a
              href="mailto:hello@homie.example?subject=Add%20me%20to%20HOMIE"
              className="self-start whitespace-nowrap rounded-full bg-gold px-6 py-3.5 font-semibold text-ink hover:bg-petal lg:self-auto"
            >
              Get notified at launch
            </a>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>HOMIE is a student project and is not affiliated with USC.</span>
        <ApiStatus />
      </footer>
    </div>
  )
}
