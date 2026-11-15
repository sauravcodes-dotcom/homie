import type { ListingType } from './api'

export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const DATE_Y = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Format a YYYY-MM-DD or ISO timestamp without shifting the calendar day. */
export function day(value: string | null | undefined, withYear = false) {
  if (!value) return ''
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  return (withYear ? DATE_Y : DATE).format(d)
}

export function dateRange(from: string, to: string | null) {
  return to ? `${day(from)} to ${day(to, true)}` : `From ${day(from, true)}`
}

export function timeAgo(iso: string | null) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export const TYPE_LABEL: Record<ListingType, string> = {
  sublease: 'Sublease',
  lease_takeover: 'Lease takeover',
  room: 'Room',
  roommate_replacement: 'Roommate wanted',
}

export const FACTOR_LABEL: Record<string, string> = {
  budget: 'Rent',
  dates: 'Dates',
  location: 'Location',
  lifestyle: 'Lifestyle',
  personality: 'Personality',
  semantic: 'Vibe',
}

export const NEIGHBORHOODS = [
  'University Park',
  'North University Park',
  'Figueroa Corridor',
  'Exposition Park',
  'West Adams',
  'Jefferson Park',
  'Downtown LA',
  'Koreatown',
]

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** Today's date in the visitor's own time zone, as YYYY-MM-DD. */
export function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
