'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState, ViewTransition } from 'react'
import { BenchmarkPanel, Empty, ErrorNote, RiskPanel, VerifiedBadge } from '@/components/Bits'
import { ListingPhoto } from '@/components/ListingCard'
import { MapView } from '@/components/MapView'
import { RoommatesPanel } from '@/components/Personality'
import { RoommateNotes } from '@/components/RoommateNotes'
import { FactorBars, ScoreRing } from '@/components/Match'
import { del, post, type Conversation, type Lifestyle, type Listing, type ListingDetail } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { dateRange, TYPE_LABEL, usd } from '@/lib/format'
import { useApi } from '@/lib/hooks'
import { peekListing, photoName } from '@/lib/peek'

/** The hero photo. Shares a view transition name with the listing's card, so it morphs in. */
function HeroPhoto({ listing, photo = 0, children }: { listing: Pick<Listing, 'id' | 'photos' | 'title'>; photo?: number; children?: React.ReactNode }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-line">
      <ViewTransition name={photoName(listing.id)} share="morph" default="none">
        <div className="size-full">
          <ListingPhoto listing={{ ...listing, photos: listing.photos.slice(photo) }} className="size-full" />
        </div>
      </ViewTransition>
      {children}
    </div>
  )
}

function lifestyleChips(l: Lifestyle) {
  return [
    l.sleep_schedule && { early: 'Early household', late: 'Late-night household', flexible: 'Flexible hours' }[l.sleep_schedule],
    l.cleanliness && `Cleanliness ${l.cleanliness}/5`,
    l.noise_tolerance && `Noise tolerance ${l.noise_tolerance}/5`,
    l.guests_frequency && `Guests ${l.guests_frequency}/5`,
    l.smoking === false && 'No smoking',
    l.smoking === true && 'Smoking OK',
    l.drinking === true && 'Drinking is fine',
    l.drinking === false && 'No drinking',
    l.diet && (l.diet === 'veg' ? 'Vegetarian kitchen' : 'Non-veg kitchen'),
    l.pets === true && 'Pets here',
    l.pets === false && 'No pets',
  ].filter(Boolean) as string[]
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { data: listing, error, status, setData, reload } = useApi<ListingDetail>(`/listings/${id}`)
  const [photo, setPhoto] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (status === 404) {
    return (
      <div className="shell py-20">
        <Empty title="That listing is gone.">
          <Link href="/listings" className="btn btn-gold mt-2">Browse listings</Link>
        </Empty>
      </div>
    )
  }
  if (!listing) {
    const peek = peekListing(Number(id))
    if (peek && !error) {
      // Came from a card: show what the card already knew while the full listing loads.
      return (
        <div className="shell grid gap-8 py-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <HeroPhoto listing={peek} />
            <h1 className="display mt-7 text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold">{peek.title}</h1>
            <p className="mt-3 text-lg text-ink-soft">
              {[peek.neighborhood, dateRange(peek.available_from, peek.available_to)].filter(Boolean).join(' · ')}
            </p>
            <div className="skeleton mt-8 h-40" />
          </div>
          <div className="grid content-start gap-4">
            <div className="skeleton h-56" />
            <div className="skeleton h-40" />
          </div>
        </div>
      )
    }
    return (
      <div className="shell py-12">
        <ErrorNote message={error} />
        <div className="skeleton mt-4 h-[32rem]" />
      </div>
    )
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const toggleSave = () =>
    run(async () => {
      if (listing.is_saved) await del(`/swipes/listing/${listing.id}`)
      else await post('/swipes', { target_type: 'listing', target_id: listing.id, action: 'save' })
      setData({ ...listing, is_saved: !listing.is_saved })
    })

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const conv = await post<Conversation>('/conversations', { listing_id: listing.id, body: message })
      router.push(`/messages?c=${conv.id}`)
    })
  }

  const remove = () => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    void run(async () => {
      await del(`/listings/${listing.id}`)
      router.push('/listings')
    })
  }

  const hasPin = listing.latitude !== null && listing.longitude !== null
  const chips = lifestyleChips(listing.lifestyle)

  return (
    <div className="shell grid gap-8 py-10 lg:grid-cols-[1.5fr_1fr]">
      <div className="min-w-0">
        <HeroPhoto listing={listing} photo={photo}>
          <span className="absolute top-4 left-4 flex gap-2">
            <span className="chip border-transparent bg-black/60 text-white backdrop-blur">
              {TYPE_LABEL[listing.listing_type]}
            </span>
            {listing.is_demo && <span className="chip chip-gold bg-black/60 backdrop-blur">Demo posting</span>}
            {!listing.is_active && <span className="chip chip-warn bg-black/60 backdrop-blur">No longer available</span>}
          </span>
        </HeroPhoto>
        {listing.photos.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {listing.photos.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setPhoto(i)}
                aria-label={`Photo ${i + 1}`}
                aria-pressed={photo === i}
                className={`size-20 shrink-0 overflow-hidden rounded-xl border-2 ${photo === i ? 'border-gold' : 'border-transparent opacity-70'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <h1 className="display mt-7 text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold">{listing.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">
          {[listing.neighborhood, dateRange(listing.available_from, listing.available_to)].filter(Boolean).join(' · ')}
        </p>
        {listing.building_name && (
          <p className="mt-3">
            <span className="font-semibold">
              {listing.building_name}
              {listing.unit && `, unit ${listing.unit}`}
            </span>
            {listing.address && <span className="block text-sm text-ink-soft">{listing.address}</span>}
          </p>
        )}
        {listing.apartment_id && (
          <Link href={`/buildings/${listing.apartment_id}`} className="mt-3 inline-flex items-center gap-2 font-bold text-accent">
            Read resident reviews of this building →
          </Link>
        )}

        {listing.description && (
          <p className="mt-6 max-w-2xl text-lg leading-relaxed whitespace-pre-line">{listing.description}</p>
        )}
        {chips.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {chips.map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
        )}

        {listing.household && (
          <div className="mt-10">
            <RoommatesPanel
              household={listing.household}
              personality={listing.lifestyle.personality}
              fit={listing.match?.personality_fit}
            />
          </div>
        )}

        <div className="mt-10">
          <RoommateNotes listing={listing} onPosted={reload} />
        </div>

        {hasPin && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Location</h2>
            {listing.travel && (
              <p className="mt-1 text-ink-soft">
                About {listing.travel.walk_minutes} min walk or {listing.travel.bike_minutes} min bike to
                the center of campus ({listing.travel.miles} mi, estimated).
              </p>
            )}
            <div className="mt-4">
              <MapView
                className="h-72"
                rings
                points={[{
                  id: listing.id,
                  title: listing.title,
                  monthly_rent: listing.monthly_rent,
                  listing_type: listing.listing_type,
                  latitude: listing.latitude!,
                  longitude: listing.longitude!,
                  neighborhood: listing.neighborhood,
                  travel: listing.travel!,
                  photo: null,
                }]}
              />
            </div>
          </section>
        )}
      </div>

      <aside className="grid content-start gap-5 lg:sticky lg:top-24 lg:self-start">
        <section className="card p-6">
          <p className="display text-6xl font-extrabold">
            {usd(listing.monthly_rent)}
            <span className="font-sans text-lg font-medium tracking-normal text-ink-soft"> /mo</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-soft">Posted by</span>
            <Link href={`/people/${listing.owner.id}`} className="font-bold underline decoration-line underline-offset-4 hover:decoration-accent">
              {listing.owner.display_name}
            </Link>
            {listing.owner.is_usc_verified && <VerifiedBadge />}
          </div>

          <div className="mt-5 grid gap-3">
            <ErrorNote message={actionError} />
            {listing.is_mine ? (
              <>
                <Link href={`/listings/new?edit=${listing.id}`} className="btn btn-gold">Edit listing</Link>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>Delete listing</button>
              </>
            ) : user ? (
              <>
                <button type="button" className={`btn ${listing.is_saved ? 'btn-ghost' : 'btn-gold'}`} disabled={busy} onClick={toggleSave}>
                  {listing.is_saved ? 'Saved ✓ (tap to remove)' : 'Save listing'}
                </button>
                <form onSubmit={send} className="grid gap-2">
                  <label htmlFor="msg" className="label mb-0">Message {listing.owner.display_name}</label>
                  <textarea id="msg" required maxLength={2000} className="input min-h-24" placeholder="Hi! Is this still available?" value={message} onChange={(e) => setMessage(e.target.value)} />
                  <button type="submit" className="btn btn-cardinal" disabled={busy || !message.trim()}>Send message</button>
                </form>
              </>
            ) : (
              <Link href={`/login?next=/listings/${listing.id}`} className="btn btn-gold">Sign in to save or message</Link>
            )}
          </div>
        </section>

        {listing.match && (
          <section className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-bold">Your match</h2>
              <ScoreRing score={listing.match.score} size={68} />
            </div>
            <div className="mt-4"><FactorBars match={listing.match} dense /></div>
          </section>
        )}
        <RiskPanel risk={listing.risk} />
        <BenchmarkPanel benchmark={listing.benchmark} rent={listing.monthly_rent} />
      </aside>
    </div>
  )
}
