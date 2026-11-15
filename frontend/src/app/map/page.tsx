'use client'

import Link from 'next/link'
import { ErrorNote, PageHeader } from '@/components/Bits'
import { MapView } from '@/components/MapView'
import type { MapPoint } from '@/lib/api'
import { usd } from '@/lib/format'
import { useApi } from '@/lib/hooks'

export default function MapPage() {
  const { data, error } = useApi<MapPoint[]>('/map/listings')
  const sorted = [...(data ?? [])].sort((a, b) => a.travel.walk_minutes - b.travel.walk_minutes)

  return (
    <>
      <PageHeader eyebrow="Around campus" title="How far is it, really?">
        Every listing with a location, and rings showing roughly how long the walk to campus is.
      </PageHeader>
      <div className="shell grid gap-6 pb-20 lg:grid-cols-[1.7fr_1fr]">
        <div>
          <MapView points={data ?? []} rings className="h-[34rem]" />
          <p className="mt-3 text-xs text-ink-soft">
            Walk and bike times are estimates from straight-line distance to the center of campus
            (3 mph walking, 10 mph biking, plus 30% for real streets). Hold Ctrl or use the buttons to zoom.
          </p>
        </div>
        <div>
          <ErrorNote message={error} />
          <h2 className="font-display text-xl font-bold">Closest first</h2>
          <ul className="mt-3 grid gap-2.5">
            {sorted.map((p) => (
              <li key={p.id}>
                <Link href={`/listings/${p.id}`} className="card card-hover flex items-center justify-between gap-4 p-4">
                  <span className="min-w-0">
                    <span className="line-clamp-1 font-semibold">{p.title}</span>
                    <span className="text-sm text-ink-soft">
                      {p.travel.walk_minutes} min walk · {p.travel.bike_minutes} min bike · {p.travel.miles} mi
                    </span>
                  </span>
                  <span className="display text-2xl font-extrabold">{usd(p.monthly_rent)}</span>
                </Link>
              </li>
            ))}
            {data && data.length === 0 && <li className="text-ink-soft">No listings have a location yet.</li>}
          </ul>
        </div>
      </div>
    </>
  )
}
