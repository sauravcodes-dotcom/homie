'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import Link from 'next/link'
import { useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { usePrefersReducedMotion } from '@/lib/hooks'
import { Magnetic } from '../Magnetic'
import { Beat } from './Beat'

/** The page floods cardinal while the closing line tightens into place. */
export function FinalCta() {
  const ref = useRef<HTMLElement>(null)
  const { user } = useAuth()
  const reduce = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const flood = useTransform(scrollYProgress, [0.1, 0.45], [0, 1])
  const radius = useTransform(scrollYProgress, [0.1, 0.5], ['4rem', '0rem'])
  const inset = useTransform(scrollYProgress, [0.1, 0.5], ['6%', '0%'])
  const textOpacity = useTransform(scrollYProgress, [0.25, 0.55], [0, 1])
  const textScale = useTransform(scrollYProgress, [0.25, 0.7], [0.75, 1])
  const tracking = useTransform(scrollYProgress, [0.25, 0.7], ['0.25em', '-0.04em'])
  const ctaOpacity = useTransform(scrollYProgress, [0.6, 0.78], [0, 1])
  const ctaY = useTransform(scrollYProgress, [0.6, 0.78], [30, 0])

  const content = (
    <>
      <motion.h2
        className="display text-center text-[clamp(3.2rem,11vw,10rem)] font-extrabold text-[#fff6e3]"
        style={reduce ? undefined : { opacity: textOpacity, scale: textScale, letterSpacing: tracking }}
      >
        Your place is <span className="text-gold">out there.</span>
      </motion.h2>
      <motion.div className="mt-10 flex flex-wrap justify-center gap-4" style={reduce ? undefined : { opacity: ctaOpacity, y: ctaY }}>
        <Magnetic>
          <Link href={user ? '/discover' : '/login'} className="btn btn-gold px-8 py-4 text-base">
            {user ? 'Start swiping' : 'Join with your USC email'} <span aria-hidden>→</span>
          </Link>
        </Magnetic>
        <Magnetic strength={0.2}>
          <Link href="/listings/new" className="btn border border-[#fff6e3]/40 px-8 py-4 text-base text-[#fff6e3] hover:border-gold">
            Post a listing
          </Link>
        </Magnetic>
      </motion.div>
    </>
  )

  if (reduce) {
    return <section ref={ref} className="bg-cardinal px-5 py-28">{content}</section>
  }

  return (
    <section ref={ref} className="relative h-[140vh]">
      <Beat top="100%" align="end" />
      <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden">
        <motion.div
          className="absolute bg-cardinal"
          style={{ opacity: flood, borderRadius: radius, top: inset, bottom: inset, left: inset, right: inset }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,204,0,0.25),transparent_70%)]" />
        </motion.div>
        <div className="relative px-5">{content}</div>
      </div>
    </section>
  )
}
