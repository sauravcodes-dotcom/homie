'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { isGameday, laNow } from '@/lib/la'

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* not persisted */
  }
}

/* College football Saturdays (September to early December, LA time): the site puts on its
   game colors. A marching cardinal-and-gold banner, a striped nav edge, and one burst of
   confetti the first time you visit that day. Preview any day with ?gameday=1. */
export function Gameday() {
  const [on, setOn] = useState(false)
  const [banner, setBanner] = useState(false)
  const [burst, setBurst] = useState(false)

  useEffect(() => {
    if (!isGameday()) return
    const today = laNow().date
    document.documentElement.dataset.gameday = '1'
    setOn(true)
    setBanner(read('homie-gameday-hidden') !== today)
    if (read('homie-gameday-burst') !== today && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      write('homie-gameday-burst', today)
      setBurst(true)
      const t = setTimeout(() => setBurst(false), 4200)
      return () => clearTimeout(t)
    }
  }, [])

  if (!on) return null
  return (
    <>
      <AnimatePresence initial={false}>
        {banner && (
          <motion.div
            className="gameday-stripes relative z-50 overflow-hidden"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            role="status"
          >
            <div className="shell flex items-center justify-center gap-3 py-2">
              <p className="display rounded-full bg-[#0c0505]/80 px-4 py-1 text-center text-sm font-extrabold tracking-wide text-gold uppercase sm:text-base">
                ✌ It&rsquo;s a college football Saturday. Fight On!
              </p>
              <button
                type="button"
                aria-label="Hide the gameday banner for today"
                onClick={() => {
                  write('homie-gameday-hidden', laNow().date)
                  setBanner(false)
                }}
                className="grid size-7 shrink-0 place-items-center rounded-full bg-[#0c0505]/80 text-gold hover:bg-[#0c0505]"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {burst && (
        <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden>
          {Array.from({ length: 60 }, (_, i) => {
            const fromLeft = i % 2 === 0
            const spread = ((i * 53) % 100) / 100
            return (
              <motion.span
                key={i}
                className="absolute bottom-0 block h-3.5 w-2 rounded-[2px]"
                style={{ left: fromLeft ? '0%' : '100%', background: i % 3 === 0 ? '#990000' : '#ffcc00' }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                animate={{
                  x: (fromLeft ? 1 : -1) * (180 + spread * 520),
                  y: [0, -(380 + spread * 420), 120],
                  rotate: (fromLeft ? 1 : -1) * (360 + spread * 720),
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 2.6 + spread, ease: [0.15, 0.7, 0.4, 1], delay: (i % 10) * 0.04 }}
              />
            )
          })}
        </div>
      )}
    </>
  )
}
