'use client'

import { motion } from 'motion/react'
import Link from 'next/link'

const CARDS = [
  { n: '01', title: 'Sublease', body: 'Going abroad or graduating early? Hand your room to someone whose dates and budget actually fit.', href: '/listings?type=sublease', bg: 'linear-gradient(140deg,#990000 0%,#4d0000 60%,#1d0808 100%)' },
  { n: '02', title: 'Lease takeover', body: 'Step into an existing lease near campus, often at last year’s rate, without the application scramble.', href: '/listings?type=lease_takeover', bg: 'linear-gradient(140deg,#b38f00 0%,#7a2a00 55%,#2b0a05 100%)' },
  { n: '03', title: 'Room', body: 'Tell HOMIE your budget, move-in and how you live. It ranks every open room and says why.', href: '/listings?type=room', bg: 'linear-gradient(140deg,#ff5a1f 0%,#990000 55%,#2b0505 100%)' },
  { n: '04', title: 'Roommate wanted', body: 'Someone moving out? Find a replacement who fits the household you already have.', href: '/listings?type=roommate_replacement', bg: 'linear-gradient(140deg,#5c0000 0%,#990000 45%,#ffcc00 140%)' },
]

/** The four ways in, as a grid of large cards that scrolls by normally. */
export function HorizontalTypes() {
  return (
    <section className="shell py-20 sm:py-28" aria-label="Four ways in">
      <p className="text-sm font-bold tracking-[0.3em] text-accent uppercase">Four ways in</p>
      <h2 className="display mt-3 text-[clamp(2.8rem,6vw,5.5rem)] font-extrabold">
        One network of <span className="hl">Trojans.</span>
      </h2>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {CARDS.map((c, i) => (
          <motion.div
            key={c.n}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, delay: (i % 2) * 0.08, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <Link
              href={c.href}
              className="group relative flex h-[26rem] flex-col justify-end overflow-hidden rounded-[2.2rem] p-8 text-[#fff6e3]"
              style={{ background: c.bg }}
            >
              <span
                className="display pointer-events-none absolute -top-8 right-4 text-[14rem] leading-none font-extrabold text-transparent transition-transform duration-700 group-hover:-translate-y-3 group-hover:scale-105"
                style={{ WebkitTextStroke: '2px rgba(255,204,0,0.7)' }}
                aria-hidden
              >
                {c.n}
              </span>
              <h3 className="display relative text-[clamp(2.6rem,5vw,4.5rem)] font-extrabold">{c.title}</h3>
              <p className="relative mt-3 max-w-md text-lg leading-relaxed text-[#fff6e3]/85">{c.body}</p>
              <span className="relative mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-gold px-5 py-2.5 font-bold text-[#1d0808] transition-transform group-hover:translate-x-1">
                Browse {c.title.toLowerCase()} listings →
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
