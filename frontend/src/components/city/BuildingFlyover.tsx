'use client'

import { motion } from 'motion/react'
import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import type { BuildingDetail, MapPoint } from '@/lib/api'
import { usd } from '@/lib/format'
import { useApi } from '@/lib/hooks'
import type { CityPin } from './shared'

const CityScene = dynamic(() => import('./CityScene'), {
  ssr: false,
  loading: () => <div className="skeleton h-full rounded-3xl" />,
})

const CAMPUS = { lat: 34.0205, lng: -118.2856 }
// Same estimate as the API: straight line, plus 30% for real streets, at 3 mph.
function walkMinutes(lat: number, lng: number) {
  const r = 3958.8
  const dLat = ((lat - CAMPUS.lat) * Math.PI) / 180
  const dLng = ((lng - CAMPUS.lng) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((CAMPUS.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const miles = 2 * r * Math.asin(Math.sqrt(a)) * 1.3
  return Math.max(1, Math.round((miles / 3) * 60))
}

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** The camera glides in from above to this building, then the key numbers float in beside it. */
export function BuildingFlyover({ building: b, rating }: { building: BuildingDetail; rating: number | null }) {
  const [arrived, setArrived] = useState(false)
  const map = useApi<MapPoint[]>('/map/listings')
  const pins = useMemo<CityPin[]>(
    () =>
      (map.data ?? []).map((p) => ({
        id: p.id,
        lat: p.latitude,
        lng: p.longitude,
        rent: p.monthly_rent,
        kind: p.listing_type,
        title: p.title,
        sub: `${usd(p.monthly_rent)}/mo · ${p.travel.walk_minutes} min walk`,
      })),
    [map.data],
  )
  const focus = useMemo(
    () => (b.latitude !== null && b.longitude !== null ? { lat: b.latitude, lng: b.longitude, label: b.name } : null),
    [b.latitude, b.longitude, b.name],
  )
  if (!focus) return null

  const recurring = b.insights?.recurring_issues ?? []
  const cards = [
    {
      at: 'top-4 left-4',
      kicker: b.rating ? 'HOMIE score' : rating !== null ? 'Google rating' : 'Reviews',
      big: rating !== null ? rating.toFixed(1) : String(b.review_count),
      small: rating !== null ? `${b.review_count} HOMIE review${b.review_count === 1 ? '' : 's'} · ${b.verified_count} verified` : 'No rating yet',
    },
    {
      at: 'top-4 right-4 text-right',
      kicker: 'To campus',
      big: `${walkMinutes(focus.lat, focus.lng)} min`,
      small: 'walk, estimated',
    },
    recurring.length
      ? { at: 'bottom-16 left-4', kicker: 'Recurring issues', big: null, small: null, chips: recurring.slice(0, 3).map(titleCase), bad: true }
      : b.median_listing_rent
        ? { at: 'bottom-16 left-4', kicker: 'Median listing rent', big: usd(b.median_listing_rent), small: 'from listings here' }
        : null,
  ].filter(Boolean) as { at: string; kicker: string; big: string | null; small: string | null; chips?: string[]; bad?: boolean }[]

  return (
    <div className="relative mt-8">
      <CityScene
        focus={focus}
        pins={pins}
        rings={false}
        onArrive={() => setArrived(true)}
        onSelect={(id) => id && (window.location.href = `/listings/${id}`)}
        className="h-[24rem] sm:h-[30rem]"
        label={`3D flyover to ${b.name} near USC`}
      />
      {cards.map((c, i) => (
        <motion.div
          key={c.kicker}
          className={`pointer-events-none absolute ${c.at} max-w-[46%] rounded-2xl border bg-bg/75 px-4 py-3 shadow-2xl backdrop-blur-xl ${c.bad ? 'border-bad/50' : 'border-gold/40'}`}
          initial={{ opacity: 0, y: 14, scale: 0.94, filter: 'blur(6px)' }}
          animate={arrived ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : undefined}
          transition={{ delay: 0.15 + i * 0.14, type: 'spring', stiffness: 300, damping: 26 }}
        >
          <p className={`text-[10px] font-bold tracking-[0.2em] uppercase ${c.bad ? 'text-bad' : 'text-accent'}`}>{c.kicker}</p>
          {c.big && <p className="display mt-0.5 text-3xl font-extrabold tabular-nums">{c.big}</p>}
          {c.small && <p className="text-xs text-ink-soft">{c.small}</p>}
          {c.chips && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {c.chips.map((t) => (
                <span key={t} className="chip chip-bad py-0.5 text-[11px]">{t}</span>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
