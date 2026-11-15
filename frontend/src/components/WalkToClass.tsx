'use client'

import 'leaflet/dist/leaflet.css'
import type { CircleMarker, LayerGroup, Map as LeafletMap } from 'leaflet'
import { animate, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/* Pick where you go most on campus and watch the walk draw itself there, minutes counting up.
   The route follows the street grid in two legs (east-west, then north-south), which is how
   most walks around USC go. It is an estimate, not turn-by-turn directions. */

// Approximate entrances, good to a few dozen meters.
const PLACES = [
  { id: 'tommy', name: 'Tommy Trojan', lat: 34.0205, lng: -118.2856 },
  { id: 'leavey', name: 'Leavey Library', lat: 34.0218, lng: -118.2829 },
  { id: 'doheny', name: 'Doheny Library', lat: 34.0202, lng: -118.2838 },
  { id: 'viterbi', name: 'Viterbi (Tutor Hall)', lat: 34.0201, lng: -118.2899 },
  { id: 'marshall', name: 'Marshall', lat: 34.0189, lng: -118.2853 },
  { id: 'annenberg', name: 'Annenberg', lat: 34.0226, lng: -118.2868 },
  { id: 'cinema', name: 'Cinematic Arts', lat: 34.0233, lng: -118.2863 },
  { id: 'village', name: 'USC Village', lat: 34.0256, lng: -118.2851 },
  { id: 'lyon', name: 'Lyon Center', lat: 34.0244, lng: -118.2884 },
] as const
type PlaceId = (typeof PLACES)[number]['id']

const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((34.02 * Math.PI) / 180)
const WALK_M_PER_MIN = 80.5 // 3 mph

function route(from: [number, number], to: [number, number]) {
  const corner: [number, number] = [from[0], to[1]]
  const meters = Math.abs(to[1] - from[1]) * M_PER_DEG_LNG + Math.abs(to[0] - from[0]) * M_PER_DEG_LAT
  return { path: [from, corner, to], meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)) }
}

export function WalkToClass({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const layer = useRef<LayerGroup | null>(null)
  const L = useRef<typeof import('leaflet') | null>(null)
  const [ready, setReady] = useState(false)
  const [place, setPlace] = useState<PlaceId>('tommy')
  const [shown, setShown] = useState(0)
  const dest = PLACES.find((p) => p.id === place)!
  const r = route([lat, lng], [dest.lat, dest.lng])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('homie-walk-to') as PlaceId | null
      if (saved && PLACES.some((p) => p.id === saved)) setPlace(saved)
    } catch {
      /* default */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void import('leaflet').then((mod) => {
      const lf = mod.default ?? mod
      if (cancelled || !el.current || map.current) return
      L.current = lf
      const m = lf.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView([lat, lng], 15)
      lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'map-tiles',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m)
      layer.current = lf.layerGroup().addTo(m)
      map.current = m
      setReady(true)
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
  }, [lat, lng])

  // Draw the walk whenever the destination changes.
  useEffect(() => {
    const lf = L.current
    const m = map.current
    const group = layer.current
    if (!ready || !lf || !m || !group) return
    group.clearLayers()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    lf.polyline(r.path, { color: '#000', weight: 9, opacity: 0.35, interactive: false }).addTo(group)
    const line = lf.polyline(r.path, { color: '#ffcc00', weight: 5, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(group)
    lf.marker([lat, lng], { interactive: false, icon: lf.divIcon({ className: 'price-pin', html: 'Home' }) }).addTo(group)
    lf.marker([dest.lat, dest.lng], { interactive: false, icon: lf.divIcon({ className: 'campus-pin', html: dest.name }) }).addTo(group)
    const walker: CircleMarker = lf
      .circleMarker([lat, lng], { radius: 8, color: '#1d0808', weight: 3, fillColor: '#ffcc00', fillOpacity: 1, interactive: false })
      .addTo(group)
    m.fitBounds(lf.latLngBounds(r.path).pad(0.35), { animate: !reduce })

    const path = line.getElement() as SVGPathElement | undefined
    const length = path?.getTotalLength?.() ?? 0
    if (path && length && !reduce) {
      path.style.strokeDasharray = `${length}`
      path.style.strokeDashoffset = `${length}`
    }
    // Position along the two legs for a 0..1 progress.
    const legs = [r.path[0], r.path[1], r.path[2]]
    const d1 = Math.abs(legs[1][1] - legs[0][1]) * M_PER_DEG_LNG
    const d2 = Math.abs(legs[2][0] - legs[1][0]) * M_PER_DEG_LAT
    const at = (k: number): [number, number] => {
      const dist = k * (d1 + d2)
      if (dist <= d1 || d2 === 0) {
        const t = d1 ? dist / d1 : 1
        return [legs[0][0], legs[0][1] + (legs[1][1] - legs[0][1]) * t]
      }
      const t = (dist - d1) / d2
      return [legs[1][0] + (legs[2][0] - legs[1][0]) * t, legs[1][1]]
    }
    const controls = animate(0, 1, {
      duration: reduce ? 0 : 2.2,
      delay: reduce ? 0 : 0.35,
      ease: [0.45, 0, 0.2, 1],
      onUpdate: (k) => {
        if (path && length && !reduce) path.style.strokeDashoffset = `${length * (1 - k)}`
        walker.setLatLng(at(k))
        setShown(Math.round(k * r.minutes))
      },
    })
    return () => controls.stop()
  }, [ready, place, lat, lng, dest.lat, dest.lng, dest.name, r.minutes]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: PlaceId) => {
    setPlace(id)
    try {
      localStorage.setItem('homie-walk-to', id)
    } catch {
      /* not persisted */
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold">Your walk to class</h3>
          <p className="mt-1 text-sm text-ink-soft">Pick where you go most. It remembers your choice.</p>
        </div>
        <div className="text-right" aria-live="polite">
          <p className="display text-5xl font-extrabold tabular-nums text-accent">
            {shown}
            <span className="font-sans text-base font-semibold text-ink-soft"> min</span>
          </p>
          <p className="text-xs text-ink-soft">
            to {dest.name} · {(r.meters / 1609.34).toFixed(2)} mi
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Where you walk to">
        {PLACES.map((p) => {
          const on = p.id === place
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(p.id)}
              className={`relative rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${on ? 'border-gold text-[#1d0808]' : 'border-line text-ink-soft hover:text-ink'}`}
            >
              {on && <motion.span layoutId="walk-place" className="absolute inset-0 -z-0 rounded-full bg-gold" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{p.name}</span>
            </button>
          )
        })}
      </div>
      <div
        ref={el}
        className="relative z-0 mt-4 h-80 overflow-hidden rounded-3xl border border-line"
        role="img"
        aria-label={`Map of the walk from ${title} to ${dest.name}, about ${r.minutes} minutes`}
      />
      <p className="mt-2 text-xs text-ink-soft">
        Estimated along the street grid at 3 mph. Not turn-by-turn directions; campus points are approximate.
      </p>
    </div>
  )
}
