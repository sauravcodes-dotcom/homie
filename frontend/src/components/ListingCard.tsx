import Link from 'next/link'
import { Tilt } from './Tilt'
import type { Listing, MatchResult } from '@/lib/api'
import { dateRange, TYPE_LABEL, usd } from '@/lib/format'

/** Photo, or a generated cardinal-and-gold tile when the lister added none. */
export function ListingPhoto({ listing, className = '' }: { listing: Pick<Listing, 'id' | 'photos' | 'title'>; className?: string }) {
  if (listing.photos[0]) {
    // Photos are user uploads served by the API, so next/image optimisation is not set up for them.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={listing.photos[0]} alt="" className={`object-cover ${className}`} loading="lazy" />
  }
  const angle = (listing.id * 47) % 360
  return (
    <div
      className={`grid place-items-center ${className}`}
      style={{
        background: `linear-gradient(${angle}deg, #990000, #4d0000 55%, #b38f00 140%)`,
      }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-14 opacity-40">
        <path d="M3 12 12 3.5 21 12v8a1.5 1.5 0 0 1-1.5 1.5H15V15H9v6.5H4.5A1.5 1.5 0 0 1 3 20z" fill="#FFCC00" />
      </svg>
    </div>
  )
}

export function ListingCard({ listing, match }: { listing: Listing; match?: MatchResult }) {
  const risky = listing.risk && listing.risk.level !== 'low'
  return (
    <Tilt className="h-full">
    <Link href={`/listings/${listing.id}`} className="card card-hover group block h-full overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden">
        <ListingPhoto listing={listing} className="size-full transition-transform duration-500 group-hover:scale-105" />
        <span className="chip absolute top-3 left-3 border-transparent bg-black/60 text-white backdrop-blur">
          {TYPE_LABEL[listing.listing_type]}
        </span>
        {match && (
          <span className="display absolute top-3 right-3 grid size-12 place-items-center rounded-full bg-gold text-lg font-extrabold text-[#1d0808] shadow-lg">
            {match.score}
          </span>
        )}
        {risky && (
          <span className={`chip absolute bottom-3 left-3 backdrop-blur ${listing.risk!.level === 'high' ? 'chip-bad' : 'chip-warn'} bg-black/70`}>
            {listing.risk!.level === 'high' ? 'Red flags' : 'Check details'}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="display text-3xl font-extrabold">
            {usd(listing.monthly_rent)}
            <span className="font-sans text-sm font-medium tracking-normal text-ink-soft"> /mo</span>
          </p>
          {listing.travel && (
            <span className="text-xs font-semibold text-ink-soft">{listing.travel.walk_minutes} min walk</span>
          )}
        </div>
        <h3 className="mt-1.5 line-clamp-1 font-semibold">{listing.title}</h3>
        <p className="mt-1 line-clamp-1 text-sm text-ink-soft">
          {[listing.neighborhood, dateRange(listing.available_from, listing.available_to)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </Link>
    </Tilt>
  )
}
