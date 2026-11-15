'use client'

import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { laNow, laPhase, laTimeLabel, PHASE_LABEL, type Phase } from '@/lib/la'

const DOT: Record<Phase, string> = {
  dawn: '#ffc9a0',
  day: '#ffe58a',
  golden: '#ffb347',
  dusk: '#ff6b5e',
  night: '#8fa2ff',
}

/** "6:42 pm in LA · golden hour". The 3D city on this page is lit to match. */
export function LAClock({ delay = 0 }: { delay?: number }) {
  const [now, setNow] = useState<{ label: string; phase: Phase } | null>(null)
  useEffect(() => {
    const tick = () => {
      const t = laNow()
      setNow({ label: laTimeLabel(t), phase: laPhase(t) })
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  if (!now) return null
  return (
    <motion.span
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="chip w-fit gap-2 border-line bg-bg/40 backdrop-blur"
      title="The city behind this text is lit for the current time in Los Angeles"
    >
      <span className="size-2 rounded-full shadow-[0_0_10px_currentColor]" style={{ background: DOT[now.phase], color: DOT[now.phase] }} aria-hidden />
      {now.label} in LA · {PHASE_LABEL[now.phase]}
    </motion.span>
  )
}
