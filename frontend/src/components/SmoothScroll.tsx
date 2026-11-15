'use client'

import 'lenis/dist/lenis.css'
import Lenis from 'lenis'
import Snap from 'lenis/snap'
import { useEffect } from 'react'

let instance: Lenis | null = null
let snap: Snap | null = null

/** Scrolls the page to `top`, through Lenis when it is running. A plain window.scrollTo
 *  gets pulled back to Lenis's own target, so programmatic jumps must go through here. */
export function scrollPageTo(top: number, smooth = true) {
  if (instance) instance.scrollTo(top, { immediate: !smooth, force: true })
  else window.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' })
}

/* ---------- Beats: resting points the page settles onto when scrolling stops ---------- */
type Align = 'start' | 'center' | 'end'
const beats = new Map<HTMLElement, { align: Align; remove?: () => void }>()

function attach(el: HTMLElement, align: Align) {
  const entry = beats.get(el)
  if (snap && entry) entry.remove = snap.addElement(el, { align: [align] })
}

/** Registers an element as a beat. With Lenis (mouse and trackpad) the page eases onto the
 *  nearest beat once scrolling stops. Without it (touch) the `.beat` CSS class does the same
 *  through native scroll-snap. Returns an unregister function. */
export function addBeat(el: HTMLElement, align: Align = 'start') {
  beats.set(el, { align })
  attach(el, align)
  return () => {
    beats.get(el)?.remove?.()
    beats.delete(el)
  }
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
    // Proximity: only settles when the page stops near a beat, so free-flowing parts stay free.
    snap = new Snap(lenis, {
      type: 'proximity',
      distanceThreshold: '45%',
      debounce: 220,
      duration: 0.9,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    })
    beats.forEach((b, el) => attach(el, b.align))
    return () => {
      beats.forEach((b) => (b.remove = undefined))
      snap?.destroy()
      snap = null
      instance = null
      lenis.destroy()
    }
  }, [])
  return null
}
