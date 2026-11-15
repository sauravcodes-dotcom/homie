'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Magnetic } from '../Magnetic'

/** The close: a cardinal block whose line and buttons rise in once as it comes into view. */
export function FinalCta() {
  const { user } = useAuth()
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { duration: 0.7, delay, ease: [0.2, 0.9, 0.2, 1] as const },
  })

  return (
    <section className="relative overflow-hidden bg-cardinal px-5 py-28 sm:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,204,0,0.25),transparent_70%)]" aria-hidden />
      <div className="relative">
        <motion.h2 className="display text-center text-[clamp(3.2rem,11vw,10rem)] font-extrabold text-[#fff6e3]" {...rise(0)}>
          Your place is <span className="text-gold">out there.</span>
        </motion.h2>
        <motion.div className="mt-10 flex flex-wrap justify-center gap-4" {...rise(0.15)}>
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
      </div>
    </section>
  )
}
