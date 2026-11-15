'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Empty, ErrorNote, PageHeader, VerifiedBadge } from '@/components/Bits'
import { ListingCard } from '@/components/ListingCard'
import { ScoreRing } from '@/components/Match'
import { del, post, type Conversation, type Listing, type RoommateCard } from '@/lib/api'
import { useRequireAuth } from '@/lib/auth'
import { day, usd } from '@/lib/format'
import { useApi } from '@/lib/hooks'

export default function Saved() {
  const { ready, user } = useRequireAuth()
  const router = useRouter()
  const listings = useApi<Listing[]>(ready ? '/saved' : null)
  const mates = useApi<RoommateCard[]>(ready && user?.has_profile ? '/saved/roommates' : null)
  const [error, setError] = useState<string | null>(null)

  const message = async (card: RoommateCard) => {
    setError(null)
    try {
      const conv = await post<Conversation>('/conversations', {
        user_id: card.user.id,
        body: `Hi ${card.user.display_name.split(' ')[0]}! HOMIE matched us as possible roommates. Want to chat?`,
      })
      router.push(`/messages?c=${conv.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the conversation')
    }
  }

  const removeMate = async (card: RoommateCard) => {
    await del(`/swipes/user/${card.user.id}`).catch(() => undefined)
    mates.reload()
  }

  return (
    <>
      <PageHeader eyebrow="Your shortlist" title="Saved" />
      <div className="shell grid gap-14 pb-20">
        <ErrorNote message={error ?? listings.error} />
        <section>
          <h2 className="font-display text-2xl font-bold">Listings</h2>
          {listings.data && listings.data.length === 0 ? (
            <div className="mt-4">
              <Empty title="Nothing saved yet.">
                <Link href="/discover" className="btn btn-gold mt-2">Start swiping</Link>
              </Empty>
            </div>
          ) : (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {!listings.data && [0, 1, 2].map((i) => <div key={i} className="skeleton aspect-[4/5]" />)}
              {listings.data?.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>

        {mates.data && mates.data.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold">Roommates</h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {mates.data.map((c) => (
                <li key={c.user.id} className="card flex gap-4 p-5">
                  <ScoreRing score={c.match.score} size={64} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/people/${c.user.id}`} className="text-lg font-bold hover:text-accent">
                        {c.user.display_name}
                      </Link>
                      {c.user.is_usc_verified && <VerifiedBadge />}
                    </div>
                    <p className="text-sm text-ink-soft">Up to {usd(c.budget_max)} · from {day(c.move_in)}</p>
                    {c.bio && <p className="mt-2 line-clamp-2 text-sm">{c.bio}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn btn-gold btn-sm" onClick={() => message(c)}>Message</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeMate(c)}>Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}
