'use client'

import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Empty, ErrorNote, VerifiedBadge } from '@/components/Bits'
import { get, post, type Conversation, type ConversationDetail, type Message } from '@/lib/api'
import { useRequireAuth } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { useInterval } from '@/lib/hooks'

const POLL_MS = 2500
const TYPING_EVERY_MS = 3000

function Thread({ id, onActivity }: { id: number; onActivity: () => void }) {
  const [info, setInfo] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastId = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)
  const [readUpTo, setReadUpTo] = useState<number | null>(null)
  const [typing, setTyping] = useState(false)
  const lastTypingPing = useRef(0)

  const load = useCallback(
    (initial = false) => {
      get<ConversationDetail>(`/conversations/${id}?after_id=${initial ? 0 : lastId.current}`)
        .then((d) => {
          const { messages: fresh, other_read_up_to, other_typing, ...rest } = d
          setInfo(rest)
          setReadUpTo(other_read_up_to)
          setTyping(other_typing && !fresh.some((m) => !m.is_mine))
          if (initial) setMessages(fresh)
          else if (fresh.length) {
            // Polls can overlap a send, so drop anything already shown.
            setMessages((cur) => [...cur, ...fresh.filter((m) => !cur.some((c) => c.id === m.id))])
          }
          if (fresh.length) {
            lastId.current = Math.max(lastId.current, ...fresh.map((m) => m.id))
            onActivity()
          }
          setError(null)
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load messages'))
    },
    [id, onActivity],
  )

  useEffect(() => {
    lastId.current = 0
    setMessages([])
    setInfo(null)
    load(true)
  }, [id, load])
  useInterval(() => load(), POLL_MS)

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: messages.length > 1 ? 'smooth' : 'auto' })
  }, [messages.length, typing])

  // Tell the other side we are typing, at most every few seconds.
  const onType = (value: string) => {
    setBody(value)
    const now = Date.now()
    if (value.trim() && now - lastTypingPing.current > TYPING_EVERY_MS) {
      lastTypingPing.current = now
      post(`/conversations/${id}/typing`).catch(() => undefined)
    }
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setBusy(true)
    // Show it straight away; swap in the saved message when the server answers.
    const temp: Message & { pending?: boolean } = {
      id: -Date.now(),
      sender_id: 0,
      is_mine: true,
      body: text,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setMessages((cur) => [...cur, temp])
    setBody('')
    lastTypingPing.current = 0
    try {
      const msg = await post<Message>(`/conversations/${id}/messages`, { body: text })
      setMessages((cur) => {
        const rest = cur.filter((c) => c.id !== temp.id)
        // Keep the bubble's key so it does not pop out and back in.
        return rest.some((c) => c.id === msg.id) ? rest : [...rest, { ...msg, clientKey: `temp-${temp.id}` }]
      })
      lastId.current = Math.max(lastId.current, msg.id)
      onActivity()
    } catch (err) {
      setMessages((cur) => cur.filter((c) => c.id !== temp.id))
      setBody(text)
      setError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex h-[calc(100dvh-11rem)] min-h-[28rem] flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0">
          {info ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/people/${info.other.id}`} className="text-lg font-bold hover:text-accent">
                  {info.other.display_name}
                </Link>
                {info.other.is_usc_verified && <VerifiedBadge />}
              </div>
              {info.listing_id && (
                <Link href={`/listings/${info.listing_id}`} className="line-clamp-1 text-sm text-ink-soft hover:text-accent">
                  About: {info.listing_title ?? 'a listing'}
                </Link>
              )}
            </>
          ) : (
            <div className="skeleton h-6 w-40" />
          )}
        </div>
        {info?.can_review && (
          <Link href={`/people/${info.other.id}#review`} className="btn btn-ghost btn-sm">
            Review {info.other.display_name.split(' ')[0]}
          </Link>
        )}
      </header>

      <div className="flex-1 overflow-x-hidden overflow-y-auto p-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const next = messages[i + 1]
            const groupEnd = !next || next.is_mine !== m.is_mine
            const pending = (m as Message & { pending?: boolean }).pending
            // The receipt sits under my newest message only.
            const lastMine = m.is_mine && !messages.slice(i + 1).some((x) => x.is_mine)
            const read = lastMine && readUpTo !== null && m.id > 0 && m.id <= readUpTo
            return (
              <motion.div
                key={(m as Message & { clientKey?: string }).clientKey ?? (m.id > 0 ? m.id : `temp-${m.id}`)}
                layout="position"
                className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'} ${groupEnd ? 'mb-3' : 'mb-1'}`}
                initial={{ opacity: 0, y: 18, scale: 0.85 }}
                animate={{ opacity: pending ? 0.7 : 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                style={{ originX: m.is_mine ? 1 : 0, originY: 1 }}
              >
                <div className="flex max-w-[80%] flex-col items-end">
                  <div
                    className={`rounded-2xl px-4 py-2.5 whitespace-pre-wrap ${
                      m.is_mine
                        ? `bg-gradient-to-br from-[#b30000] to-cardinal text-[#fff6e3] ${groupEnd ? 'rounded-br-md' : ''}`
                        : `bg-surface-2 ${groupEnd ? 'rounded-bl-md' : ''}`
                    } ${m.is_mine ? '' : 'self-start'}`}
                  >
                    {m.body}
                    {groupEnd && (
                      <span className={`mt-1 block text-[10px] ${m.is_mine ? 'text-[#fff6e3]/60' : 'text-ink-soft'}`}>
                        {pending ? 'Sending…' : timeAgo(m.created_at)}
                      </span>
                    )}
                  </div>
                  {lastMine && !pending && (
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={read ? 'read' : 'sent'}
                        className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${read ? 'text-accent' : 'text-ink-soft'}`}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                      >
                        <svg viewBox="0 0 24 16" className="h-3 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="m1.5 8.5 4 4 8-9" />
                          {read && <path d="m9 12.5 1 0 8-9" />}
                        </svg>
                        {read ? 'Read' : 'Sent'}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </div>
              </motion.div>
            )
          })}
          {typing && (
            <motion.div
              key="typing"
              className="mb-3 flex justify-start"
              initial={{ opacity: 0, y: 12, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
              style={{ originX: 0, originY: 1 }}
              aria-label={`${info?.other.display_name ?? 'They'} is typing`}
            >
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3.5">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="size-2 rounded-full bg-gold"
                    animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="border-t border-line p-3">
        <ErrorNote message={error} />
        <div className="mt-1 flex gap-2">
          <input className="input" aria-label="Message" placeholder="Write a message…" maxLength={2000} value={body} onChange={(e) => onType(e.target.value)} />
          <motion.button type="submit" className="btn btn-gold" disabled={busy || !body.trim()} whileTap={{ scale: 0.9 }}>Send</motion.button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Never pay a deposit before you have seen the place and signed.</p>
      </form>
    </div>
  )
}

function Inbox() {
  const { ready } = useRequireAuth()
  const router = useRouter()
  const selected = Number(useSearchParams().get('c')) || null
  const [list, setList] = useState<Conversation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    get<Conversation[]>('/conversations')
      .then((d) => {
        setList(d)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load conversations'))
  }, [])

  useEffect(() => {
    if (ready) load()
  }, [ready, load])
  useInterval(load, ready ? POLL_MS * 2 : null)

  if (!ready) return <div className="shell py-12"><div className="skeleton h-96" /></div>

  return (
    <div className="shell py-8">
      <h1 className="display text-5xl font-extrabold">Messages</h1>
      <div className="mt-3"><ErrorNote message={error} /></div>
      {list && list.length === 0 ? (
        <div className="mt-6">
          <Empty title="No conversations yet.">
            <p>Message a lister from any listing, or a saved roommate from your shortlist.</p>
            <Link href="/listings" className="btn btn-gold mt-5">Browse listings</Link>
          </Empty>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[20rem_1fr]">
          <ul className={`grid content-start gap-2 ${selected ? 'hidden lg:grid' : ''}`}>
            {!list && [0, 1, 2].map((i) => <li key={i} className="skeleton h-20" />)}
            {list?.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/messages?c=${c.id}`)}
                  aria-current={selected === c.id}
                  className={`card w-full p-4 text-left transition-colors hover:border-accent ${selected === c.id ? 'border-gold bg-surface-2' : ''}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold">{c.other.display_name}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-soft">
                      {timeAgo(c.last_message_at)}
                      {c.unread > 0 && selected !== c.id && (
                        <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-[#1d0808]">{c.unread}</span>
                      )}
                    </span>
                  </span>
                  {c.listing_title && <span className="line-clamp-1 text-xs text-accent">{c.listing_title}</span>}
                  <span className="mt-1 line-clamp-1 text-sm text-ink-soft">{c.last_message}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className={selected ? '' : 'hidden lg:block'}>
            {selected ? (
              <>
                <button type="button" className="mb-3 text-sm font-bold text-accent lg:hidden" onClick={() => router.push('/messages')}>
                  ← All conversations
                </button>
                <Thread id={selected} onActivity={load} />
              </>
            ) : (
              <div className="card grid h-full min-h-72 place-items-center p-8 text-ink-soft">Pick a conversation.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Messages() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  )
}
