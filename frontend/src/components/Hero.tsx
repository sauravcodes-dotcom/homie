'use client'

import { motion } from 'motion/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { Magnetic } from './Magnetic'

// three.js is only downloaded when the 3D scene will actually be shown.
const HeroScene = dynamic(() => import('./HeroScene'), { ssr: false })

const WORDS = ['Find', 'your', 'place.', 'Find', 'your', 'people.']

export function Hero() {
  const { user } = useAuth()
  const [show3d, setShow3d] = useState(false)

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)').matches
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setShow3d(wide && !calm)
  }, [])

  return (
    <section className="grain relative isolate overflow-hidden border-b border-line">
      <div className="hero-fallback absolute inset-0 -z-10" aria-hidden>
        {show3d && <HeroScene />}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/85 via-bg/30 to-transparent" />
      </div>

      <div className="shell flex min-h-[calc(100dvh-4rem)] flex-col justify-center py-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="chip chip-gold w-fit"
        >
          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
          Student housing, for Trojans only
        </motion.p>

        <h1 className="display mt-6 max-w-5xl text-[clamp(3.4rem,11vw,9.5rem)] font-extrabold">
          {WORDS.map((word, i) => (
            <span key={i} className="inline-block overflow-hidden pr-[0.18em] pb-[0.08em] align-bottom">
              <motion.span
                className={`inline-block ${i >= 3 ? 'text-shine' : ''}`}
                initial={{ y: '110%', rotate: 6 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ duration: 0.9, delay: 0.12 + i * 0.08, ease: [0.2, 0.9, 0.2, 1] }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.75 }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl"
        >
          Subleases, lease takeovers, rooms and roommates near USC. Matched on rent, dates,
          location and how you actually live, with honest reviews of every building.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9 }}
          className="mt-9 flex flex-wrap items-center gap-4"
        >
          <Magnetic>
            <Link href={user ? '/discover' : '/login'} className="btn btn-gold px-7 py-4 text-base">
              {user ? 'Start swiping' : 'Join with your USC email'}
              <span aria-hidden>→</span>
            </Link>
          </Magnetic>
          <Magnetic strength={0.2}>
            <Link href="/listings" className="btn btn-ghost px-7 py-4 text-base">
              Browse listings
            </Link>
          </Magnetic>
        </motion.div>
      </div>
    </section>
  )
}
