'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Empty, ErrorNote, VerifiedBadge } from '@/components/Bits'
import { ListingPhoto } from '@/components/ListingCard'
import { RoommatesPanel } from '@/components/Personality'
import { ScoreRing } from '@/components/Match'
import { SwipeDeck } from '@/components/SwipeDeck'
import { post, type FeedItem, type RoommateCard } from '@/lib/api'
import { useRequireAuth } from '@/lib/auth'
import { dateRange, day, TYPE_LABEL, usd } from '@/lib/format'
import { useApi } from '@/lib/hooks'

type Tab = 'listings' | 'roommates'

function Reasons({ highlights, concerns }: { highlights: string[]; concerns: string[] }) {
  return (
    <ul className="mt-3 grid gap-1.5 text-sm">
      {highlights.slice(0, 2).map((h) => (
        <li key={h} className="flex gap-2">
          <span className="text-ok" aria-hidden>✓</span>
          <span className="line-clamp-1">{h}</span>
        </li>
      ))}
      {concerns.slice(0, 1).map((c) => (
        <li key={c} className="flex gap-2 text-ink-soft">
          <span className="text-warn" aria-hidden>!</span>
          <span className="line-clamp-1">{c}</span>
        </li>
      ))}
    </ul>
  )
}

function ListingFace({ item }: { item: FeedItem }) {
  const { listing, match } = item
  return (
    <div className="flex h-full flex-col">
      <div className="relative h-[52%] shrink-0">
        <ListingPhoto listing={listing} className="size-full" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-16 text-white">
          <span className="flex flex-wrap gap-2">
            <span className="chip border-transparent bg-white/15 text-white">{TYPE_LABEL[listing.listing_type]}</span>
            {listing.risk && listing.risk.level !== 'low' && (
              <span className={`chip bg-black/60 ${listing.risk.level === 'high' ? 'chip-bad' : 'chip-warn'}`}>
                {listing.risk.level === 'high' ? 'Red flags' : 'Check details'}
              </span>
            )}
          </span>
          <p className="display mt-2 text-5xl font-extrabold">
            {usd(listing.monthly_rent)}
            <span className="font-sans text-base font-medium tracking-normal opacity-80"> /mo</span>
          </p>
        </div>
      </div>
      <div className="flex flex-1 gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-1 text-lg font-bold">{listing.title}</h2>
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-soft">
            {[listing.neighborhood, dateRange(listing.available_from, listing.available_to)].filter(Boolean).join(' · ')}
          </p>
          <Reasons highlights={match.highlights} concerns={match.concerns} />
          <Link
            href={`/listings/${listing.id}`}
            className="mt-3 inline-block text-sm font-bold text-accent"
            onPointerDown={(e) => e.stopPropagation()}
          >
            Full details →
          </Link>
        </div>
        <ScoreRing score={match.score} />
      </div>
    </div>
  )
}

const LIFE_CHIPS = (c: RoommateCard) =>
  [
    c.lifestyle.sleep_schedule && { early: 'Up early', late: 'Up late', flexible: 'Flexible sleep' }[c.lifestyle.sleep_schedule],
    c.lifestyle.cleanliness && `Clean ${c.lifestyle.cleanliness}/5`,
    c.lifestyle.smoking === false && 'Non-smoker',
    c.lifestyle.smoking === true && 'Smokes',
    c.lifestyle.drinking === false && 'Does not drink',
    c.lifestyle.diet && (c.lifestyle.diet === 'veg' ? 'Vegetarian' : 'Non-veg'),
    c.lifestyle.pets === true && 'Pets',
  ].filter(Boolean) as string[]

function RoommateFace({ card }: { card: RoommateCard }) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative grid h-[38%] shrink-0 place-items-center bg-gradient-to-br from-cardinal via-[#5c0000] to-[#b38f00]">
        <span className="display text-8xl font-extrabold text-gold/90" aria-hidden>
          {card.user.display_name[0]}
        </span>
      </div>
      <div className="flex flex-1 gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{card.user.display_name}</h2>
            {card.user.is_usc_verified && <VerifiedBadge />}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            Up to {usd(card.budget_max)} · from {day(card.move_in)}
          </p>
          {card.bio && <p className="mt-2 line-clamp-3 text-sm">{card.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LIFE_CHIPS(card).map((c) => (
              <span key={c} className="chip">{c}</span>
            ))}
          </div>
          <Reasons highlights={card.match.highlights} concerns={card.match.concerns} />
          {(card.personality_summary || card.match.personality_fit) && (
            <div className="mt-3">
              <RoommatesPanel compact title="Personality" household={card.personality_summary} fit={card.match.personality_fit} />
            </div>
          )}
        </div>
        <ScoreRing score={card.match.score} />
      </div>
    </div>
  )
}

export default function Discover() {
  const { ready } = useRequireAuth({ profile: true })
  const [tab, setTab] = useState<Tab>('listings')
  const [error, setError] = useState<string | null>(null)
  const feed = useApi<FeedItem[]>(ready && tab === 'listings' ? '/feed?limit=30' : null)
  const mates = useApi<RoommateCard[]>(ready && tab === 'roommates' ? '/roommates?limit=30' : null)

  const swipe = useCallback((target_type: 'listing' | 'user', target_id: number, action: 'save' | 'pass') => {
    post('/swipes', { target_type, target_id, action }).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Could not save that swipe'),
    )
  }, [])
  const swipeListing = useCallback(
    (item: FeedItem, d: 'save' | 'pass') => swipe('listing', item.listing.id, d),
    [swipe],
  )
  const swipeMate = useCallback(
    (card: RoommateCard, d: 'save' | 'pass') => swipe('user', card.user.id, d),
    [swipe],
  )

  const active = tab === 'listings' ? feed : mates

  return (
    <div className="shell py-10">
      <div className="flex flex-col items-center gap-5">
        <h1 className="display text-center text-[clamp(2.4rem,6vw,4rem)] font-extrabold">
          Right to <span className="hl">save.</span> Left to pass.
        </h1>
        <div role="tablist" className="flex rounded-full border border-line bg-surface p-1">
          {(['listings', 'roommates'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-bold capitalize transition-colors ${
                tab === t ? 'bg-gold text-[#1d0808]' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-md">
        <ErrorNote message={error ?? active.error} />
      </div>

      <div className="mt-8">
        {!ready || (active.loading && !active.data) ? (
          <div className="skeleton mx-auto h-[34rem] max-w-md" />
        ) : tab === 'listings' && feed.data ? (
          <SwipeDeck
            items={feed.data}
            getKey={(i) => i.listing.id}
            render={(i) => <ListingFace item={i} />}
            onSwipe={swipeListing}
            empty={
              <Empty title="You are all caught up.">
                <p>New listings show up here as they are posted.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link href="/saved" className="btn btn-gold">See saved</Link>
                  <Link href="/matches" className="btn btn-ghost">Ranked list</Link>
                </div>
              </Empty>
            }
          />
        ) : tab === 'roommates' && mates.data ? (
          <SwipeDeck
            items={mates.data}
            getKey={(c) => c.user.id}
            render={(c) => <RoommateFace card={c} />}
            onSwipe={swipeMate}
            empty={
              <Empty title="No more roommates right now.">
                <p>Only students who opted in appear here. Saved people are under Saved, where you can message them.</p>
                <Link href="/saved" className="btn btn-gold mt-5">See saved</Link>
              </Empty>
            }
          />
        ) : null}
      </div>
    </div>
  )
}
