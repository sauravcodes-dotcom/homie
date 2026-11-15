'use client'

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

type Direction = 'save' | 'pass'

const THRESHOLD = 110
const buzz = (ms: number | number[]) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* no haptics */
  }
}

/* The card has weight: it tilts from where you grabbed it, the
   card under it rises to meet you as you pull, stamps press in past the threshold, and a
   phone ticks once when you cross it and again when the card flies. */
function Card({
  children,
  active,
  depth,
  forced,
  pull,
  onSwipe,
}: {
  children: React.ReactNode
  active: boolean
  depth: number
  forced: Direction | null
  pull: MotionValue<number>
  onSwipe: (d: Direction) => void
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const grabY = useRef(0.5) // 0 top .. 1 bottom of the card
  // Grab near the top and the card swings from its base; grab low and it pivots the other way.
  const rotate = useTransform(x, (v) => (v / 260) * 16 * (grabY.current < 0.5 ? 1 : -0.6))
  const saveOpacity = useTransform(x, [25, THRESHOLD], [0, 1])
  const passOpacity = useTransform(x, [-THRESHOLD, -25], [1, 0])
  const saveScale = useTransform(x, [25, THRESHOLD, THRESHOLD + 60], [1.6, 1, 0.92])
  const passScale = useTransform(x, [-THRESHOLD - 60, -THRESHOLD, -25], [0.92, 1, 1.6])
  const saveGlow = useTransform(x, [0, THRESHOLD * 1.6], [0, 0.55])
  const passGlow = useTransform(x, [-THRESHOLD * 1.6, 0], [0.55, 0])
  const [exit, setExit] = useState<Direction | null>(null)
  const [velocity, setVelocity] = useState(0)
  const leaving = forced ?? exit
  const crossed = useRef(false)

  useMotionValueEvent(x, 'change', (v) => {
    if (!active) return
    pull.set(Math.min(1, Math.abs(v) / THRESHOLD))
    const over = Math.abs(v) > THRESHOLD
    if (over !== crossed.current) {
      crossed.current = over
      if (over) buzz(8)
    }
  })

  const start = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement | null)?.getBoundingClientRect?.()
    if (r) grabY.current = (e.clientY - r.top) / r.height
  }
  const end = (_: unknown, info: PanInfo) => {
    const far = Math.abs(info.offset.x) > THRESHOLD || Math.abs(info.velocity.x) > 650
    if (!far) {
      pull.set(0)
      return
    }
    const d: Direction = info.offset.x > 0 ? 'save' : 'pass'
    setVelocity(info.velocity.x)
    setExit(d)
    buzz(d === 'save' ? [12, 40, 18] : 14)
    onSwipe(d)
  }

  // Cards underneath scale up toward the front as the top card is pulled away.
  const restScale = 1 - depth * 0.05
  const nextScale = useTransform(pull, [0, 1], [restScale, restScale + 0.05])
  const nextY = useTransform(pull, [0, 1], [depth * 18, (depth - 1) * 18])

  const flyX = (leaving === 'pass' ? -1 : 1) * Math.max(760, Math.abs(velocity) * 0.6)

  return (
    <motion.div
      className="absolute inset-0 touch-pan-y"
      style={{
        x: active ? x : 0,
        y: active ? y : nextY,
        rotate: active ? rotate : 0,
        scale: active ? 1 : nextScale,
        zIndex: 10 - depth,
      }}
      drag={active}
      dragSnapToOrigin
      dragElastic={{ left: 0.9, right: 0.9, top: 0.25, bottom: 0.25 }}
      dragTransition={{ bounceStiffness: 520, bounceDamping: 26 }}
      onDragStart={(e) => start(e as PointerEvent)}
      onDragEnd={end}
      initial={{ opacity: 0 }}
      animate={{ opacity: depth > 2 ? 0 : 1 }}
      exit={{
        x: flyX,
        y: -40,
        rotate: leaving === 'pass' ? -28 : 28,
        opacity: 0,
        transition: { duration: 0.42, ease: [0.3, 0, 0.6, 1] },
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      whileDrag={{ cursor: 'grabbing' }}
    >
      <div className={`card relative h-full overflow-hidden shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] ${active ? 'cursor-grab' : ''}`}>
        {children}
        {active && (
          <>
            <motion.div style={{ opacity: saveGlow }} className="pointer-events-none absolute inset-0 bg-gradient-to-l from-gold/70 via-gold/10 to-transparent" aria-hidden />
            <motion.div style={{ opacity: passGlow }} className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cardinal/80 via-cardinal/10 to-transparent" aria-hidden />
            <motion.span
              style={{ opacity: saveOpacity, scale: saveScale }}
              className="display pointer-events-none absolute top-7 left-6 flex -rotate-12 items-center gap-2 rounded-2xl border-4 border-gold bg-black/30 px-4 py-1.5 text-4xl font-extrabold text-gold shadow-[0_0_40px_rgba(255,204,0,0.5)] backdrop-blur-sm"
              aria-hidden
            >
              ★ SAVE
            </motion.span>
            <motion.span
              style={{ opacity: passOpacity, scale: passScale }}
              className="display pointer-events-none absolute top-7 right-6 flex rotate-12 items-center gap-2 rounded-2xl border-4 border-[#ff6b5e] bg-black/30 px-4 py-1.5 text-4xl font-extrabold text-[#ff6b5e] backdrop-blur-sm"
              aria-hidden
            >
              ✕ PASS
            </motion.span>
          </>
        )}
      </div>
    </motion.div>
  )
}

/** A stack of draggable cards. Drag, use the buttons, or press the arrow keys. */
export function SwipeDeck<T>({
  items,
  getKey,
  render,
  onSwipe,
  empty,
}: {
  items: T[]
  getKey: (item: T) => string | number
  render: (item: T) => React.ReactNode
  onSwipe: (item: T, direction: Direction) => void
  empty: React.ReactNode
}) {
  const [index, setIndex] = useState(0)
  const [forced, setForced] = useState<Direction | null>(null)
  const [burst, setBurst] = useState(0)
  const pull = useMotionValue(0)

  // A new list (e.g. switching tabs) starts the stack over.
  useEffect(() => {
    setIndex(0)
    setForced(null)
  }, [items])

  const commit = useCallback(
    (direction: Direction) => {
      const item = items[index]
      if (!item) return
      onSwipe(item, direction)
      if (direction === 'save') setBurst((b) => b + 1)
      pull.set(0)
      setIndex((i) => i + 1)
    },
    [index, items, onSwipe, pull],
  )

  const press = useCallback(
    (direction: Direction) => {
      if (!items[index]) return
      setForced(direction)
      buzz(direction === 'save' ? [12, 40, 18] : 14)
      // Let the exit direction reach the card before it unmounts.
      requestAnimationFrame(() => {
        commit(direction)
        setTimeout(() => setForced(null), 50)
      })
    },
    [commit, index, items],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight') press('save')
      if (e.key === 'ArrowLeft') press('pass')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  const visible = items.slice(index, index + 3)
  const done = index >= items.length

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative h-[34rem]">
        {done ? (
          <div className="absolute inset-0">{empty}</div>
        ) : (
          <AnimatePresence>
            {visible
              .map((item, depth) => (
                <Card
                  key={getKey(item)}
                  active={depth === 0}
                  depth={depth}
                  forced={depth === 0 ? forced : null}
                  pull={pull}
                  onSwipe={commit}
                >
                  {render(item)}
                </Card>
              ))
              .reverse()}
          </AnimatePresence>
        )}
        <SaveBurst key={burst} show={burst > 0} />
      </div>

      {!done && (
        <div className="mt-10 flex items-center justify-center gap-6">
          <motion.button
            type="button"
            onClick={() => press('pass')}
            aria-label="Pass"
            whileHover={{ scale: 1.1, rotate: -8 }}
            whileTap={{ scale: 0.88 }}
            className="grid size-16 place-items-center rounded-full border-2 border-line bg-surface text-bad hover:border-bad"
          >
            <svg viewBox="0 0 24 24" className="size-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </motion.button>
          <span className="text-xs text-ink-soft tabular-nums">
            {index + 1} of {items.length} · arrow keys work too
          </span>
          <motion.button
            type="button"
            onClick={() => press('save')}
            aria-label="Save"
            whileHover={{ scale: 1.1, rotate: 8 }}
            whileTap={{ scale: 0.88 }}
            className="grid size-16 place-items-center rounded-full bg-gold text-[#1d0808] shadow-[0_14px_40px_-10px_rgba(255,204,0,0.8)]"
          >
            <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
              <path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
            </svg>
          </motion.button>
        </div>
      )}
    </div>
  )
}

/** Gold stars burst from the save side when a card is saved. */
function SaveBurst({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => {
        const angle = -Math.PI / 2 + (i / 13 - 0.5) * Math.PI * 1.1
        const dist = 120 + (i % 3) * 50
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 right-6 text-xl text-gold"
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(angle) * dist * 0.7 + 40, y: Math.sin(angle) * dist, scale: 1, opacity: 0, rotate: 180 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.3, 1] }}
          >
            ★
          </motion.span>
        )
      })}
    </div>
  )
}
