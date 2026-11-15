import type { ListingType } from './api'

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function formatDate(iso: string): string {
  // Dates from the API are calendar dates; parse as local to avoid an off-by-one.
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return dateFmt.format(new Date(y, m - 1, d))
}

export function formatRange(from: string, to: string | null): string {
  return to ? `${formatDate(from)} to ${formatDate(to)}` : `From ${formatDate(from)}`
}

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  sublease: 'Sublease',
  lease_takeover: 'Lease takeover',
  room: 'Room',
  roommate_replacement: 'Roommate replacement',
}

export function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}
