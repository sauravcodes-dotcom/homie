'use client'

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { usePrefersReducedMotion } from '@/lib/hooks'

const TEXT =
  'Finding a place near campus means group chats, spreadsheets, sketchy listings and a lot of hoping. HOMIE puts the room, the roommates and the truth about the building in one place.'
const GOLD = new Set(['HOMIE', 'room,', 'roommates', 'truth', 'one', 'place.'])

function Word({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.12, 1])
  const y = useTransform(progress, range, ['0.25em', '0em'])
  return (
    <motion.span style={{ opacity, y }} className={`mr-[0.26em] inline-block ${GOLD.has(word) ? 'hl' : ''}`}>
      {word}
    </motion.span>
  )
}

/** A pinned paragraph whose words light up one by one as you scroll. */
export function WordReveal() {
  const ref = useRef<HTMLElement>(null)
  const reduce = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const words = TEXT.split(' ')
  const span = 0.8 / words.length

  return (
    <section ref={ref} className={`relative ${reduce ? 'py-24' : 'h-[260vh]'}`} aria-label="Why HOMIE">
      <div className={`${reduce ? '' : 'sticky top-0 flex h-dvh items-center'}`}>
        <p className="shell display max-w-6xl text-[clamp(2.1rem,5.4vw,4.9rem)] font-extrabold">
          {reduce
            ? TEXT
            : words.map((w, i) => (
                <Word key={i} word={w} progress={scrollYProgress} range={[0.05 + i * span, 0.05 + (i + 1.6) * span]} />
              ))}
        </p>
      </div>
    </section>
  )
}
