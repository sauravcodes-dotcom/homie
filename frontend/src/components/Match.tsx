'use client'

import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect } from 'react'
import type { MatchResult } from '@/lib/api'
import { FACTOR_LABEL } from '@/lib/format'

const tone = (score: number) => (score >= 75 ? 'var(--ok)' : score >= 50 ? 'var(--gold)' : 'var(--bad)')

/** Circular match score that counts up when it appears or changes. */
export function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const value = useMotionValue(0)
  const text = useTransform(value, (v) => Math.round(v).toString())
  const r = 42
  const circumference = 2 * Math.PI * r
  const offset = useTransform(value, (v) => circumference * (1 - v / 100))

  useEffect(() => {
    const controls = animate(value, score, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] })
    return () => controls.stop()
  }, [score, value])

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Match score ${score} out of 100`}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={tone(score)}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <motion.span
        className="display absolute inset-0 grid place-items-center font-extrabold"
        style={{ fontSize: size * 0.36 }}
      >
        {text}
      </motion.span>
    </div>
  )
}

export function FactorBars({ match, dense = false }: { match: MatchResult; dense?: boolean }) {
  return (
    <ul className={`grid ${dense ? 'gap-2' : 'gap-3'}`}>
      {match.factors.map((f, i) => (
        <li key={f.factor} className="grid grid-cols-[4.6rem_1fr] items-center gap-x-3 gap-y-1">
          <span className="text-sm font-semibold">{FACTOR_LABEL[f.factor]}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.span
              className="block h-full rounded-full"
              style={{ background: tone(f.score * 100) }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, f.score * 100)}%` }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </span>
          <span className="col-start-2 text-xs leading-snug text-ink-soft">{f.reason}</span>
        </li>
      ))}
    </ul>
  )
}
