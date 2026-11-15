'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Empty, ErrorNote, VerifiedBadge } from '@/components/Bits'
import { get, post, type Conversation, type ConversationDetail, type Message } from '@/lib/api'
import { useRequireAuth } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { useInterval } from '@/lib/hooks'

const POLL_MS = 4000

function Thread({ id, onActivity }: { id: number; onActivity: () => void }) {
  const [info, setInfo] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastId = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)

  const load = useCallback(
    (initial = false) => {
      get<ConversationDetail>(`/conversations/${id}?after_id=${initial ? 0 : lastId.current}`)
        .then((d) => {
          const { messages: fresh, ...rest } = d
          setInfo(rest)
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
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setBusy(true)
    try {
      const msg = await post<Message>(`/conversations/${id}/messages`, { body: text })
      setMessages((cur) => (cur.some((c) => c.id === msg.id) ? cur : [...cur, msg]))
      lastId.current = Math.max(lastId.current, msg.id)
      setBody('')
      onActivity()
    } catch (err) {
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

      <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap ${
                m.is_mine ? 'rounded-br-md bg-cardinal text-[#fff6e3]' : 'rounded-bl-md bg-surface-2'
              }`}
            >
              {m.body}
              <span className={`mt-1 block text-[10px] ${m.is_mine ? 'text-[#fff6e3]/60' : 'text-ink-soft'}`}>
                {timeAgo(m.created_at)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="border-t border-line p-3">
        <ErrorNote message={error} />
        <div className="mt-1 flex gap-2">
          <input className="input" aria-label="Message" placeholder="Write a message…" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
          <button type="submit" className="btn btn-gold" disabled={busy || !body.trim()}>Send</button>
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
