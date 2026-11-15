'use client'

import { motion, useMotionValue, useScroll, useTransform } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/hooks'
import { Beat } from './Beat'

const CARDS = [
  { n: '01', title: 'Sublease', body: 'Going abroad or graduating early? Hand your room to someone whose dates and budget actually fit.', href: '/listings?type=sublease', bg: 'linear-gradient(140deg,#990000 0%,#4d0000 60%,#1d0808 100%)' },
  { n: '02', title: 'Lease takeover', body: 'Step into an existing lease near campus, often at last year’s rate, without the application scramble.', href: '/listings?type=lease_takeover', bg: 'linear-gradient(140deg,#b38f00 0%,#7a2a00 55%,#2b0a05 100%)' },
  { n: '03', title: 'Room', body: 'Tell HOMIE your budget, move-in and how you live. It ranks every open room and says why.', href: '/listings?type=room', bg: 'linear-gradient(140deg,#ff5a1f 0%,#990000 55%,#2b0505 100%)' },
  { n: '04', title: 'Roommate wanted', body: 'Someone moving out? Find a replacement who fits the household you already have.', href: '/listings?type=roommate_replacement', bg: 'linear-gradient(140deg,#5c0000 0%,#990000 45%,#ffcc00 140%)' },
]

/** Pinned section: scrolling down slides a row of large cards sideways. Each card is a beat, so
 *  the row settles with a card squared up on the left instead of stopping halfway between two. */
export function HorizontalTypes() {
  const ref = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const reduce = usePrefersReducedMotion()
  const distance = useMotionValue(0)
  const [height, setHeight] = useState<number | null>(null)
  const [stops, setStops] = useState<number[]>([])
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const x = useTransform(() => -scrollYProgress.get() * distance.get())
  const barScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  useEffect(() => {
    if (reduce) return
    const measure = () => {
      const track = trackRef.current
      if (!track) return
      const d = Math.max(0, track.scrollWidth - window.innerWidth)
      distance.set(d)
      setHeight(d + window.innerHeight)
      // Scroll offset (px into the section) at which each item's left edge sits where the
      // heading starts. Scroll maps 1:1 to sideways travel, so that is just the offset difference.
      const items = Array.from(track.children) as HTMLElement[]
      const pad = items[0]?.offsetLeft ?? 0
      const at = items.map((el) => Math.round(Math.min(d, Math.max(0, el.offsetLeft - pad))))
      setStops([...new Set(at)])
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (trackRef.current) ro.observe(trackRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [reduce, distance])

  const cards = CARDS.map((c) => (
    <Link
      key={c.n}
      href={c.href}
      className="group relative flex h-[64vh] min-h-[26rem] w-[82vw] shrink-0 flex-col justify-end overflow-hidden rounded-[2.2rem] p-8 text-[#fff6e3] sm:w-[58vw] lg:w-[40vw]"
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
  ))

  const heading = (
    <div className="shrink-0 pr-8 lg:w-[30vw]">
      <p className="text-sm font-bold tracking-[0.3em] text-accent uppercase">Four ways in</p>
      <h2 className="display mt-3 text-[clamp(2.8rem,6vw,5.5rem)] font-extrabold">
        One network of <span className="hl">Trojans.</span>
      </h2>
    </div>
  )

  if (reduce) {
    return (
      <section ref={ref} className="shell py-24">
        {heading}
        <div className="mt-10 flex gap-5 overflow-x-auto pb-4">{cards}</div>
      </section>
    )
  }

  return (
    <section ref={ref} className="relative" style={{ height: height ?? '300vh' }}>
      {stops.map((px) => <Beat key={px} top={`${px}px`} />)}
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <motion.div ref={trackRef} style={{ x }} className="flex items-center gap-6 pr-[8vw] pl-[max(1.25rem,calc((100vw-76rem)/2+2rem))]">
          {heading}
          {cards}
        </motion.div>
        <div className="absolute inset-x-0 bottom-10 mx-auto h-1 w-40 overflow-hidden rounded-full bg-line" aria-hidden>
          <motion.div className="h-full origin-left bg-gold" style={{ scaleX: barScale }} />
        </div>
      </div>
    </section>
  )
}
