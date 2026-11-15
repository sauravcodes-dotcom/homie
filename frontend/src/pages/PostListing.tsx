import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api, ApiError, type NewListing } from '../lib/api'
import { useAuth } from '../lib/auth'
import { navigate } from '../lib/router'

const input = 'rounded-xl border border-ink/15 bg-white px-4 py-3 text-base font-normal'

export function PostListing() {
  const { user, loading } = useAuth()
  const [form, setForm] = useState({
    title: '',
    building_name: '',
    address: '',
    unit: '',
    monthly_rent: '',
    available_from: '',
    available_to: '',
    description: '',
    smoking: false,
    drinking: false,
    diet: '' as '' | 'veg' | 'non_veg',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && !user) navigate('/signin?next=/post')
  }, [loading, user])

  if (loading || !user) return null

  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const payload: NewListing = {
      listing_type: 'sublease',
      title: form.title,
      description: form.description,
      building_name: form.building_name,
      address: form.address,
      unit: form.unit || undefined,
      monthly_rent: Number(form.monthly_rent),
      available_from: form.available_from,
      available_to: form.available_to || undefined,
      lifestyle: {
        smoking: form.smoking,
        drinking: form.drinking,
        ...(form.diet ? { diet: form.diet } : {}),
      },
    }
    try {
      const created = await api.createListing(payload)
      navigate(`/listings/${created.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The listing could not be posted. Try again.')
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <h1 className="display text-5xl font-extrabold">Post your sublease</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Once it is posted, you can add notes about your roommates from the listing page.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-5">
        <Field label="Title">
          <input
            className={input}
            required
            minLength={3}
            placeholder="Private room in a 2-bed near campus"
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field label="Building">
            <input
              className={input}
              required
              minLength={2}
              placeholder="The Residences at Lorenzo"
              value={form.building_name}
              onChange={(e) => set('building_name')(e.target.value)}
            />
          </Field>
          <Field label="Unit (optional)">
            <input className={input} value={form.unit} onChange={(e) => set('unit')(e.target.value)} />
          </Field>
        </div>
        <Field label="Address">
          <input
            className={input}
            required
            minLength={5}
            placeholder="325 W Adams Blvd, Los Angeles, CA 90007"
            value={form.address}
            onChange={(e) => set('address')(e.target.value)}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Monthly rent (USD)">
            <input
              className={input}
              required
              type="number"
              min={1}
              value={form.monthly_rent}
              onChange={(e) => set('monthly_rent')(e.target.value)}
            />
          </Field>
          <Field label="Available from">
            <input
              className={input}
              required
              type="date"
              value={form.available_from}
              onChange={(e) => set('available_from')(e.target.value)}
            />
          </Field>
          <Field label="Until (optional)">
            <input
              className={input}
              type="date"
              value={form.available_to}
              onChange={(e) => set('available_to')(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description (optional)">
          <textarea
            className={input}
            rows={4}
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
          />
        </Field>
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">The household</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.smoking} onChange={(e) => set('smoking')(e.target.checked)} />
              Smoking is fine
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.drinking} onChange={(e) => set('drinking')(e.target.checked)} />
              Drinking is fine
            </label>
            <label className="flex items-center gap-2">
              Kitchen
              <select
                className="rounded-lg border border-ink/15 bg-white px-2 py-1"
                value={form.diet}
                onChange={(e) => set('diet')(e.target.value)}
              >
                <option value="">No preference</option>
                <option value="veg">Vegetarian</option>
                <option value="non_veg">Non-veg</option>
              </select>
            </label>
          </div>
        </fieldset>
        {error && <p className="text-sm text-alert">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="justify-self-start rounded-full bg-jacaranda px-6 py-3 font-semibold text-petal hover:bg-jacaranda-dark disabled:opacity-60"
        >
          {busy ? 'Posting…' : 'Post sublease'}
        </button>
      </form>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      {children}
    </label>
  )
}
