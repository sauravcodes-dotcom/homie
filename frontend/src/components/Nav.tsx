'use client'

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { get } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useInterval } from '@/lib/hooks'
import { openPalette } from './CommandPalette'
import { ThemeToggle } from './ThemeToggle'

const LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/match', label: 'Match' },
  { href: '/listings', label: 'Listings' },
  { href: '/buildings', label: 'Buildings' },
  { href: '/map', label: 'Map' },
]

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="HOMIE home">
      <span className="grid size-9 place-items-center rounded-xl bg-cardinal shadow-[0_8px_24px_-8px_rgba(153,0,0,0.9)]">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path d="M3 12 12 3.5 21 12v8a1.5 1.5 0 0 1-1.5 1.5H15V15H9v6.5H4.5A1.5 1.5 0 0 1 3 20z" fill="#FFCC00" />
        </svg>
      </span>
      <span className="display text-2xl font-extrabold">HOMIE</span>
    </Link>
  )
}

export function Nav() {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  // Hide while scrolling down, come back on any scroll up (and always near the top).
  const { scrollY, scrollYProgress } = useScroll()
  const [hidden, setHidden] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    if (Math.abs(y - prev) < 4) return
    setHidden(y > prev && y > 160)
  })
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 32, restDelta: 0.001 })

  const poll = () => {
    if (!user) return
    get<{ unread: number }>('/conversations/unread-count')
      .then((r) => setUnread(r.unread))
      .catch(() => undefined)
  }
  useInterval(poll, user ? 15000 : null)

  const links = user
    ? [...LINKS, { href: '/saved', label: 'Saved' }, { href: '/messages', label: 'Messages' }]
    : LINKS
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-lg backdrop-saturate-150"
      animate={{ y: hidden && !open ? '-100%' : '0%' }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <motion.div className="absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-gradient-to-r from-cardinal via-gold to-gold" style={{ scaleX: progress }} aria-hidden />
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? 'page' : undefined}
              className={`relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                active(l.href) ? 'text-accent' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {active(l.href) && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-surface-2"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  aria-hidden
                />
              )}
              {l.label}
              {l.href === '/messages' && unread > 0 && (
                <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-[#1d0808]">
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPalette}
            className="group flex h-9 items-center gap-2 rounded-full border border-line px-3 text-sm text-ink-soft transition-colors hover:border-gold hover:text-ink"
            aria-label="Search HOMIE"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="hidden xl:inline">Search</span>
            <kbd className="kbd hidden xl:inline-grid">⌘K</kbd>
          </button>
          <ThemeToggle />
          {!loading &&
            (user ? (
              <>
                <Link href="/listings/new" className="btn btn-gold btn-sm hidden sm:inline-flex">
                  Post a listing
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm hidden sm:inline-flex"
                  onClick={async () => {
                    await logout()
                    router.push('/')
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn btn-gold btn-sm">
                Sign in
              </Link>
            ))}
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full border border-line lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="size-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
      {open && (
        <motion.nav
          className="shell grid gap-1 overflow-hidden lg:hidden"
          aria-label="Mobile"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { height: { type: 'spring', stiffness: 380, damping: 36 } } }}
          exit={{ height: 0, opacity: 0, transition: { duration: 0.22 } }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-xl px-3 py-2.5 font-semibold ${active(l.href) ? 'bg-surface-2 text-accent' : ''}`}
            >
              {l.label}
              {l.href === '/messages' && unread > 0 ? ` (${unread})` : ''}
            </Link>
          ))}
          {user && (
            <>
              <Link href="/listings/new" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-semibold">
                Post a listing
              </Link>
              <Link href="/onboarding" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-semibold">
                My preferences
              </Link>
              {user.is_admin && (
                <Link href="/admin" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-semibold">
                  Admin
                </Link>
              )}
              <button
                type="button"
                className="rounded-xl px-3 py-2.5 text-left font-semibold"
                onClick={async () => {
                  setOpen(false)
                  await logout()
                  router.push('/')
                }}
              >
                Sign out
              </button>
            </>
          )}
          <span className="h-3" aria-hidden />
        </motion.nav>
      )}
      </AnimatePresence>
    </motion.header>
  )
}
