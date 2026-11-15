'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { Stars } from '@/components/Bits'
import { ScoreRing } from '@/components/Match'

function PhoneChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-[10px] font-bold text-ink-soft">
        <span>9:41</span>
        <span className="h-5 w-20 rounded-full bg-black" aria-hidden />
        <span>Sample</span>
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-3">
        <span className="grid size-5 place-items-center rounded-md bg-cardinal" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-3"><path d="M3 12 12 3.5 21 12v8a1.5 1.5 0 0 1-1.5 1.5H15V15H9v6.5H4.5A1.5 1.5 0 0 1 3 20z" fill="#FFCC00" /></svg>
        </span>
        <span className="display text-sm font-extrabold">HOMIE</span>
      </div>
      <div className="relative flex-1 overflow-hidden px-3 pb-3">{children}</div>
    </div>
  )
}

function SwipeScreen() {
  return (
    <div className="relative h-full">
      {[2, 1].map((d) => (
        <div key={d} className="absolute inset-x-2 top-0 h-[88%] rounded-3xl bg-surface-2" style={{ transform: `translateY(${d * 10}px) scale(${1 - d * 0.04})` }} />
      ))}
      <motion.div
        className="absolute inset-x-2 top-0 h-[88%] overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
        animate={{ rotate: [0, 5, 0, -4, 0], x: [0, 24, 0, -18, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="h-1/2 bg-gradient-to-br from-cardinal via-[#5c0000] to-[#b38f00]" />
        <div className="flex gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="display text-2xl font-extrabold">$1,150</p>
            <p className="text-xs font-semibold">Room in a 2-bed</p>
            <p className="text-[10px] text-ink-soft">8 min walk · Jan to May</p>
            <p className="mt-2 text-[10px] text-ok">✓ Within budget</p>
            <p className="text-[10px] text-ok">✓ Both early risers</p>
          </div>
          <ScoreRing score={92} size={56} />
        </div>
      </motion.div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-6">
        <span className="grid size-11 place-items-center rounded-full border-2 border-line text-bad">✕</span>
        <span className="grid size-11 place-items-center rounded-full bg-gold text-[#1d0808]">♥</span>
      </div>
    </div>
  )
}

function PeopleScreen() {
  return (
    <div className="grid gap-2 p-1 text-[11px]">
      <p className="text-sm font-bold">Riley P. <span className="ml-1 rounded-full bg-ok/15 px-1.5 text-[9px] text-ok">USC verified</span></p>
      {[
        [false, 'Hey! Is the room still open for spring?'],
        [true, 'Yes! Want to come see it Thursday?'],
        [false, 'Perfect, see you then.'],
      ].map(([mine, text], i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.25 }}
          className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'justify-self-end rounded-br-md bg-cardinal text-[#fff6e3]' : 'rounded-bl-md bg-surface-2'}`}
        >
          {text as string}
        </motion.p>
      ))}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 }} className="mt-2 rounded-2xl border border-gold/40 bg-gold/10 p-3">
        <p className="font-bold">Review Riley as a roommate</p>
        <div className="mt-1"><Stars value={5} /></div>
        <p className="mt-1 text-ink-soft">Cleanliness 5 · Communication 5</p>
      </motion.div>
    </div>
  )
}

function FlagScreen() {
  return (
    <div className="grid gap-3 p-1 text-[11px]">
      <div className="overflow-hidden rounded-2xl bg-surface-2">
        <div className="h-20 bg-gradient-to-br from-[#4d0000] to-[#1d0808]" />
        <div className="p-3">
          <p className="display text-xl font-extrabold">$420 <span className="font-sans text-[10px] font-normal text-ink-soft">/mo</span></p>
          <p className="font-semibold">Too good to be true studio</p>
        </div>
      </div>
      <div className="rounded-2xl border border-bad/50 p-3">
        <p className="flex items-center justify-between font-bold">Several red flags <span className="rounded-full bg-bad/15 px-1.5 text-[9px] text-bad">high risk</span></p>
        {['Rent is 64% below the area median', 'Asks for money before a viewing', 'Says they cannot show the place', 'Wants payment by Zelle'].map((f, i) => (
          <motion.p key={f} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.15 }} className="mt-1.5 flex gap-1.5 text-ink-soft">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-bad" />{f}
          </motion.p>
        ))}
      </div>
    </div>
  )
}

const STEPS = [
  { kicker: 'Discover', title: 'Swipe your matches.', body: 'Every room and roommate arrives with a score. Right to save, left to pass. Arrow keys work too.', href: '/discover', cta: 'Start swiping', Screen: SwipeScreen, glow: '#990000' },
  { kicker: 'People', title: 'Message first. Review after.', body: 'Talk without swapping numbers. Once you have both written, you can rate each other as roommates, subletters or listers.', href: '/messages', cta: 'Open messages', Screen: PeopleScreen, glow: '#990000' },
  { kicker: 'Safety', title: 'Red flags, flagged.', body: 'Bait prices, pay-before-viewing, copied text. Every listing is checked before you ever see it.', href: '/listings', cta: 'Browse safely', Screen: FlagScreen, glow: '#ff3b30' },
]

function Phone({ index }: { index: number }) {
  const { Screen } = STEPS[index]
  return (
    <div className="relative mx-auto aspect-[9/18.5] w-full max-w-[19rem] rounded-[3.2rem] border-[10px] border-[#1a0808] bg-surface shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9),inset_0_0_0_2px_rgba(255,204,0,0.25)]">
      <div className="absolute inset-0 overflow-hidden rounded-[2.6rem]">
        <PhoneChrome><Screen /></PhoneChrome>
      </div>
    </div>
  )
}

/** Feature tour: one row per feature, each with its own phone, alternating sides. Rows fade
 *  in as they arrive; the page scrolls straight through. */
export function DeviceTour() {
  return (
    <section className="py-20 sm:py-28" aria-label="What HOMIE does">
      <div className="shell grid gap-24 lg:gap-32">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            className="relative grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <div className={i % 2 ? 'lg:order-2' : ''}>
              <p className="text-sm font-bold tracking-[0.25em] text-accent uppercase">{s.kicker}</p>
              <h2 className="display mt-4 text-[clamp(2.6rem,6vw,5rem)] font-extrabold">{s.title}</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">{s.body}</p>
              <Link href={s.href} className="group mt-6 inline-flex w-fit items-center gap-2 font-bold text-accent">
                {s.cta}
                <span className="transition-transform group-hover:translate-x-1.5" aria-hidden>→</span>
              </Link>
            </div>
            <div className="relative flex justify-center">
              {/* Soft glow behind the phone, drawn as a gradient (a large CSS blur is costly). */}
              <div
                className="pointer-events-none absolute top-1/2 left-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35"
                style={{ background: `radial-gradient(circle at center, ${s.glow} 0%, ${s.glow} 22%, transparent 68%)` }}
                aria-hidden
              />
              <div className="relative w-full max-w-[19rem]">
                <Phone index={i} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
