import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ListingCard } from '../components/ListingCard'
import {
  api,
  ApiError,
  NEIGHBORHOODS,
  type Lifestyle,
  type ListingMatch,
  type ListingType,
} from '../lib/api'
import { LISTING_TYPE_LABEL } from '../lib/format'

const field = 'rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm'

type Form = {
  budget: number
  moveIn: string
  moveOut: string
  neighborhoods: string[]
  maxDistance: string
  types: ListingType[]
  sleep: '' | NonNullable<Lifestyle['sleep_schedule']>
  cleanliness: number
  smoking: boolean
  drinking: boolean
  pets: boolean
  diet: '' | 'veg' | 'non_veg'
}

const INITIAL: Form = {
  budget: 1300,
  moveIn: '2027-01-05',
  moveOut: '2027-05-20',
  neighborhoods: ['University Park', 'North University Park'],
  maxDistance: '',
  types: [],
  sleep: '',
  cleanliness: 4,
  smoking: false,
  drinking: false,
  pets: false,
  diet: '',
}

export function Match() {
  const [form, setForm] = useState<Form>(INITIAL)
  const [results, setResults] = useState<ListingMatch[] | null>(null)
  const [scanned, setScanned] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const lifestyle: Lifestyle = {
      cleanliness: form.cleanliness,
      smoking: form.smoking,
      drinking: form.drinking,
      pets: form.pets,
      ...(form.sleep ? { sleep_schedule: form.sleep } : {}),
      ...(form.diet ? { diet: form.diet } : {}),
    }
    try {
      const res = await api.matchListings(
        {
          budget_max: form.budget,
          move_in: form.moveIn,
          ...(form.moveOut ? { move_out: form.moveOut } : {}),
          preferred_neighborhoods: form.neighborhoods,
          ...(form.maxDistance ? { max_distance_miles: Number(form.maxDistance) } : {}),
          lifestyle,
        },
        form.types,
        20,
      )
      setResults(res.results)
      setScanned(res.scanned)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Matching failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="display text-[clamp(2.75rem,7vw,5rem)] font-extrabold">Find my match</h1>
      <p className="mt-3 max-w-[38rem] leading-relaxed text-ink-soft">
        Tell HOMIE what you need. It scores every open listing on rent, dates, location and how
        you live, then shows the best fits and why.
      </p>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[22rem_1fr]">
        <form onSubmit={submit} className="grid gap-6 rounded-[24px] bg-white/70 p-6 lg:sticky lg:top-6">
          <label className="grid gap-2 text-sm font-semibold">
            <span className="flex justify-between">
              Max monthly rent <span className="tabular-nums">${form.budget.toLocaleString()}</span>
            </span>
            <input
              type="range"
              min={700}
              max={4000}
              step={25}
              value={form.budget}
              onChange={(e) => set('budget', Number(e.target.value))}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Move in">
              <input
                type="date"
                required
                className={field}
                value={form.moveIn}
                onChange={(e) => set('moveIn', e.target.value)}
              />
            </Labeled>
            <Labeled label="Move out">
              <input
                type="date"
                className={field}
                value={form.moveOut}
                onChange={(e) => set('moveOut', e.target.value)}
              />
            </Labeled>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">Areas you like</legend>
            {NEIGHBORHOODS.map((n) => (
              <label key={n} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.neighborhoods.includes(n)}
                  onChange={() => set('neighborhoods', toggle(form.neighborhoods, n))}
                />
                {n}
              </label>
            ))}
          </fieldset>

          <Labeled label="Max distance from campus">
            <select className={field} value={form.maxDistance} onChange={(e) => set('maxDistance', e.target.value)}>
              <option value="">No limit</option>
              <option value="0.5">0.5 miles</option>
              <option value="1">1 mile</option>
              <option value="1.5">1.5 miles</option>
              <option value="2">2 miles</option>
            </select>
          </Labeled>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">Listing types (none = all)</legend>
            {(Object.keys(LISTING_TYPE_LABEL) as ListingType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.types.includes(t)}
                  onChange={() => set('types', toggle(form.types, t))}
                />
                {LISTING_TYPE_LABEL[t]}
              </label>
            ))}
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-semibold">How you live</legend>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Sleep schedule">
                <select className={field} value={form.sleep} onChange={(e) => set('sleep', e.target.value as Form['sleep'])}>
                  <option value="">Any</option>
                  <option value="early">Early</option>
                  <option value="flexible">Flexible</option>
                  <option value="late">Late</option>
                </select>
              </Labeled>
              <Labeled label="Diet">
                <select className={field} value={form.diet} onChange={(e) => set('diet', e.target.value as Form['diet'])}>
                  <option value="">Any</option>
                  <option value="veg">Veg</option>
                  <option value="non_veg">Non-veg</option>
                </select>
              </Labeled>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="flex justify-between">
                Cleanliness <span className="text-ink-soft">{form.cleanliness} of 5</span>
              </span>
              <input
                type="range"
                min={1}
                max={5}
                value={form.cleanliness}
                onChange={(e) => set('cleanliness', Number(e.target.value))}
              />
            </label>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {(['smoking', 'drinking', 'pets'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} />
                  {k === 'smoking' ? 'I smoke' : k === 'drinking' ? 'I drink' : 'I have a pet'}
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-jacaranda px-5 py-3 font-semibold text-petal hover:bg-jacaranda-dark disabled:opacity-60"
          >
            {busy ? 'Scoring listings…' : 'Find matches'}
          </button>
        </form>

        <div aria-live="polite">
          {error && <p className="text-alert">{error}</p>}
          {!results && !error && (
            <p className="rounded-[24px] border border-dashed border-ink/20 p-10 text-ink-soft">
              Set your preferences and press Find matches. Your top 20 listings show up here, each
              with the reasons behind its score.
            </p>
          )}
          {results && (
            <>
              <p className="mb-4 text-sm text-ink-soft">
                Scored {scanned.toLocaleString()} listings. Best {results.length} below.
              </p>
              {results.length === 0 && (
                <p className="text-ink-soft">No listings matched those types. Clear the type filter.</p>
              )}
              <ol className="grid gap-5 xl:grid-cols-2">
                {results.map(({ listing, match }, i) => (
                  <li key={listing.id}>
                    <ListingCard
                      listing={listing}
                      aside={
                        <div className="mt-4 rounded-2xl bg-ink p-4 text-petal">
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm text-petal/70">Match #{i + 1}</span>
                            <span className="display text-4xl font-extrabold text-gold">{match.score}</span>
                          </div>
                          <ul className="mt-2 grid gap-1 text-xs">
                            {match.highlights.slice(0, 3).map((h) => (
                              <li key={h} className="text-pool">{h}</li>
                            ))}
                            {match.concerns.slice(0, 2).map((c) => (
                              <li key={c} className="text-[#ffb4a6]">{c}</li>
                            ))}
                          </ul>
                        </div>
                      }
                    />
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-ink-soft">
      {label}
      {children}
    </label>
  )
}
