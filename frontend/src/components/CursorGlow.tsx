'use client'

import { useEffect, useRef } from 'react'

/** A soft light that trails the pointer. Skipped on touch devices. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia('(pointer: fine)').matches) return
    let frame = 0
    let x = window.innerWidth / 2
    let y = -200
    const move = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!frame) {
        frame = requestAnimationFrame(() => {
          el.style.setProperty('--mx', `${x}px`)
          el.style.setProperty('--my', `${y}px`)
          frame = 0
        })
      }
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={ref} className="cursor-glow" aria-hidden />
}
