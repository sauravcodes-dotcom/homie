'use client'

import { AnimatePresence, motion } from 'motion/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ErrorNote, PageHeader } from '@/components/Bits'
import { ListingPhoto } from '@/components/ListingCard'
import { MapView } from '@/components/MapView'
import { PIN_COLOR, type CityPin } from '@/components/city/shared'
import type { ListingType, MapPoint } from '@/lib/api'
import { TYPE_LABEL, usd } from '@/lib/format'
import { useApi } from '@/lib/hooks'

// three.js only downloads when the 3D view is shown.
const CityScene = dynamic(() => import('@/components/city/CityScene'), {
  ssr: false,
  loading: () => <div className="skeleton h-full rounded-3xl" />,
})

type View = '3d' | 'flat'

export default function MapPage() {
  const { data, error } = useApi<MapPoint[]>('/map/listings')
  const [view, setView] = useState<View>('flat')
  const [picked, setPicked] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [types, setTypes] = useState<ListingType[]>([])

  // Mouse and trackpad with motion allowed start in 3D; phones start on the lighter flat map.
  useEffect(() => {
    const saved = (() => {
      try {
        return localStorage.getItem('homie-map-view')
      } catch {
        return null
      }
    })()
    const capable = window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setView(saved === '3d' || saved === 'flat' ? saved : capable ? '3d' : 'flat')
  }, [])
  const choose = (v: View) => {
    setView(v)
    try {
      localStorage.setItem('homie-map-view', v)
    } catch {
      /* not persisted */
    }
  }

  const shown = useMemo(
    () => (data ?? []).filter((p) => types.length === 0 || types.includes(p.listing_type)),
    [data, types],
  )
  const sorted = useMemo(() => [...shown].sort((a, b) => a.travel.walk_minutes - b.travel.walk_minutes), [shown])
  const pins = useMemo<CityPin[]>(
    () =>
      shown.map((p) => ({
        id: p.id,
        lat: p.latitude,
        lng: p.longitude,
        rent: p.monthly_rent,
        kind: p.listing_type,
        title: p.title,
        sub: `${usd(p.monthly_rent)}/mo · ${p.travel.walk_minutes} min walk`,
      })),
    [shown],
  )
  const selected = shown.find((p) => p.id === picked) ?? null

  return (
    <>
      <PageHeader eyebrow="Around campus" title="How far is it, really?">
        Every listing with a location. In 3D, pins stand taller the more a place costs, and gold
        rings ripple out to 5, 10, 15 and 20 minutes on foot from campus.
      </PageHeader>

      <div className="shell mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Map view" className="flex rounded-full border border-line bg-surface p-1">
          {(['3d', 'flat'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => choose(v)}
              className={`relative rounded-full px-5 py-2 text-sm font-bold transition-colors ${view === v ? 'text-[#1d0808]' : 'text-ink-soft hover:text-ink'}`}
            >
              {view === v && <motion.span layoutId="map-view" className="absolute inset-0 -z-0 rounded-full bg-gold" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{v === '3d' ? '3D city' : 'Flat map'}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Show listing types">
          {(Object.keys(TYPE_LABEL) as ListingType[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={types.includes(t)}
              onClick={() => setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}
              className="select-pill flex items-center gap-2 py-1.5 text-sm"
            >
              <span className="size-2.5 rounded-full" style={{ background: PIN_COLOR[t] }} aria-hidden />
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="shell grid gap-6 pb-20 lg:grid-cols-[1.7fr_1fr]">
        <div>
          <div className="relative">
            {view === '3d' ? (
              <CityScene
                pins={pins}
                highlight={hover ?? picked}
                onSelect={setPicked}
                className="h-[38rem]"
                label="3D model of the area around USC with listing pins and walking-time rings"
              />
            ) : (
              <MapView points={shown} rings className="h-[38rem]" />
            )}
            <AnimatePresence>
              {view === '3d' && selected && (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute top-3 left-3 w-72 overflow-hidden rounded-2xl border border-gold/50 bg-bg/85 shadow-2xl backdrop-blur-xl"
                >
                  <div className="relative h-28">
                    <ListingPhoto listing={{ id: selected.id, title: selected.title, photos: selected.photo ? [selected.photo] : [] }} className="size-full" />
                    <button type="button" aria-label="Close" onClick={() => setPicked(null)} className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white">×</button>
                  </div>
                  <div className="p-4">
                    <p className="display text-2xl font-extrabold">{usd(selected.monthly_rent)}<span className="font-sans text-sm font-medium text-ink-soft"> /mo</span></p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold">{selected.title}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {TYPE_LABEL[selected.listing_type]} · {selected.travel.walk_minutes} min walk · {selected.travel.bike_minutes} min bike
                    </p>
                    <Link href={`/listings/${selected.id}`} className="btn btn-gold btn-sm mt-3 w-full">View listing</Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Walk and bike times are estimates from straight-line distance to the center of campus
            (3 mph walking, 10 mph biking, plus 30% for real streets). In 3D the pins and rings are
            to scale; the surrounding blocks are illustrative, not real buildings.
          </p>
        </div>
        <div>
          <ErrorNote message={error} />
          <h2 className="font-display text-xl font-bold">Closest first</h2>
          <ul className="mt-3 grid max-h-[38rem] gap-2.5 overflow-y-auto pr-1">
            {sorted.map((p) => (
              <li key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
                <Link
                  href={`/listings/${p.id}`}
                  className={`card card-hover flex items-center justify-between gap-4 p-4 ${picked === p.id ? 'border-gold' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: PIN_COLOR[p.listing_type] }} aria-hidden />
                      <span className="line-clamp-1 font-semibold">{p.title}</span>
                    </span>
                    <span className="text-sm text-ink-soft">
                      {p.travel.walk_minutes} min walk · {p.travel.bike_minutes} min bike · {p.travel.miles} mi
                    </span>
                  </span>
                  <span className="display text-2xl font-extrabold">{usd(p.monthly_rent)}</span>
                </Link>
              </li>
            ))}
            {data && shown.length === 0 && <li className="text-ink-soft">No listings with a location match.</li>}
          </ul>
        </div>
      </div>
    </>
  )
}
