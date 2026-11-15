'use client'

import 'lenis/dist/lenis.css'
import Lenis from 'lenis'
import { useEffect } from 'react'

/** Inertial wheel scrolling on mouse and trackpad. Touch keeps native scrolling, and
 *  Lenis turns smoothing off for visitors who ask for reduced motion. */
export function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const lenis = new Lenis({
      lerp: 0.11,
      autoRaf: true,
      anchors: { offset: -88 },
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
    })
    return () => lenis.destroy()
  }, [])
  return null
}
