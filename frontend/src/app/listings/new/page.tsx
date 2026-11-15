'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, RiskPanel } from '@/components/Bits'
import { MapView } from '@/components/MapView'
import {
  get,
  post,
  put,
  upload,
  type Lifestyle,
  type ListingDetail,
  type ListingInput,
  type ListingType,
  type RiskReport,
} from '@/lib/api'
import { useRequireAuth } from '@/lib/auth'
import { NEIGHBORHOODS, todayISO, TYPE_LABEL } from '@/lib/format'

const TYPES = Object.keys(TYPE_LABEL) as ListingType[]
const MAX_PHOTOS = 10

const EMPTY: ListingInput = {
  listing_type: 'sublease',
  title: '',
  description: '',
  monthly_rent: 1200,
  available_from: todayISO(),
  available_to: null,
  neighborhood: 'University Park',
  latitude: null,
  longitude: null,
  apartment_id: null,
  building_name: null,
  address: null,
  unit: null,
  lifestyle: {},
  photos: [],
}

function Tri({
  label,
  value,
  onChange,
  yes = 'Yes',
  no = 'No',
}: {
  label: string
  value: boolean | null | undefined
  onChange: (v: boolean | null) => void
  yes?: string
  no?: string
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        {([[true, yes], [false, no]] as const).map(([v, text]) => (
          <button key={text} type="button" aria-pressed={value === v} className="select-pill py-1.5 text-sm" onClick={() => onChange(value === v ? null : v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function Form() {
  const { ready } = useRequireAuth()
  const router = useRouter()
  const editId = useSearchParams().get('edit')
  const [form, setForm] = useState<ListingInput>(EMPTY)
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftSource, setDraftSource] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [risk, setRisk] = useState<RiskReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !editId) return
    get<ListingDetail>(`/listings/${editId}`)
      .then((l) => {
        if (!l.is_mine) {
          router.replace(`/listings/${l.id}`)
          return
        }
        setIsActive(l.is_active)
        setForm({
          listing_type: l.listing_type,
          title: l.title,
          description: l.description,
          monthly_rent: l.monthly_rent,
          available_from: l.available_from,
          available_to: l.available_to,
          neighborhood: l.neighborhood,
          latitude: l.latitude,
          longitude: l.longitude,
          apartment_id: l.apartment_id,
          building_name: null,
          address: null,
          unit: l.unit,
          lifestyle: l.lifestyle,
          photos: l.photos,
        })
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the listing'))
  }, [ready, editId, router])

  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const life = (patch: Lifestyle) => setForm((f) => ({ ...f, lifestyle: { ...f.lifestyle, ...patch } }))

  // Preview the red-flag check as the lister types, so honest listers can fix wording.
  useEffect(() => {
    if (!form.title && !form.description) return
    const timer = setTimeout(() => {
      post<RiskReport>('/ai/risk-check', {
        title: form.title,
        description: form.description,
        monthly_rent: form.monthly_rent || 1,
        neighborhood: form.neighborhood,
        apartment_id: form.apartment_id,
        has_photos: form.photos.length > 0,
      })
        .then(setRisk)
        .catch(() => undefined)
    }, 600)
    return () => clearTimeout(timer)
  }, [form.title, form.description, form.monthly_rent, form.neighborhood, form.apartment_id, form.photos.length])

  const writeDraft = async () => {
    setDrafting(true)
    setError(null)
    try {
      const d = await post<{ title: string; description: string; generated_by: string }>('/ai/listing-draft', {
        notes,
        listing_type: form.listing_type,
        monthly_rent: form.monthly_rent || null,
        neighborhood: form.neighborhood,
        available_from: form.available_from || null,
        available_to: form.available_to,
      })
      setForm((f) => ({ ...f, title: d.title || f.title, description: d.description || f.description }))
      setDraftSource(d.generated_by)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write a draft')
    } finally {
      setDrafting(false)
    }
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      const room = MAX_PHOTOS - form.photos.length
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, room)) {
        urls.push((await upload<{ url: string }>('/uploads/photo', file)).url)
      }
      setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body = {
      ...form,
      building_name: form.building_name?.trim() || null,
      address: form.address?.trim() || null,
      unit: form.unit?.trim() || null,
      available_to: form.available_to || null,
    }
    try {
      const saved = editId
        ? await put<{ id: number }>(`/listings/${editId}`, { ...body, is_active: isActive })
        : await post<{ id: number }>('/listings', body)
      router.push(`/listings/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the listing')
      setBusy(false)
    }
  }

  if (!ready) return <div className="shell py-16"><div className="skeleton h-96" /></div>

  return (
    <>
      <PageHeader eyebrow={editId ? 'Edit' : 'New listing'} title={editId ? 'Edit your listing' : 'Post your place'}>
        Rough notes are enough. HOMIE can turn them into a listing, and checks it for red flags
        before anyone sees it.
      </PageHeader>

      <form onSubmit={submit} className="shell grid gap-6 pb-24 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-6">
          <section className="card grid gap-5 p-6">
            <div>
              <span className="label">What are you posting?</span>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button key={t} type="button" aria-pressed={form.listing_type === t} className="select-pill" onClick={() => set('listing_type', t)}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="rent">Rent per month ($)</label>
                <input id="rent" type="number" required min={1} max={20000} className="input" value={form.monthly_rent || ''} onChange={(e) => set('monthly_rent', Number(e.target.value))} />
              </div>
              <div>
                <label className="label" htmlFor="from">Available from</label>
                <input id="from" type="date" required className="input" value={form.available_from} onChange={(e) => set('available_from', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="to">Until (optional)</label>
                <input id="to" type="date" className="input" min={form.available_from} value={form.available_to ?? ''} onChange={(e) => set('available_to', e.target.value || null)} />
              </div>
            </div>
          </section>

          <section className="card grid gap-4 p-6">
            <div>
              <h2 className="font-display text-xl font-bold">Let HOMIE write it</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Paste rough notes. The writer only uses what you give it and never invents amenities.
              </p>
            </div>
            <textarea className="input min-h-24" aria-label="Rough notes" maxLength={3000} placeholder={'furnished, shared bath\n5 min walk to campus\nparking spot included'} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-cardinal" disabled={drafting || notes.trim().length < 3} onClick={writeDraft}>
                {drafting ? 'Writing…' : 'Write my listing'}
              </button>
              {draftSource === 'offline' && (
                <span className="text-xs text-ink-soft">No AI model is configured, so your notes were tidied rather than rewritten.</span>
              )}
            </div>
          </section>

          <section className="card grid gap-4 p-6">
            <div>
              <label className="label" htmlFor="title">Title</label>
              <input id="title" required minLength={3} maxLength={200} className="input" placeholder="Private room in a 2-bed on Ellendale" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="desc">Description</label>
              <textarea id="desc" maxLength={6000} className="input min-h-40" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
          </section>

          <section className="card grid gap-4 p-6">
            <h2 className="font-display text-xl font-bold">Where is it?</h2>
            {form.apartment_id ? (
              <p className="text-sm text-ink-soft">
                Linked to a building already.{' '}
                <button type="button" className="font-bold text-accent" onClick={() => set('apartment_id', null)}>Change building</button>
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="bname">Building name (optional)</label>
                  <input id="bname" minLength={2} maxLength={200} className="input" placeholder="Building or complex name" value={form.building_name ?? ''} onChange={(e) => set('building_name', e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="addr">Street address</label>
                  <input id="addr" minLength={5} maxLength={300} required={!!form.building_name?.trim()} className="input" placeholder="1201 W 30th St, Los Angeles" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="unit">Unit (optional)</label>
                <input id="unit" maxLength={40} className="input" value={form.unit ?? ''} onChange={(e) => set('unit', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="hood">Neighborhood</label>
                <select id="hood" className="input" value={form.neighborhood ?? ''} onChange={(e) => set('neighborhood', e.target.value || null)}>
                  <option value="">Not sure</option>
                  {NEIGHBORHOODS.map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <span className="label">
                Drop a pin (optional). Click the map near your place; it powers walk times and the map view.
              </span>
              <MapView
                className="h-72"
                rings
                picked={form.latitude !== null && form.longitude !== null ? { lat: form.latitude, lng: form.longitude } : null}
                onPick={(lat, lng) => setForm((f) => ({ ...f, latitude: Number(lat.toFixed(5)), longitude: Number(lng.toFixed(5)) }))}
              />
              {form.latitude !== null && (
                <button type="button" className="mt-2 text-sm font-bold text-accent" onClick={() => setForm((f) => ({ ...f, latitude: null, longitude: null }))}>
                  Remove pin
                </button>
              )}
            </div>
          </section>

          <section className="card grid gap-5 p-6">
            <div>
              <h2 className="font-display text-xl font-bold">The household</h2>
              <p className="mt-1 text-sm text-ink-soft">Optional, but it is what makes matching work.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <span className="label">Sleep schedule</span>
                <div className="flex flex-wrap gap-2">
                  {(['early', 'flexible', 'late'] as const).map((s) => (
                    <button key={s} type="button" aria-pressed={form.lifestyle.sleep_schedule === s} className="select-pill py-1.5 text-sm capitalize" onClick={() => life({ sleep_schedule: form.lifestyle.sleep_schedule === s ? null : s })}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">Cleanliness (1 relaxed, 5 spotless)</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-pressed={form.lifestyle.cleanliness === n} className="select-pill px-3.5 py-1.5 text-sm" onClick={() => life({ cleanliness: form.lifestyle.cleanliness === n ? null : n })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Tri label="Smoking" value={form.lifestyle.smoking} onChange={(v) => life({ smoking: v })} yes="Allowed" no="No smoking" />
              <Tri label="Drinking" value={form.lifestyle.drinking} onChange={(v) => life({ drinking: v })} yes="Fine" no="No drinking" />
              <Tri label="Pets" value={form.lifestyle.pets} onChange={(v) => life({ pets: v })} yes="Pets here" no="No pets" />
              <div>
                <span className="label">Kitchen</span>
                <div className="flex gap-2">
                  {([['veg', 'Vegetarian'], ['non_veg', 'Non-veg']] as const).map(([v, text]) => (
                    <button key={v} type="button" aria-pressed={form.lifestyle.diet === v} className="select-pill py-1.5 text-sm" onClick={() => life({ diet: form.lifestyle.diet === v ? null : v })}>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-24 lg:self-start">
          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">Photos</h2>
            <p className="mt-1 text-sm text-ink-soft">Up to {MAX_PHOTOS}. JPEG, PNG or WebP, 8 MB each.</p>
            {form.photos.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-2">
                {form.photos.map((src, i) => (
                  <li key={src} className="relative aspect-square overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                    <button type="button" aria-label={`Remove photo ${i + 1}`} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/70 text-sm text-white" onClick={() => set('photos', form.photos.filter((p) => p !== src))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {form.photos.length < MAX_PHOTOS && (
              <label className="btn btn-ghost mt-4 w-full cursor-pointer">
                {uploading ? 'Uploading…' : 'Add photos'}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} />
              </label>
            )}
          </section>

          <RiskPanel risk={risk} />

          {editId && (
            <label className="card flex items-center gap-3 p-5">
              <input type="checkbox" className="size-4 accent-[var(--gold)]" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>
                <span className="font-semibold">Still available</span>
                <span className="block text-sm text-ink-soft">Untick once the room is taken.</span>
              </span>
            </label>
          )}

          <ErrorNote message={error} />
          <button type="submit" className="btn btn-gold py-4 text-base" disabled={busy || uploading}>
            {busy ? 'Saving…' : editId ? 'Save changes' : 'Post listing'}
          </button>
        </aside>
      </form>
    </>
  )
}

export default function NewListing() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  )
}
