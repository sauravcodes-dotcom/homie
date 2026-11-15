'use client'

import 'lenis/dist/lenis.css'
import Lenis from 'lenis'
import { useEffect } from 'react'

let instance: Lenis | null = null

/** Scrolls the page to `top`, through Lenis when it is running. A plain window.scrollTo
 *  gets pulled back to Lenis's own target, so programmatic jumps must go through here. */
export function scrollPageTo(top: number, smooth = true) {
  if (instance) instance.scrollTo(top, { immediate: !smooth, force: true })
  else window.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' })
}

/** Inertial wheel scrolling on mouse and trackpad. Touch keeps native scrolling, and
 *  Lenis turns smoothing off for visitors who ask for reduced motion. */
export function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const lenis = new Lenis({
      // Higher lerp tracks the wheel more closely; low values feel floaty and slow to stop.
      lerp: 0.2,
      autoRaf: true,
      anchors: { offset: -88 },
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
    })
    instance = lenis
    return () => {
      instance = null
      lenis.destroy()
    }
  }, [])
  return null
}
