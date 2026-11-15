import { useEffect, useState } from 'react'
import { ListingCard } from '../components/ListingCard'
import { api, NEIGHBORHOODS, type Listing, type ListingQuery, type ListingType } from '../lib/api'
import { useAuth } from '../lib/auth'
import { LISTING_TYPE_LABEL } from '../lib/format'

const PAGE = 24
const select = 'rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm'

export function Listings() {
  const { user } = useAuth()
  const [query, setQuery] = useState<ListingQuery>({ sort: 'newest' })
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Listing[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce the free-text search into the query.
  useEffect(() => {
    const t = setTimeout(() => setQuery((q) => ({ ...q, q: search.trim() || undefined })), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .listings({ ...query, limit: PAGE, offset: 0 })
      .then((page) => {
        if (cancelled) return
        setItems(page.items)
        setTotal(page.total)
      })
      .catch(() => !cancelled && setError('Listings could not be loaded. Check that the API is running.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query])

  async function loadMore() {
    setLoading(true)
    try {
      const page = await api.listings({ ...query, limit: PAGE, offset: items.length })
      setItems((cur) => [...cur, ...page.items])
      setTotal(page.total)
    } catch {
      setError('More listings could not be loaded. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const update = (patch: Partial<ListingQuery>) => setQuery((q) => ({ ...q, ...patch }))

  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-[clamp(2.75rem,7vw,5rem)] font-extrabold">Open rooms</h1>
          <p className="mt-3 max-w-[36rem] leading-relaxed text-ink-soft">
            Subleases, lease takeovers and open rooms from USC students. Roommate notes come from
            the student who lives there now.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="#/match"
            className="rounded-full bg-gold px-5 py-3 font-semibold text-ink hover:bg-gold/80"
          >
            Find my match
          </a>
          <a
            href={user ? '#/post' : '#/signin?next=/post'}
            className="rounded-full bg-jacaranda px-5 py-3 font-semibold text-petal hover:bg-jacaranda-dark"
          >
            Post your sublease
          </a>
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">
          Search
          <input
            type="search"
            placeholder="Street, building or unit"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={select}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">
          Type
          <select
            className={select}
            value={query.listing_type ?? ''}
            onChange={(e) => update({ listing_type: (e.target.value || undefined) as ListingType | undefined })}
          >
            <option value="">All types</option>
            {(Object.keys(LISTING_TYPE_LABEL) as ListingType[]).map((t) => (
              <option key={t} value={t}>
                {LISTING_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">
          Area
          <select
            className={select}
            value={query.neighborhood ?? ''}
            onChange={(e) => update({ neighborhood: e.target.value || undefined })}
          >
            <option value="">All areas</option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">
          Max rent
          <select
            className={select}
            value={query.max_rent ?? ''}
            onChange={(e) => update({ max_rent: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Any</option>
            {[1000, 1200, 1400, 1600, 2000, 2500, 3000].map((n) => (
              <option key={n} value={n}>
                ${n.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">
          Sort
          <select
            className={select}
            value={query.sort}
            onChange={(e) => update({ sort: e.target.value as ListingQuery['sort'] })}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Lowest rent</option>
            <option value="price_desc">Highest rent</option>
            <option value="soonest">Available soonest</option>
          </select>
        </label>
      </div>

      <p className="mt-6 text-sm text-ink-soft" aria-live="polite">
        {total === null ? 'Loading listings…' : `${total.toLocaleString()} ${total === 1 ? 'listing' : 'listings'}`}
      </p>
      {error && <p className="mt-4 text-alert">{error}</p>}
      {total === 0 && (
        <p className="mt-6 text-ink-soft">Nothing matches these filters. Try a higher rent or another area.</p>
      )}

      <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((l) => (
          <li key={l.id}>
            <ListingCard listing={l} />
          </li>
        ))}
      </ul>

      {total !== null && items.length < total && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-full border border-ink/20 px-6 py-3 font-semibold hover:bg-white disabled:opacity-60"
          >
            {loading ? 'Loading…' : `Show more (${(total - items.length).toLocaleString()} left)`}
          </button>
        </div>
      )}
    </section>
  )
}
