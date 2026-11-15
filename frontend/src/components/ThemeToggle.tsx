'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { laPhase } from '@/lib/la'

type Choice = 'dark' | 'light' | 'la'
const NEXT: Record<Choice, Choice> = { dark: 'light', light: 'la', la: 'dark' }
const LABEL: Record<Choice, string> = { dark: 'Dark theme', light: 'Light theme', la: 'Follows daylight in LA' }

/** Light during the LA day, dark from dusk. Mirrors the inline script in layout.tsx. */
export const laTheme = () => (['day', 'dawn', 'golden'].includes(laPhase()) ? 'light' : 'dark')

function apply(choice: Choice) {
  document.documentElement.dataset.theme = choice === 'la' ? laTheme() : choice
  document.documentElement.dataset.themeChoice = choice
}

/** Cycles dark → light → "LA time" (switches itself at sunrise and dusk in Los Angeles). */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice | null>(null)

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem('homie-theme')
    } catch {
      /* private mode */
    }
    const initial: Choice =
      saved === 'light' || saved === 'dark' || saved === 'la'
        ? saved
        : window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
    setChoice(initial)
  }, [])

  // In LA mode, re-check every few minutes so the theme turns at sunset on its own.
  useEffect(() => {
    if (choice !== 'la') return
    const id = setInterval(() => apply('la'), 5 * 60_000)
    return () => clearInterval(id)
  }, [choice])

  const cycle = () => {
    const next = NEXT[choice ?? 'dark']
    apply(next)
    try {
      localStorage.setItem('homie-theme', next)
    } catch {
      /* not persisted */
    }
    setChoice(next)
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[choice ?? 'dark']}. Switch to ${LABEL[NEXT[choice ?? 'dark']].toLowerCase()}`}
      title={LABEL[choice ?? 'dark']}
      className="relative grid size-9 place-items-center overflow-hidden rounded-full border border-line text-ink-soft hover:border-accent hover:text-ink"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={choice ?? 'none'}
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
          initial={{ y: 14, rotate: -60, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -14, rotate: 60, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {choice === 'light' ? (
            <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
          ) : choice === 'la' ? (
            <>
              {/* Sun setting over a horizon: follows LA daylight */}
              <path d="M3 18h18M6 14a6 6 0 0 1 12 0" />
              <path d="M12 4v2M4.9 7.1l1.4 1.4M19.1 7.1l-1.4 1.4" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          )}
        </motion.svg>
      </AnimatePresence>
      {choice === 'la' && <span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-gold" aria-hidden />}
    </button>
  )
}
