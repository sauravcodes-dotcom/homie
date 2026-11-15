'use client'

import { motion } from 'motion/react'

// A template re-mounts on every navigation: a gold line sweeps across the top while the
// new page lifts in and sharpens.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <motion.div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-cardinal via-gold to-[#fff3b8]"
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: 1, opacity: 0 }}
        transition={{ scaleX: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }, opacity: { delay: 0.55, duration: 0.3 } }}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </>
  )
}
