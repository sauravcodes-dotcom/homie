import { useEffect, useState } from 'react'
import { Stars } from '../components/Stars'
import { api, type Listing } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatRange, LISTING_TYPE_LABEL, money } from '../lib/format'

export function Listings() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listings()
      .then(setListings)
      .catch(() => setError('Listings could not be loaded. Check that the API is running.'))
  }, [])

  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-[clamp(2.75rem,7vw,5rem)] font-extrabold">Open rooms</h1>
          <p className="mt-3 max-w-[36rem] leading-relaxed text-ink-soft">
            Subleases and lease takeovers from USC students. Roommate notes come from the student
            who lives there now.
          </p>
        </div>
        <a
          href={user ? '#/post' : '#/signin?next=/post'}
          className="rounded-full bg-jacaranda px-5 py-3 font-semibold text-petal hover:bg-jacaranda-dark"
        >
          Post your sublease
        </a>
      </div>

      {error && <p className="mt-10 text-alert">{error}</p>}
      {!listings && !error && <p className="mt-10 text-ink-soft">Loading listings…</p>}
      {listings?.length === 0 && (
        <p className="mt-10 text-ink-soft">No rooms posted yet. Yours could be the first.</p>
      )}

      <ul className="mt-10 grid gap-5 md:grid-cols-2">
        {listings?.map((l) => (
          <li key={l.id}>
            <a
              href={`#/listings/${l.id}`}
              className="block h-full rounded-[24px] border border-ink/10 bg-white/70 p-6 hover:border-jacaranda/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-ink-soft">
                    {LISTING_TYPE_LABEL[l.listing_type]}
                    {l.is_demo && ', demo posting'}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold leading-tight">{l.title}</h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    {[l.building_name, l.unit && `Unit ${l.unit}`].filter(Boolean).join(', ')}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="font-display text-2xl font-bold">{money(l.monthly_rent)}</span>
                  <span className="block text-xs text-ink-soft">per month</span>
                </p>
              </div>
              <p className="mt-4 text-sm">{formatRange(l.available_from, l.available_to)}</p>
              {l.roommate_feedback.count > 0 && l.roommate_feedback.average_rating !== null ? (
                <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4 text-sm">
                  <Stars value={l.roommate_feedback.average_rating} />
                  <span className="text-ink-soft">
                    Roommates rated {l.roommate_feedback.average_rating} by the subleaser
                  </span>
                </p>
              ) : (
                <p className="mt-4 border-t border-ink/10 pt-4 text-sm text-ink-soft">
                  No roommate notes yet
                </p>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
