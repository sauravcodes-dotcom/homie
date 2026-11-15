'use client'

import { motion, type Variants } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/hooks'

const TEXT =
  'Finding a place near campus means group chats, spreadsheets, sketchy listings and a lot of hoping. HOMIE puts the room, the roommates and the truth about the building in one place.'
const GOLD = new Set(['HOMIE', 'room,', 'roommates', 'truth', 'one', 'place.'])

const paragraph: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.035 } } }
const word: Variants = {
  hidden: { opacity: 0.12, y: '0.25em' },
  shown: { opacity: 1, y: '0em', transition: { duration: 0.5, ease: [0.2, 0.9, 0.2, 1] } },
}

/** The problem and the turn. Words light up one after another when the paragraph comes into
 *  view (in about two seconds), then the page keeps scrolling normally. */
export function WordReveal() {
  const reduce = usePrefersReducedMotion()
  const words = TEXT.split(' ')

  return (
    <section className="py-28 sm:py-36" aria-label="Why HOMIE">
      <motion.p
        className="shell display max-w-6xl text-[clamp(2.1rem,5.4vw,4.9rem)] font-extrabold"
        variants={paragraph}
        initial={reduce ? false : 'hidden'}
        whileInView="shown"
        viewport={{ once: true, amount: 0.35 }}
      >
        {words.map((w, i) => (
          <motion.span key={i} variants={word} className={`mr-[0.26em] inline-block ${GOLD.has(w) ? 'hl' : ''}`}>
            {w}
          </motion.span>
        ))}
      </motion.p>
    </section>
  )
}
