import type { ListingType } from '@/lib/api'

// Kept apart from CityScene so pages can use these without pulling in three.js.
export const PIN_COLOR: Record<ListingType, string> = {
  sublease: '#ff4d4d',
  room: '#ffcc00',
  lease_takeover: '#ff8a3d',
  roommate_replacement: '#ff7eb6',
}

export type CityPin = { id: number; lat: number; lng: number; rent: number; kind: ListingType; title: string; sub: string }
export type CityFocus = { lat: number; lng: number; label: string }
