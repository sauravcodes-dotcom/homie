import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Stars } from '../components/Stars'
import { api, ApiError, ROOMMATE_TAGS, type ListingDetail as Detail } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDate, formatRange, LISTING_TYPE_LABEL, money } from '../lib/format'

const LIFESTYLE_LABELS: [keyof Detail['lifestyle'], string, string][] = [
  ['smoking', 'Smoking in the unit', 'No smoking'],
  ['drinking', 'Drinking is fine', 'No drinking'],
  ['pets', 'Pets in the unit', 'No pets'],
]

export function ListingDetail({ id }: { id: number }) {
  const { user } = useAuth()
  const [listing, setListing] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .listing(id)
      .then(setListing)
      .catch((err) =>
        setError(err instanceof ApiError && err.status === 404 ? 'This listing no longer exists.' : 'This listing could not be loaded.'),
      )
  }, [id])

  useEffect(load, [load])

  if (error) return <Centered>{error}</Centered>
  if (!listing) return <Centered>Loading listing…</Centered>

  const isOwner = user?.id === listing.owner_id
  const ls = listing.lifestyle

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <a href="#/listings" className="text-sm text-ink-soft underline underline-offset-4">
        All open rooms
      </a>

      <div className="mt-6 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <p className="text-sm text-ink-soft">
            {LISTING_TYPE_LABEL[listing.listing_type]}
            {listing.is_demo && ', demo posting'}
          </p>
          <h1 className="display mt-2 text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold">
            {listing.title}
          </h1>
          <p className="mt-4 text-lg">
            {listing.building_name}
            {listing.unit && `, unit ${listing.unit}`}
          </p>
          {listing.address && <p className="text-ink-soft">{listing.address}</p>}

          <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-ink/10 py-6">
            <div>
              <dt className="text-sm text-ink-soft">Rent</dt>
              <dd className="font-display text-3xl font-bold">{money(listing.monthly_rent)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">Available</dt>
              <dd className="mt-1.5 font-semibold">
                {formatRange(listing.available_from, listing.available_to)}
              </dd>
            </div>
          </dl>

          {listing.description && (
            <p className="mt-6 max-w-[38rem] leading-relaxed text-ink-soft">{listing.description}</p>
          )}

          <ul className="mt-6 flex flex-wrap gap-2 text-sm">
            {ls.sleep_schedule && <Chip>{ls.sleep_schedule} sleep schedule</Chip>}
            {ls.diet && <Chip>{ls.diet === 'veg' ? 'Vegetarian kitchen' : 'Non-veg kitchen'}</Chip>}
            {LIFESTYLE_LABELS.map(([key, yes, no]) =>
              ls[key] === undefined || ls[key] === null ? null : (
                <Chip key={key}>{ls[key] ? yes : no}</Chip>
              ),
            )}
          </ul>

          <p className="mt-8 text-sm text-ink-soft">Posted by {listing.owner_name}</p>
        </section>

        <section aria-labelledby="roommates-heading" className="rounded-[28px] bg-ink p-6 text-petal sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="roommates-heading" className="font-display text-2xl font-semibold">
                About the roommates
              </h2>
              <p className="mt-1 text-sm text-petal/70">
                From the student subleasing this room, who lives with them now.
              </p>
            </div>
            {listing.roommate_feedback.average_rating !== null && (
              <div className="text-right">
                <div className="display text-5xl font-extrabold text-gold">
                  {listing.roommate_feedback.average_rating}
                </div>
                <div className="text-xs text-petal/70">
                  out of 5, {listing.roommate_feedback.count}{' '}
                  {listing.roommate_feedback.count === 1 ? 'note' : 'notes'}
                </div>
              </div>
            )}
          </div>

          {listing.feedback.length === 0 ? (
            <p className="mt-6 text-sm text-petal/70">No roommate notes yet.</p>
          ) : (
            <ul className="mt-6 grid gap-4">
              {listing.feedback.map((f) => (
                <li key={f.id} className="rounded-2xl bg-petal/[0.06] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={f.rating} />
                    <span className="text-xs text-petal/60">{formatDate(f.created_at)}</span>
                  </div>
                  <p className="mt-2 leading-relaxed">{f.comment}</p>
                  {f.tags.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {f.tags.map((t) => (
                        <li key={t} className="rounded-full bg-pool/20 px-2.5 py-0.5 text-xs text-pool">
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-petal/60">
                    {f.author_name}
                    {f.author_verified && ', verified USC student'}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 border-t border-petal/15 pt-6">
            {isOwner ? (
              <FeedbackForm listingId={listing.id} onPosted={load} />
            ) : user ? (
              <p className="text-sm text-petal/70">
                Only the student subleasing this room can post roommate notes here.
              </p>
            ) : (
              <p className="text-sm text-petal/70">
                Subleasing this room?{' '}
                <a
                  href={`#/signin?next=/listings/${listing.id}`}
                  className="font-semibold text-gold underline underline-offset-4"
                >
                  Sign in with your USC email
                </a>{' '}
                to add notes about your roommates.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function FeedbackForm({ listingId, onPosted }: { listingId: number; onPosted: () => void }) {
  const [rating, setRating] = useState(5)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.postFeedback(listingId, { rating, tags, comment })
      setComment('')
      setTags([])
      setPosted(true)
      onPosted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Your note could not be posted. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (t: string) =>
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  return (
    <form onSubmit={submit} className="grid gap-4">
      <h3 className="font-semibold">Tell incoming students about your roommates</h3>
      <div role="radiogroup" aria-label="Roommate rating" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} out of 5`}
            onClick={() => setRating(n)}
            className={`text-3xl leading-none ${n <= rating ? 'text-gold' : 'text-petal/25'}`}
          >
            ★
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {ROOMMATE_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tags.includes(t)}
            onClick={() => toggle(t)}
            className={`rounded-full px-3 py-1 text-sm ${
              tags.includes(t) ? 'bg-pool font-semibold text-ink' : 'bg-petal/10 text-petal hover:bg-petal/20'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="grid gap-2 text-sm">
        Your note
        <textarea
          required
          minLength={2}
          maxLength={2000}
          rows={3}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value)
            setPosted(false)
          }}
          placeholder="What are they like to live with?"
          className="rounded-xl bg-petal/10 px-4 py-3 text-base text-petal placeholder:text-petal/40"
        />
      </label>
      {error && <p className="text-sm text-[#ff9c8a]">{error}</p>}
      {posted && <p className="text-sm text-pool">Note posted.</p>}
      <button
        type="submit"
        disabled={busy || comment.trim().length < 2}
        className="justify-self-start rounded-full bg-gold px-5 py-2.5 font-semibold text-ink hover:bg-petal disabled:opacity-50"
      >
        {busy ? 'Posting…' : 'Post note'}
      </button>
    </form>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return <li className="rounded-full bg-petal-deep px-3 py-1 first-letter:uppercase">{children}</li>
}

function Centered({ children }: { children: ReactNode }) {
  return <p className="mx-auto max-w-6xl px-5 py-24 text-ink-soft sm:px-8">{children}</p>
}
