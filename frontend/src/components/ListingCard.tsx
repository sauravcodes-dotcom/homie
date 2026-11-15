import type { ReactNode } from 'react'
import type { Listing } from '../lib/api'
import { formatRange, LISTING_TYPE_LABEL, money } from '../lib/format'
import { Stars } from './Stars'

export function ListingCard({ listing: l, aside }: { listing: Listing; aside?: ReactNode }) {
  return (
    <a
      href={`#/listings/${l.id}`}
      className="block h-full rounded-[24px] border border-ink/10 bg-white/70 p-6 hover:border-jacaranda/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-soft">
            {LISTING_TYPE_LABEL[l.listing_type]}
            {l.neighborhood && `, ${l.neighborhood}`}
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold leading-tight">{l.title}</h3>
          <p className="mt-1 truncate text-sm text-ink-soft">
            {[l.building_name, l.unit && `Unit ${l.unit}`].filter(Boolean).join(', ')}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="font-display text-2xl font-bold">{money(l.monthly_rent)}</span>
          <span className="block text-xs text-ink-soft">per month</span>
        </p>
      </div>
      <p className="mt-3 text-sm">{formatRange(l.available_from, l.available_to)}</p>
      {aside}
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
  )
}
