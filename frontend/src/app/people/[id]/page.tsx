'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Empty, ErrorNote, StarInput, Stars, VerifiedBadge } from '@/components/Bits'
import { del, put, type PersonProfile, type PersonReview } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { day, titleCase } from '@/lib/format'
import { useApi } from '@/lib/hooks'

const TRAITS = ['cleanliness', 'communication', 'reliability', 'respect'] as const
const KINDS = [
  { value: 'roommate', label: 'We were roommates' },
  { value: 'subletter', label: 'They sublet from me' },
  { value: 'lister', label: 'I rented from them' },
] as const

function ReviewForm({ person, onSaved }: { person: PersonProfile; onSaved: () => void }) {
  const mine = person.my_review
  const [kind, setKind] = useState<PersonReview['relationship_kind']>(mine?.relationship_kind ?? 'roommate')
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [traits, setTraits] = useState<Record<string, number>>(mine?.traits ?? {})
  const [body, setBody] = useState(mine?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your review')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      id="review"
      className="card grid scroll-mt-24 gap-5 p-6"
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => put(`/people/${person.user.id}/review`, { relationship_kind: kind, rating, traits, body }))
      }}
    >
      <div>
        <h2 className="font-display text-xl font-bold">
          {mine ? 'Your review' : `Review ${person.user.display_name}`}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Shown without your name. Stick to what it was like to live or deal with them.
        </p>
      </div>
      <div>
        <span className="label">How do you know them?</span>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k.value} type="button" aria-pressed={kind === k.value} className="select-pill py-1.5 text-sm" onClick={() => setKind(k.value)}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Overall</span>
        <StarInput value={rating} onChange={setRating} label="Overall rating" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TRAITS.map((t) => (
          <div key={t}>
            <span className="label">{titleCase(t)} (optional)</span>
            <StarInput value={traits[t] ?? 0} onChange={(n) => setTraits((cur) => ({ ...cur, [t]: n }))} label={t} />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="pbody" className="label">Anything to add? (optional)</label>
        <textarea id="pbody" className="input min-h-24" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-gold" disabled={busy || rating === 0}>
          {mine ? 'Update review' : 'Post review'}
        </button>
        {mine && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => del(`/people/${person.user.id}/review`))}>
            Delete my review
          </button>
        )}
      </div>
    </form>
  )
}

export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  // Re-fetch when sign-in state resolves so "can review" reflects the viewer.
  const { data, error, status, reload } = useApi<PersonProfile>(`/people/${id}`)
  useEffect(() => {
    reload()
  }, [user?.id, reload])

  if (status === 404) return <div className="shell py-20"><Empty title="Student not found." /></div>
  if (!data) return <div className="shell py-12"><ErrorNote message={error} /><div className="skeleton mt-4 h-72" /></div>

  const isSelf = user?.id === data.user.id

  return (
    <div className="shell grid max-w-4xl gap-8 py-12">
      <header className="card flex flex-wrap items-center gap-6 p-7">
        <span className="display grid size-24 place-items-center rounded-full bg-gradient-to-br from-cardinal to-[#4d0000] text-5xl font-extrabold text-gold" aria-hidden>
          {data.user.display_name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="display text-5xl font-extrabold">{data.user.display_name}</h1>
            {data.user.is_usc_verified && <VerifiedBadge />}
          </div>
          {data.average_rating !== null ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-soft">
              <Stars value={data.average_rating} size="size-5" />
              <span className="font-bold text-ink">{data.average_rating.toFixed(1)}</span>
              from {data.review_count} review{data.review_count === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="mt-2 text-ink-soft">No reviews yet.</p>
          )}
        </div>
      </header>

      {Object.keys(data.trait_averages).length > 0 && (
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          {TRAITS.filter((t) => t in data.trait_averages).map((t) => (
            <div key={t}>
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{titleCase(t)}</span>
                <span className="tabular-nums text-ink-soft">{data.trait_averages[t].toFixed(1)} / 5</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(data.trait_averages[t] / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {data.can_review ? (
        <ReviewForm key={data.my_review?.id ?? 'new'} person={data} onSaved={reload} />
      ) : (
        !isSelf && (
          <p className="card p-5 text-sm text-ink-soft">
            {user
              ? 'You can review someone once you have both messaged each other on HOMIE. That keeps reviews to people who have actually dealt with each other.'
              : <>Reviews come from students who have dealt with this person on HOMIE. <Link href={`/login?next=/people/${id}`} className="font-bold text-accent">Sign in</Link> to add yours.</>}
          </p>
        )
      )}

      <section>
        <h2 className="font-display text-2xl font-bold">What others say</h2>
        {data.reviews.length === 0 ? (
          <p className="mt-3 text-ink-soft">Nothing yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {data.reviews.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-3">
                    <Stars value={r.rating} />
                    <span className="chip">As a {r.relationship_kind}</span>
                    {r.is_mine && <span className="chip chip-gold">Yours</span>}
                  </span>
                  <span className="text-xs text-ink-soft">{day(r.created_at, true)}</span>
                </div>
                {r.body && <p className="mt-3 leading-relaxed whitespace-pre-line">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
