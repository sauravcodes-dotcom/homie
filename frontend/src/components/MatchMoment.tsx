'use client'

import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { post, type Conversation, type RoommateCard } from '@/lib/api'

const R = 54
const C = 2 * Math.PI * R

function Avatar({ name, from }: { name: string; from: 'left' | 'right' }) {
  return (
    <motion.div
      className={`grid size-28 place-items-center rounded-full border-4 border-gold text-5xl font-extrabold shadow-[0_0_60px_rgba(255,204,0,0.45)] sm:size-36 ${from === 'left' ? 'bg-cardinal text-gold' : 'bg-gold text-cardinal'}`}
      initial={{ x: from === 'left' ? -260 : 260, rotate: from === 'left' ? -25 : 25, opacity: 0 }}
      animate={{ x: from === 'left' ? 18 : -18, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 170, damping: 15, delay: 0.15 }}
    >
      <span className="display">{name.trim()[0]?.toUpperCase() ?? '?'}</span>
    </motion.div>
  )
}

/** Both of you saved each other: a short full-screen beat, then straight into a chat. */
export function MatchMoment({ card, me, onClose }: { card: RoommateCard | null; me: string; onClose: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const progress = useMotionValue(0)
  const dash = useTransform(progress, (p) => C * (1 - p / 100))
  const [score, setScore] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!card) return
    setScore(0)
    progress.set(0)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const c = animate(progress, card.match.score, {
      duration: reduce ? 0 : 1.4,
      delay: reduce ? 0 : 0.7,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setScore(Math.round(v)),
    })
    try {
      navigator.vibrate?.([20, 60, 20, 60, 40])
    } catch {
      /* no haptics */
    }
    const t = setTimeout(() => button.current?.focus(), 400)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      c.stop()
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [card, progress, onClose])

  const sayHi = async () => {
    if (!card) return
    setBusy(true)
    setError(null)
    try {
      const conv = await post<Conversation>('/conversations', {
        user_id: card.user.id,
        body: `Hi ${card.user.display_name.split(' ')[0]}! We matched on HOMIE. Want to talk about rooming together?`,
      })
      router.push(`/messages?c=${conv.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the chat')
      setBusy(false)
    }
  }

  // Portalled to <body> so the page-transition wrapper cannot trap it under the nav.
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {card && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center overflow-hidden px-6"
          role="dialog"
          aria-modal="true"
          aria-label={`It's a match with ${card.user.display_name}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#990000_0%,#4d0000_45%,#0c0505_100%)]"
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={onClose}
            aria-hidden
          />
          {/* Gold confetti */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {Array.from({ length: 36 }, (_, i) => {
              const left = (i * 37) % 100
              return (
                <motion.span
                  key={i}
                  className="absolute top-0 block h-3 w-1.5 rounded-sm"
                  style={{ left: `${left}%`, background: i % 3 ? '#ffcc00' : '#fff3b8' }}
                  initial={{ y: -40, rotate: 0, opacity: 0 }}
                  animate={{ y: '110vh', rotate: 360 * (i % 2 ? 1 : -1) * 2, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.4 + (i % 5) * 0.35, delay: 0.3 + (i % 9) * 0.08, ease: 'easeIn' }}
                />
              )
            })}
          </div>

          <div className="relative grid justify-items-center text-center text-[#fff6e3]">
            <motion.p
              className="text-sm font-bold tracking-[0.35em] text-gold uppercase"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Fight on, roommates
            </motion.p>
            <motion.h2
              className="display mt-2 text-[clamp(3rem,11vw,6.5rem)] leading-none font-extrabold"
              initial={{ scale: 0.4, opacity: 0, letterSpacing: '0.3em' }}
              animate={{ scale: 1, opacity: 1, letterSpacing: '-0.02em' }}
              transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.05 }}
            >
              It&rsquo;s a match!
            </motion.h2>
            <p className="mt-3 max-w-sm text-[#fff6e3]/80">
              You and {card.user.display_name} both saved each other.
            </p>

            <div className="relative mt-10 flex items-center">
              <Avatar name={me} from="left" />
              <motion.div
                className="relative z-10 -mx-3 grid size-32 place-items-center rounded-full bg-[#0c0505]"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.55 }}
              >
                <svg viewBox="0 0 128 128" className="absolute inset-0 size-full -rotate-90" aria-hidden>
                  <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,204,0,0.18)" strokeWidth="9" />
                  <motion.circle cx="64" cy="64" r={R} fill="none" stroke="#ffcc00" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} style={{ strokeDashoffset: dash }} />
                </svg>
                <span className="display text-4xl font-extrabold text-gold tabular-nums">{score}</span>
              </motion.div>
              <Avatar name={card.user.display_name} from="right" />
            </div>
            <p className="mt-3 text-xs tracking-widest text-[#fff6e3]/70 uppercase">Match score</p>

            {card.match.highlights[0] && (
              <motion.p className="mt-5 max-w-sm text-sm text-[#fff6e3]/85" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
                ✓ {card.match.highlights[0]}
              </motion.p>
            )}

            <motion.div
              className="mt-8 flex flex-wrap justify-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
            >
              <button ref={button} type="button" className="btn btn-gold px-8 py-3.5 text-base" onClick={sayHi} disabled={busy}>
                {busy ? 'Opening chat…' : 'Say hi 👋'}
              </button>
              <button type="button" className="btn border border-[#fff6e3]/30 px-6 py-3.5 text-[#fff6e3]" onClick={onClose}>
                Keep swiping
              </button>
            </motion.div>
            {error && <p role="alert" className="mt-3 text-sm text-[#ffb3ab]">{error}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
