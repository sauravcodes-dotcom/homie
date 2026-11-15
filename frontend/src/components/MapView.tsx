'use client'

import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { useEffect, useRef } from 'react'
import type { MapPoint } from '@/lib/api'
import { TYPE_LABEL, usd } from '@/lib/format'

// USC University Park campus (Tommy Trojan), same point the API measures from.
export const CAMPUS: [number, number] = [34.0205, -118.2856]
// Mirrors backend/app/services/listings/geo.py.
const WALK_MPH = 3
const DETOUR = 1.3
const METERS_PER_MILE = 1609.34
const WALK_RINGS = [5, 10, 15, 20]

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function MapView({
  points = [],
  picked = null,
  onPick,
  rings = false,
  className = 'h-[28rem]',
}: {
  points?: MapPoint[]
  picked?: { lat: number; lng: number } | null
  onPick?: (lat: number, lng: number) => void
  rings?: boolean
  className?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const layer = useRef<LayerGroup | null>(null)
  const leaflet = useRef<typeof import('leaflet') | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    void import('leaflet').then((mod) => {
      const L = mod.default ?? mod
      if (cancelled || !el.current || map.current) return
      leaflet.current = L
      const m = L.map(el.current, { scrollWheelZoom: false }).setView(CAMPUS, 14)
      map.current = m

      // OpenStreetMap's standard tiles need no key. Dark theme dims them with a CSS filter.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'map-tiles',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m)

      if (rings) {
        for (const minutes of WALK_RINGS) {
          const meters = ((minutes / 60) * WALK_MPH * METERS_PER_MILE) / DETOUR
          L.circle(CAMPUS, {
            radius: meters,
            color: '#ffcc00',
            weight: 1,
            dashArray: '4 6',
            fillOpacity: 0.03,
            interactive: false,
          }).addTo(m)
          L.marker([CAMPUS[0] + meters / 111320, CAMPUS[1]], {
            interactive: false,
            icon: L.divIcon({
              className: '',
              html: `<span style="font-size:11px;font-weight:700;color:#ffcc00;text-shadow:0 1px 3px #000;white-space:nowrap;transform:translate(-50%,-100%);display:block">${minutes} min walk</span>`,
            }),
          }).addTo(m)
        }
      }
      L.marker(CAMPUS, {
        interactive: false,
        icon: L.divIcon({ className: 'campus-pin', html: 'USC' }),
      }).addTo(m)

      layer.current = L.layerGroup().addTo(m)
      m.on('click', (e) => onPickRef.current?.(e.latlng.lat, e.latlng.lng))
      // Signal the marker effect below that the map is ready.
      el.current.dispatchEvent(new Event('homie-map-ready'))
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
      layer.current = null
    }
  }, [rings])

  // Redraw markers whenever the data changes (or once the map finishes loading).
  useEffect(() => {
    const draw = () => {
      const L = leaflet.current
      const m = map.current
      const group = layer.current
      if (!L || !m || !group) return
      group.clearLayers()
      for (const p of points) {
        L.marker([p.latitude, p.longitude], {
          icon: L.divIcon({ className: 'price-pin', html: usd(p.monthly_rent) }),
          title: p.title,
        })
          .bindPopup(
            `<strong>${esc(p.title)}</strong><br>${usd(p.monthly_rent)}/mo · ${esc(TYPE_LABEL[p.listing_type])}<br>` +
              `${p.travel.walk_minutes} min walk · ${p.travel.bike_minutes} min bike (est.)<br>` +
              `<a href="/listings/${p.id}">View listing →</a>`,
          )
          .addTo(group)
      }
      if (picked) {
        L.marker([picked.lat, picked.lng], {
          icon: L.divIcon({ className: 'price-pin', html: 'Here' }),
        }).addTo(group)
      }
      if (points.length > 1) {
        m.fitBounds(L.latLngBounds([CAMPUS, ...points.map((p) => [p.latitude, p.longitude] as [number, number])]).pad(0.15))
      }
    }
    draw()
    const node = el.current
    node?.addEventListener('homie-map-ready', draw)
    return () => node?.removeEventListener('homie-map-ready', draw)
  }, [points, picked])

  return (
    <div
      ref={el}
      className={`relative z-0 overflow-hidden rounded-3xl border border-line ${className}`}
      role="application"
      aria-label={onPick ? 'Map. Click to set the location.' : 'Map of listings near USC'}
    />
  )
}
