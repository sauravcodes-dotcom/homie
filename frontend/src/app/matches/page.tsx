'use client'

import Link from 'next/link'
import { Empty, ErrorNote, PageHeader } from '@/components/Bits'
import { ListingCard } from '@/components/ListingCard'
import { Reveal } from '@/components/Reveal'
import type { FeedItem } from '@/lib/api'
import { useRequireAuth } from '@/lib/auth'
import { useApi } from '@/lib/hooks'

export default function Matches() {
  const { ready } = useRequireAuth({ profile: true })
  const { data, error, loading } = useApi<FeedItem[]>(ready ? '/feed?limit=50&include_swiped=true' : null)

  return (
    <>
      <PageHeader eyebrow="Ranked for you" title="Your matches">
        Every open listing, scored against your quiz answers. Best fit first.
      </PageHeader>
      <div className="shell pb-20">
        <ErrorNote message={error} />
        {loading && !data ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton aspect-[4/5]" />)}
          </div>
        ) : data && data.length === 0 ? (
          <Empty title="Nothing to rank yet.">
            <Link href="/listings/new" className="btn btn-gold mt-2">Post the first listing</Link>
          </Empty>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data?.map((item, i) => (
              <Reveal key={item.listing.id} delay={(i % 3) * 0.06}>
                <ListingCard listing={item.listing} match={item.match} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
