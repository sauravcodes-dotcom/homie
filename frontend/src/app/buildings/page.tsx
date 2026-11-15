'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDeferredValue, useState } from 'react'
import { Empty, ErrorNote, PageHeader, Stars } from '@/components/Bits'
import { Reveal } from '@/components/Reveal'
import { post, query, type Building } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { NEIGHBORHOODS } from '@/lib/format'
import { useApi } from '@/lib/hooks'

function AddBuilding() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Add a building
      </button>
    )
  }
  return (
    <form
      className="card grid w-full gap-4 p-5 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          const b = await post<Building>('/apartments', { name, address, neighborhood: neighborhood || null })
          router.push(`/buildings/${b.id}`)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not add the building')
          setBusy(false)
        }
      }}
    >
      <div>
        <label className="label" htmlFor="bn">Building name</label>
        <input id="bn" required minLength={2} maxLength={200} className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="ba">Street address</label>
        <input id="ba" required minLength={4} maxLength={300} className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="bh">Neighborhood</label>
        <select id="bh" className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
          <option value="">Not sure</option>
          {NEIGHBORHOODS.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" className="btn btn-gold" disabled={busy}>Add building</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <ErrorNote message={error} />
      </div>
    </form>
  )
}

export default function Buildings() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const params = useDeferredValue(query({ q }))
  const { data, error } = useApi<Building[]>(`/apartments${params}`)

  return (
    <>
      <PageHeader eyebrow="Resident reviews" title="Know the building before you sign.">
        Residents review maintenance, pests, management, safety, noise, internet and what they
        really pay. Every summary shows how many reviews it rests on.
      </PageHeader>
      <div className="shell pb-20">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 flex-1">
            <label className="label" htmlFor="bq">Search buildings</label>
            <input id="bq" type="search" className="input" placeholder="Name, street or neighborhood" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {user ? <AddBuilding /> : <Link href="/login?next=/buildings" className="btn btn-ghost">Sign in to add a building</Link>}
        </div>
        <div className="mt-4"><ErrorNote message={error} /></div>

        {data && data.length === 0 ? (
          <div className="mt-6"><Empty title="No buildings found."><p>Add it and write the first review.</p></Empty></div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {!data && [0, 1, 2].map((i) => <div key={i} className="skeleton h-44" />)}
            {data?.map((b, i) => (
              <Reveal key={b.id} delay={(i % 3) * 0.05} y={24}>
                <Link href={`/buildings/${b.id}`} className="card card-hover flex h-full flex-col p-6">
                  <h2 className="display text-3xl font-bold">{b.name}</h2>
                  <p className="mt-1.5 text-sm text-ink-soft">{[b.address, b.neighborhood].filter(Boolean).join(' · ')}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-sm">
                    {b.average_rating !== null ? (
                      <span className="flex items-center gap-2">
                        <Stars value={b.average_rating} />
                        <span className="font-bold">{b.average_rating.toFixed(1)}</span>
                      </span>
                    ) : (
                      <span className="text-ink-soft">No ratings yet</span>
                    )}
                    <span className="text-ink-soft">
                      {b.review_count} review{b.review_count === 1 ? '' : 's'}
                      {b.verified_count > 0 && `, ${b.verified_count} verified`}
                    </span>
                    {b.listing_count > 0 && <span className="chip chip-gold">{b.listing_count} open</span>}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
