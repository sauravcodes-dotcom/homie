'use client'

import { animate, motion, useInView, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/hooks'

const STATS = [
  { value: 5, label: 'match factors behind every score', detail: 'rent, dates, location, lifestyle and vibe' },
  { value: 8, label: 'lifestyle signals', detail: 'from sleep schedule and guests to diet and pets' },
  { value: 100, label: 'public reviews sampled', detail: 'when a building has fewer than 5 HOMIE reviews' },
  { value: 0, label: 'passwords', detail: 'sign in with a code sent to your USC email' },
]

function Counter({ to, run }: { to: number; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!run || !ref.current) return
    const node = ref.current
    const from = to === 0 ? 9 : 0
    const controls = animate(from, to, {
      duration: 1.4,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => (node.textContent = Math.round(v).toLocaleString()),
    })
    return () => controls.stop()
  }, [run, to])
  return <span ref={ref}>{run ? to : 0}</span>
}

function Stats({ run }: { run: boolean }) {
  return (
    <div className="relative isolate flex h-full items-center overflow-hidden bg-cardinal text-[#fff6e3]">
      <div className="absolute inset-0 -z-10" aria-hidden>
        {/* Drifting light blobs. Radial gradients look like the old 120px blur but are
            free to move; animating two screen-sized blurred layers forever cost every frame. */}
        <motion.div className="absolute -top-1/4 -left-1/4 size-[70vmax] rounded-full opacity-40 will-change-transform" style={{ background: 'radial-gradient(circle at center, #ffcc00 0%, #ffcc00 30%, transparent 70%)' }} animate={{ x: ['0%', '30%', '0%'], y: ['0%', '20%', '0%'] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute -right-1/4 -bottom-1/4 size-[60vmax] rounded-full opacity-40 will-change-transform" style={{ background: 'radial-gradient(circle at center, #ff5a1f 0%, #ff5a1f 30%, transparent 70%)' }} animate={{ x: ['0%', '-25%', '0%'], y: ['0%', '-15%', '0%'] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="absolute inset-0 bg-[#4d0000]/40" />
      </div>
      <div className="shell py-20">
        <p className="text-sm font-bold tracking-[0.3em] text-gold uppercase">By design</p>
        <h2 className="display mt-3 max-w-3xl text-[clamp(2.4rem,6vw,5rem)] font-extrabold">Built the way Trojans actually look for housing.</h2>
        <dl className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="border-t-2 border-gold/60 pt-5">
              <dt className="sr-only">{s.label}</dt>
              <dd className="display text-[clamp(4rem,9vw,7.5rem)] leading-none font-extrabold text-gold tabular-nums">
                <Counter to={s.value} run={run} />
              </dd>
              <dd className="mt-3 text-lg font-bold">{s.label}</dd>
              <dd className="mt-1 text-sm text-[#fff6e3]/75">{s.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

/** Giant "HOMIE" cut out of the page, showing the section behind it. Scrolling dives into the
 *  stroke of the "I" until the letter fills the screen, then the cut-out fades away. */
export function LetterZoom() {
  const ref = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const textRef = useRef<SVGTextElement>(null)
  const reduce = usePrefersReducedMotion()
  const [origin, setOrigin] = useState('50% 50%')
  const [revealed, setRevealed] = useState(false)
  const plainInView = useInView(ref, { once: true, amount: 0.4 })

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const scale = useTransform(scrollYProgress, [0.08, 0.68], [1, 70], { ease: (t) => t * t * t })
  const overlayOpacity = useTransform(scrollYProgress, [0.55, 0.7], [1, 0])
  const hintOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0])
  useMotionValueEvent(scrollYProgress, 'change', (v) => v > 0.62 && setRevealed(true))

  // Zoom toward the middle of the "I" stroke (measured, since it depends on the font and screen).
  // A stroke, not a letter's hole: the hole is page background and would black out the screen.
  useEffect(() => {
    if (reduce) return
    const measure = () => {
      const svg = svgRef.current
      const text = textRef.current
      if (!svg || !text || scale.get() > 1.001 || text.getNumberOfChars() < 4) return
      const box = text.getExtentOfChar(3)
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const pt = svg.createSVGPoint()
      pt.x = box.x + box.width / 2
      pt.y = box.y + box.height / 2
      const s = pt.matrixTransform(ctm)
      const r = svg.getBoundingClientRect()
      setOrigin(`${s.x - r.left}px ${s.y - r.top}px`)
    }
    void document.fonts?.ready.then(measure)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [reduce, scale])

  if (reduce) {
    return (
      <section ref={ref}>
        <Stats run={plainInView} />
      </section>
    )
  }

  return (
    <section ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div className="absolute inset-0"><Stats run={revealed} /></div>
        <motion.svg
          ref={svgRef}
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          viewBox="0 0 1000 400"
          preserveAspectRatio="xMidYMid meet"
          style={{ scale, opacity: overlayOpacity, transformOrigin: origin }}
          aria-hidden
        >
          <defs>
            <mask id="homie-letters" maskUnits="userSpaceOnUse" x="-20000" y="-20000" width="41000" height="40400">
              <rect x="-20000" y="-20000" width="41000" height="40400" fill="white" />
              <text
                ref={textRef}
                x="500"
                y="205"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="330"
                fontWeight="800"
                style={{ fontFamily: 'var(--font-bricolage)', fontVariationSettings: "'wdth' 78", letterSpacing: '-0.04em' }}
                fill="black"
              >
                HOMIE
              </text>
            </mask>
          </defs>
          <rect x="-20000" y="-20000" width="41000" height="40400" style={{ fill: 'var(--bg)' }} mask="url(#homie-letters)" />
        </motion.svg>
        <motion.p style={{ opacity: hintOpacity }} className="absolute inset-x-0 bottom-10 text-center text-xs font-bold tracking-[0.35em] text-ink-soft uppercase" aria-hidden>
          Keep scrolling
        </motion.p>
        <h2 className="sr-only">HOMIE by design</h2>
      </div>
    </section>
  )
}
