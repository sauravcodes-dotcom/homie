'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { usePrefersReducedMotion } from '@/lib/hooks'
import { Magnetic } from './Magnetic'

// three.js is only downloaded when the 3D scene will actually be shown.
const HeroScene = dynamic(() => import('./HeroScene'), { ssr: false })

const WORDS = ['Find', 'your', 'place.', 'Find', 'your', 'people.']
const EASE = [0.2, 0.9, 0.2, 1] as const

/** Pinned for ~a screen of scrolling: the headline recedes and blurs while the camera
 *  flies down into the city, then the scene fades into the page. */
export function Hero() {
  const { user } = useAuth()
  const ref = useRef<HTMLElement>(null)
  const reduce = usePrefersReducedMotion()
  const [show3d, setShow3d] = useState(false)

  useEffect(() => {
    setShow3d(window.matchMedia('(min-width: 768px)').matches && !reduce)
  }, [reduce])

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const textScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.8])
  const textY = useTransform(scrollYProgress, [0, 0.7], ['0vh', '-12vh'])
  const textOpacity = useTransform(scrollYProgress, [0.08, 0.55], [1, 0])
  // Capped at 6px: by the time it would get stronger the text has nearly faded out,
  // and a large animated blur is the most expensive thing to redraw while scrolling.
  const textBlur = useTransform(scrollYProgress, [0.12, 0.6], ['blur(0px)', 'blur(6px)'])
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 1.18])
  const hintOpacity = useTransform(scrollYProgress, [0, 0.06], [1, 0])
  const veil = useTransform(scrollYProgress, [0.7, 1], [0, 1])

  return (
    <section ref={ref} className={`relative -mt-16 ${reduce ? '' : 'h-[220vh]'}`}>
      <div className="grain sticky top-0 isolate h-dvh overflow-hidden">
        <motion.div
          className="hero-fallback absolute inset-0 -z-10"
          style={reduce ? undefined : { scale: sceneScale }}
          aria-hidden
        >
          {show3d && <HeroScene progress={scrollYProgress} />}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/85 via-bg/25 to-transparent" />
        </motion.div>

        <motion.div
          className="shell flex h-full flex-col justify-center pt-16 will-change-transform"
          style={reduce ? undefined : { scale: textScale, y: textY, opacity: textOpacity, filter: textBlur }}
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="chip chip-gold w-fit"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
            Student housing, for Trojans only
          </motion.p>

          <h1 className="display mt-6 max-w-5xl text-[clamp(3.4rem,11vw,9.5rem)] font-extrabold">
            {WORDS.map((word, i) => (
              <Fragment key={i}>
              {i > 0 && ' '}
              <span className="inline-block overflow-hidden pr-[0.04em] pb-[0.08em] align-bottom">
                <motion.span
                  className={`inline-block ${i >= 3 ? 'text-shine' : ''}`}
                  initial={{ y: '110%', rotate: 6 }}
                  animate={{ y: 0, rotate: 0 }}
                  transition={{ duration: 0.9, delay: 0.12 + i * 0.08, ease: EASE }}
                >
                  {word}
                </motion.span>
              </span>
              </Fragment>
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
        </motion.div>

        {!reduce && (
          <motion.div
            style={{ opacity: hintOpacity }}
            className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 text-xs font-bold tracking-[0.3em] text-ink-soft uppercase"
            aria-hidden
          >
            Scroll
            <span className="flex h-10 w-6 justify-center rounded-full border-2 border-ink-soft/50 pt-2">
              <motion.span
                className="size-1.5 rounded-full bg-gold"
                animate={{ y: [0, 14, 0], opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </span>
          </motion.div>
        )}
        {!reduce && <motion.div style={{ opacity: veil }} className="pointer-events-none absolute inset-0 bg-bg" aria-hidden />}
      </div>
    </section>
  )
}
