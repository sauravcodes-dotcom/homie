'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'

/** Tilts its child in 3D toward the mouse, with a soft glare. Mouse only. */
export function Tilt({ children, className = '', max = 8 }: { children: React.ReactNode; className?: string; max?: number }) {
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 200, damping: 20 })
  const sy = useSpring(py, { stiffness: 200, damping: 20 })
  const rotateY = useTransform(sx, [0, 1], [-max, max])
  const rotateX = useTransform(sy, [0, 1], [max, -max])
  // The glare only exists while the mouse is over the card.
  const glareOpacity = useSpring(0, { stiffness: 200, damping: 25 })
  const glare = useTransform(() => `radial-gradient(420px circle at ${sx.get() * 100}% ${sy.get() * 100}%, rgba(255,204,0,0.18), transparent 60%)`)

  return (
    <div className={`[perspective:1000px] ${className}`}>
      <motion.div
        className="relative h-full [transform-style:preserve-3d]"
        style={{ rotateX, rotateY }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return
          const r = e.currentTarget.getBoundingClientRect()
          glareOpacity.set(1)
          px.set((e.clientX - r.left) / r.width)
          py.set((e.clientY - r.top) / r.height)
        }}
        onPointerLeave={() => {
          glareOpacity.set(0)
          px.set(0.5)
          py.set(0.5)
        }}
      >
        {children}
        <motion.div className="pointer-events-none absolute inset-0 rounded-[24px]" style={{ background: glare, opacity: glareOpacity }} aria-hidden />
      </motion.div>
    </div>
  )
}
