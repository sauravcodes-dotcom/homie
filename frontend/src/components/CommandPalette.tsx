'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { get, type Building, type Listing } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { TYPE_LABEL, usd } from '@/lib/format'
import { rememberListing } from '@/lib/peek'

const OPEN_EVENT = 'homie:palette'

const lockPageScroll = (locked: boolean) => {
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

/** Opens the command palette from anywhere (the nav button uses this). */
export const openPalette = () => window.dispatchEvent(new Event(OPEN_EVENT))

type Item = { id: string; group: string; label: string; hint?: string; href: string; onPick?: () => void }

const PAGES: (Omit<Item, 'id' | 'group'> & { auth?: boolean })[] = [
  { label: 'Discover', hint: 'Swipe rooms and roommates', href: '/discover' },
  { label: 'Find my match', hint: 'Score listings against what you want', href: '/match' },
  { label: 'Browse listings', hint: 'Every sublease, takeover and room', href: '/listings' },
  { label: 'Buildings', hint: 'Resident reviews and ratings', href: '/buildings' },
  { label: 'Map', hint: 'Listings by walk time to campus', href: '/map' },
  { label: 'Post a listing', hint: 'Sublease, takeover, room or roommate', href: '/listings/new', auth: true },
  { label: 'Saved', hint: 'Places and people you kept', href: '/saved', auth: true },
  { label: 'Messages', href: '/messages', auth: true },
  { label: 'My preferences', hint: 'Budget, dates and how you live', href: '/onboarding', auth: true },
  { label: 'Sign in', hint: 'With your USC email', href: '/login', auth: false },
]

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/** ⌘K / Ctrl+K (or "/") palette: jump to any page, listing or building from the keyboard. */
export function CommandPalette() {
  const router = useRouter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [listings, setListings] = useState<Listing[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const uid = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null
    lockPageScroll(true)
    requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      lockPageScroll(false)
      returnFocus.current?.focus?.()
    }
  }, [open])

  // Live search, debounced. Short queries only filter the page list.
  const term = q.trim()
  useEffect(() => {
    if (!open || term.length < 2) {
      setListings([])
      setBuildings([])
      setSearching(false)
      return
    }
    setSearching(true)
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      const enc = encodeURIComponent(term)
      Promise.all([
        get<{ items: Listing[] }>(`/listings?q=${enc}&limit=5`, ctrl.signal).then((r) => r.items).catch(() => []),
        get<Building[]>(`/apartments?q=${enc}&limit=4`, ctrl.signal).catch(() => []),
      ]).then(([l, b]) => {
        if (ctrl.signal.aborted) return
        setListings(l)
        setBuildings(b)
        setSearching(false)
      })
    }, 160)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [term, open])

  const items = useMemo<Item[]>(() => {
    const low = term.toLowerCase()
    const pages = PAGES.filter((p) => p.auth === undefined || p.auth === !!user)
      .filter((p) => !low || `${p.label} ${p.hint ?? ''}`.toLowerCase().includes(low))
      .map((p) => ({ ...p, id: `page-${p.href}`, group: 'Go to' }))
    const ls = listings.map((l) => ({
      id: `listing-${l.id}`,
      group: 'Listings',
      label: l.title,
      hint: [usd(l.monthly_rent) + '/mo', TYPE_LABEL[l.listing_type], l.neighborhood].filter(Boolean).join(' · '),
      href: `/listings/${l.id}`,
      onPick: () => rememberListing(l),
    }))
    const bs = buildings.map((b) => ({
      id: `building-${b.id}`,
      group: 'Buildings',
      label: b.name,
      hint: [b.address, b.review_count ? `${b.review_count} reviews` : null].filter(Boolean).join(' · '),
      href: `/buildings/${b.id}`,
    }))
    const search: Item[] = term
      ? [{ id: 'search', group: 'Search', label: `Search listings for “${term}”`, href: `/listings?q=${encodeURIComponent(term)}` }]
      : []
    return [...ls, ...bs, ...pages, ...search]
  }, [term, listings, buildings, user])

  useEffect(() => setActive(0), [term, listings, buildings])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const close = () => {
    setOpen(false)
    setQ('')
  }
  const pick = (item: Item | undefined) => {
    if (!item) return
    item.onPick?.()
    close()
    router.push(item.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % Math.max(items.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + items.length) % Math.max(items.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(items[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      e.preventDefault() // the input is the only focus stop; arrows move through results
    }
  }

  let lastGroup = ''
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div className="absolute inset-0 -z-10 bg-[#0b0303]/60 backdrop-blur-md" aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search HOMIE"
            className="palette w-full max-w-2xl overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_40px_120px_-20px_rgba(153,0,0,0.55)]"
            initial={{ opacity: 0, scale: 0.94, y: -12, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97, y: -6, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="relative flex items-center gap-3 border-b border-line px-5">
              <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search listings, buildings or pages"
                className="h-16 w-full bg-transparent text-lg outline-none placeholder:text-ink-soft"
                role="combobox"
                aria-expanded="true"
                aria-controls={`${uid}-list`}
                aria-activedescendant={items[active] ? `${uid}-${items[active].id}` : undefined}
                aria-autocomplete="list"
                spellCheck={false}
              />
              <kbd className="kbd shrink-0">esc</kbd>
              {searching && (
                <motion.span
                  className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-gradient-to-r from-cardinal via-gold to-cardinal"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: [0, 1, 0], x: ['0%', '0%', '100%'] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden
                />
              )}
            </div>

            <div ref={listRef} id={`${uid}-list`} role="listbox" aria-label="Results" className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain p-2">
              {items.length === 0 && (
                <p className="px-4 py-10 text-center text-ink-soft">{searching ? 'Searching…' : `Nothing matches “${term}”.`}</p>
              )}
              {items.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null
                lastGroup = item.group
                const on = i === active
                return (
                  <div key={item.id}>
                    {header && (
                      <p className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-[0.2em] text-ink-soft uppercase">{header}</p>
                    )}
                    <div
                      id={`${uid}-${item.id}`}
                      role="option"
                      aria-selected={on}
                      data-index={i}
                      onMouseMove={() => !on && setActive(i)}
                      onClick={() => pick(item)}
                      className="relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3"
                    >
                      {on && (
                        <motion.span
                          layoutId="palette-active"
                          className="absolute inset-0 -z-0 rounded-2xl bg-surface-2"
                          transition={{ type: 'spring', stiffness: 600, damping: 42 }}
                          aria-hidden
                        />
                      )}
                      {on && (
                        <motion.span
                          layoutId="palette-bar"
                          className="absolute top-3 bottom-3 left-0 w-1 rounded-full bg-gold"
                          transition={{ type: 'spring', stiffness: 600, damping: 42 }}
                          aria-hidden
                        />
                      )}
                      <span className="relative min-w-0 flex-1">
                        <span className={`block truncate font-semibold ${on ? 'text-accent' : ''}`}>{item.label}</span>
                        {item.hint && <span className="block truncate text-sm text-ink-soft">{item.hint}</span>}
                      </span>
                      {on && <kbd className="kbd relative shrink-0">↵</kbd>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-4 border-t border-line px-5 py-3 text-xs text-ink-soft">
              <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move</span>
              <span><kbd className="kbd">↵</kbd> to open</span>
              <span className="ml-auto hidden sm:inline">Open anywhere with <kbd className="kbd">⌘K</kbd> or <kbd className="kbd">/</kbd></span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
