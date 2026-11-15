'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useDeferredValue, useEffect, useState } from 'react'
import { Empty, ErrorNote, PageHeader } from '@/components/Bits'
import { ListingCard } from '@/components/ListingCard'
import { Reveal } from '@/components/Reveal'
import { get, query, type Listing, type ListingPage, type ListingType } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { TYPE_LABEL, usd } from '@/lib/format'
import { useApi } from '@/lib/hooks'

const TYPES = Object.keys(TYPE_LABEL) as ListingType[]

const PAGE_SIZE = 24

function Browse() {
  const { user } = useAuth()
  const params0 = useSearchParams()
  const building = params0.get('building')
  const typeParam = params0.get('type')
  const [q, setQ] = useState('')
  const [type, setType] = useState<ListingType | ''>(
    TYPES.includes(typeParam as ListingType) ? (typeParam as ListingType) : '',
  )
  const [maxRent, setMaxRent] = useState(4000)
  const [neighborhood, setNeighborhood] = useState('')
  const [availableBy, setAvailableBy] = useState('')
  const [sort, setSort] = useState('newest')

  const params = useDeferredValue(
    query({
      q,
      listing_type: type,
      max_rent: maxRent < 4000 ? maxRent : null,
      neighborhood,
      available_by: availableBy,
      apartment_id: building,
      sort,
      limit: PAGE_SIZE,
    }),
  )
  const first = useApi<ListingPage>(`/listings${params}`)
  const hoods = useApi<string[]>('/listings/neighborhoods')

  // Pages after the first are appended; any filter change starts over.
  const [extra, setExtra] = useState<Listing[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  useEffect(() => {
    setExtra([])
    setMoreError(null)
  }, [params])

  const data = first.data ? [...first.data.items, ...extra] : null
  const total = first.data?.total ?? 0
  const error = first.error ?? moreError
  const loading = first.loading

  const loadMore = async () => {
    if (!data) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const sep = params ? '&' : '?'
      const page = await get<ListingPage>(`/listings${params}${sep}offset=${data.length}`)
      setExtra((cur) => [...cur, ...page.items])
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : 'Could not load more')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Open now" title="Listings">
        Subleases, lease takeovers, rooms and roommate openings posted by USC students.
        {user?.has_profile && (
          <>
            {' '}
            <Link href="/matches" className="font-bold text-accent">See them ranked for you →</Link>
          </>
        )}
      </PageHeader>

      <div className="shell pb-20">
        <form className="card grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]" onSubmit={(e) => e.preventDefault()} role="search">
          <div>
            <label className="label" htmlFor="q">Search</label>
            <input id="q" className="input" placeholder="furnished, parking, studio…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="hood">Neighborhood</label>
            <select id="hood" className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
              <option value="">Anywhere</option>
              {hoods.data?.map((h) => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="by">Available by</label>
            <input id="by" type="date" className="input" value={availableBy} onChange={(e) => setAvailableBy(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rent">
              Max rent: <span className="text-ink">{maxRent >= 4000 ? 'Any' : usd(maxRent)}</span>
            </label>
            <input id="rent" type="range" min={500} max={4000} step={50} className="mt-2.5 w-full" value={maxRent} onChange={(e) => setMaxRent(Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="sort">Sort</label>
            <select id="sort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="price_asc">Rent: low to high</option>
              <option value="price_desc">Rent: high to low</option>
              <option value="soonest">Available soonest</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 lg:col-span-5">
            <button type="button" className="select-pill" aria-pressed={type === ''} onClick={() => setType('')}>All types</button>
            {TYPES.map((t) => (
              <button key={t} type="button" className="select-pill" aria-pressed={type === t} onClick={() => setType(type === t ? '' : t)}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </form>

        <div className="mt-4"><ErrorNote message={error} /></div>
        <p className="mt-6 text-sm text-ink-soft" aria-live="polite">
          {data ? `Showing ${data.length.toLocaleString()} of ${total.toLocaleString()} listing${total === 1 ? '' : 's'}` : loading ? 'Loading…' : ''}
        </p>

        {data && data.length === 0 ? (
          <div className="mt-4">
            <Empty title="No listings match.">
              <p>Loosen a filter, or be the first to post.</p>
              <Link href="/listings/new" className="btn btn-gold mt-5">Post a listing</Link>
            </Empty>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {!data && [0, 1, 2].map((i) => <div key={i} className="skeleton aspect-[4/5]" />)}
            {data?.map((l, i) => (
              <Reveal key={l.id} delay={(i % 3) * 0.05} y={24}>
                <ListingCard listing={l} />
              </Reveal>
            ))}
          </div>
        )}
        {data && data.length < total && (
          <div className="mt-10 text-center">
            <button type="button" className="btn btn-ghost px-8" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function Listings() {
  return (
    <Suspense>
      <Browse />
    </Suspense>
  )
}
