'use client'

import { MotionConfig } from 'motion/react'

/** Visitors who ask the OS for reduced motion get fades instead of movement everywhere. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
