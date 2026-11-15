'use client'

import { useEffect, useRef } from 'react'
import { addBeat } from '@/components/SmoothScroll'

/** Scroll offset, inside a pinned section `heightVh` tall with a one-screen sticky stage, at which
 *  the section's own progress (0 to 1) equals `p`. */
export const beatTop = (p: number, heightVh: number) => `${p * (heightVh - 100)}vh`

/** An invisible resting point. Place it inside a `relative` section at the scroll offset where
 *  that section's composition is complete, and the page settles there when scrolling stops. */
export function Beat({ top, align = 'start' }: { top: string; align?: 'start' | 'center' | 'end' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => (ref.current ? addBeat(ref.current, align) : undefined), [align])
  return <div ref={ref} className={`beat beat-${align} pointer-events-none absolute inset-x-0 h-px`} style={{ top }} aria-hidden />
}
