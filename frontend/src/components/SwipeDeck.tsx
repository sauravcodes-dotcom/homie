'use client'

import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'

type Direction = 'save' | 'pass'

const THRESHOLD = 110

function Card({
  children,
  active,
  depth,
  forced,
  onSwipe,
}: {
  children: React.ReactNode
  active: boolean
  depth: number
  forced: Direction | null
  onSwipe: (d: Direction) => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-260, 260], [-14, 14])
  const saveOpacity = useTransform(x, [30, 130], [0, 1])
  const passOpacity = useTransform(x, [-130, -30], [1, 0])
  const [exit, setExit] = useState<Direction | null>(null)
  const leaving = forced ?? exit

  const end = (_: unknown, info: PanInfo) => {
    const far = Math.abs(info.offset.x) > THRESHOLD || Math.abs(info.velocity.x) > 650
    if (!far) return
    const d: Direction = info.offset.x > 0 ? 'save' : 'pass'
    setExit(d)
    onSwipe(d)
  }

  return (
    <motion.div
      className="absolute inset-0 touch-pan-y"
      style={{ x, rotate, zIndex: 10 - depth }}
      drag={active ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={end}
      initial={{ scale: 0.9, y: 40, opacity: 0 }}
      animate={{ scale: 1 - depth * 0.045, y: depth * 16, opacity: depth > 2 ? 0 : 1 }}
      exit={{
        x: leaving === 'pass' ? -700 : 700,
        rotate: leaving === 'pass' ? -24 : 24,
        opacity: 0,
        transition: { duration: 0.35, ease: 'easeIn' },
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      whileDrag={{ cursor: 'grabbing' }}
    >
      <div className={`card relative h-full overflow-hidden shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] ${active ? 'cursor-grab' : ''}`}>
        {children}
        {active && (
          <>
            <motion.span
              style={{ opacity: saveOpacity }}
              className="display pointer-events-none absolute top-6 left-6 -rotate-12 rounded-xl border-4 border-gold px-3 py-1 text-4xl font-extrabold text-gold"
              aria-hidden
            >
              SAVE
            </motion.span>
            <motion.span
              style={{ opacity: passOpacity }}
              className="display pointer-events-none absolute top-6 right-6 rotate-12 rounded-xl border-4 border-[#ff6b5e] px-3 py-1 text-4xl font-extrabold text-[#ff6b5e]"
              aria-hidden
            >
              PASS
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
      setIndex((i) => i + 1)
    },
    [index, items, onSwipe],
  )

  const press = useCallback(
    (direction: Direction) => {
      if (!items[index]) return
      setForced(direction)
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
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
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
                  onSwipe={commit}
                >
                  {render(item)}
                </Card>
              ))
              .reverse()}
          </AnimatePresence>
        )}
      </div>

      {!done && (
        <div className="mt-10 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => press('pass')}
            aria-label="Pass"
            className="grid size-16 place-items-center rounded-full border-2 border-line bg-surface text-bad transition-transform hover:scale-110 hover:border-bad active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="size-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <span className="text-xs text-ink-soft">
            {index + 1} of {items.length} · arrow keys work too
          </span>
          <button
            type="button"
            onClick={() => press('save')}
            aria-label="Save"
            className="grid size-16 place-items-center rounded-full bg-gold text-[#1d0808] shadow-[0_14px_40px_-10px_rgba(255,204,0,0.8)] transition-transform hover:scale-110 active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
              <path d="M12 21s-8-5-9.5-10.200C1.500 7.300 3.800 4.500 6.900 4.500c2 0 3.700 1.100 5.100 3 1.400-1.900 3.100-3 5.100-3 3.100 0 5.400 2.800 4.400 6.300C20 16 12 21 12 21z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
