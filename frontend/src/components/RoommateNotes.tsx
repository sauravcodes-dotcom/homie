'use client'

import Link from 'next/link'
import { useState } from 'react'
import { post, ROOMMATE_TAGS, type ListingDetail } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { day } from '@/lib/format'
import { ErrorNote, StarInput, Stars } from './Bits'

/** Notes about the current roommates, written by the student subleasing the room. */
export function RoommateNotes({ listing, onPosted }: { listing: ListingDetail; onPosted: () => void }) {
  const { user } = useAuth()
  const summary = listing.roommate_feedback
  const isOwner = user?.id === listing.owner_id

  return (
    <section aria-labelledby="roommates-heading" className="card p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="roommates-heading" className="font-display text-2xl font-bold">About the roommates</h2>
          <p className="mt-1 text-sm text-ink-soft">
            From the student subleasing this room, who lives with them now.
          </p>
        </div>
        {summary.average_rating !== null && (
          <div className="text-right">
            <div className="display text-5xl font-extrabold text-accent">{summary.average_rating}</div>
            <div className="text-xs text-ink-soft">
              out of 5, {summary.count} {summary.count === 1 ? 'note' : 'notes'}
            </div>
          </div>
        )}
      </div>

      {listing.feedback.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">No roommate notes yet.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {listing.feedback.map((f) => (
            <li key={f.id} className="rounded-2xl bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={f.rating} />
                <span className="text-xs text-ink-soft">{day(f.created_at, true)}</span>
              </div>
              <p className="mt-2 leading-relaxed">{f.comment}</p>
              {f.tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {f.tags.map((t) => (
                    <li key={t} className="chip chip-ok">{t}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink-soft">
                {f.author_name}
                {f.author_verified && ', verified USC student'}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-line pt-6">
        {isOwner ? (
          <NoteForm listingId={listing.id} onPosted={onPosted} />
        ) : user ? (
          <p className="text-sm text-ink-soft">
            Only the student subleasing this room can post roommate notes here.
          </p>
        ) : (
          <p className="text-sm text-ink-soft">
            Subleasing this room?{' '}
            <Link href={`/login?next=/listings/${listing.id}`} className="font-bold text-accent">
              Sign in with your USC email
            </Link>{' '}
            to add notes about your roommates.
          </p>
        )}
      </div>
    </section>
  )
}

function NoteForm({ listingId, onPosted }: { listingId: number; onPosted: () => void }) {
  const [rating, setRating] = useState(5)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await post(`/listings/${listingId}/roommate-feedback`, { rating, tags, comment })
      setComment('')
      setTags([])
      setPosted(true)
      onPosted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your note could not be posted. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <h3 className="font-semibold">Tell incoming students about your roommates</h3>
      <StarInput value={rating} onChange={setRating} label="Roommate rating" />
      <div className="flex flex-wrap gap-2">
        {ROOMMATE_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tags.includes(t)}
            onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
            className="select-pill py-1.5 text-sm"
          >
            {t}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="note" className="label">Your note</label>
        <textarea
          id="note"
          required
          minLength={2}
          maxLength={2000}
          rows={3}
          className="input"
          placeholder="What are they like to live with?"
          value={comment}
          onChange={(e) => {
            setComment(e.target.value)
            setPosted(false)
          }}
        />
      </div>
      <ErrorNote message={error} />
      {posted && <p className="text-sm text-ok" role="status">Note posted.</p>}
      <button type="submit" className="btn btn-gold justify-self-start" disabled={busy || comment.trim().length < 2}>
        {busy ? 'Posting…' : 'Post note'}
      </button>
    </form>
  )
}
