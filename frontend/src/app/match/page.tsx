'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AIMatch } from '@/components/AISearch'
import { Empty, ErrorNote, PageHeader } from '@/components/Bits'
import { ListingCard } from '@/components/ListingCard'
import { cleanPersonality, hasPersonality, PersonalityFields, RoommatesPanel } from '@/components/Personality'
import { post, type FeedItem, type Lifestyle, type ListingMatchResponse, type ListingType, type Personality } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { NEIGHBORHOODS, todayISO, TYPE_LABEL, usd } from '@/lib/format'

const TYPES = Object.keys(TYPE_LABEL) as ListingType[]

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
  personality: Personality
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

/** No account needed: describe what you want and every open listing is scored against it. */
export default function MatchPage() {
  const { user } = useAuth()
  const [form, setForm] = useState<Form>({
    budget: 1300,
    moveIn: todayISO(),
    moveOut: '',
    neighborhoods: ['University Park', 'North University Park'],
    maxDistance: '',
    types: [],
    sleep: '',
    cleanliness: 4,
    smoking: false,
    drinking: false,
    pets: false,
    diet: '',
    personality: {},
  })
  const [results, setResults] = useState<FeedItem[] | null>(null)
  const [scanned, setScanned] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
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
      ...(cleanPersonality(form.personality) ? { personality: cleanPersonality(form.personality) } : {}),
    }
    try {
      const res = await post<ListingMatchResponse>('/matching/listings', {
        seeker: {
          budget_max: form.budget,
          move_in: form.moveIn,
          ...(form.moveOut ? { move_out: form.moveOut } : {}),
          preferred_neighborhoods: form.neighborhoods,
          ...(form.maxDistance ? { max_distance_miles: Number(form.maxDistance) } : {}),
          lifestyle,
        },
        listing_types: form.types,
        limit: 21,
      })
      setResults(res.results)
      setScanned(res.scanned)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Matching failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="No account needed" title="Find my match">
        Describe what you need in plain English. HOMIE's AI reads it, scores every open listing
        on rent, dates, location, how you live and who the roommates are, then explains its top picks.
      </PageHeader>

      <AIMatch />

      <div className="shell pb-6">
        <h2 className="display text-3xl font-extrabold">Or set preferences by hand</h2>
      </div>

      <div className="shell grid items-start gap-8 pb-24 lg:grid-cols-[22rem_1fr]">
        <form onSubmit={submit} className="card grid gap-6 p-6 lg:sticky lg:top-24">
          <div>
            <label htmlFor="m-budget" className="label flex justify-between">
              Max monthly rent <span className="text-ink tabular-nums">{usd(form.budget)}</span>
            </label>
            <input id="m-budget" type="range" min={700} max={4000} step={25} className="w-full" value={form.budget} onChange={(e) => set('budget', Number(e.target.value))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="m-in" className="label">Move in</label>
              <input id="m-in" type="date" required className="input" value={form.moveIn} onChange={(e) => set('moveIn', e.target.value)} />
            </div>
            <div>
              <label htmlFor="m-out" className="label">Move out</label>
              <input id="m-out" type="date" className="input" min={form.moveIn} value={form.moveOut} onChange={(e) => set('moveOut', e.target.value)} />
            </div>
          </div>

          <div>
            <span className="label">Areas you like</span>
            <div className="flex flex-wrap gap-2">
              {NEIGHBORHOODS.map((n) => (
                <button key={n} type="button" aria-pressed={form.neighborhoods.includes(n)} className="select-pill py-1.5 text-sm" onClick={() => set('neighborhoods', toggle(form.neighborhoods, n))}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="m-dist" className="label">Max distance from campus</label>
            <select id="m-dist" className="input" value={form.maxDistance} onChange={(e) => set('maxDistance', e.target.value)}>
              <option value="">No limit</option>
              <option value="0.5">Half a mile</option>
              <option value="1">1 mile</option>
              <option value="2">2 miles</option>
              <option value="5">5 miles</option>
            </select>
          </div>

          <div>
            <span className="label">Listing types (none selected means all)</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t} type="button" aria-pressed={form.types.includes(t)} className="select-pill py-1.5 text-sm" onClick={() => set('types', toggle(form.types, t))}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="m-sleep" className="label">Sleep</label>
              <select id="m-sleep" className="input" value={form.sleep} onChange={(e) => set('sleep', e.target.value as Form['sleep'])}>
                <option value="">Any</option>
                <option value="early">Up early</option>
                <option value="flexible">Flexible</option>
                <option value="late">Up late</option>
              </select>
            </div>
            <div>
              <label htmlFor="m-diet" className="label">Kitchen</label>
              <select id="m-diet" className="input" value={form.diet} onChange={(e) => set('diet', e.target.value as Form['diet'])}>
                <option value="">Any</option>
                <option value="veg">Vegetarian</option>
                <option value="non_veg">Non-veg</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="m-clean" className="label flex justify-between">
              Cleanliness <span className="text-ink tabular-nums">{form.cleanliness} / 5</span>
            </label>
            <input id="m-clean" type="range" min={1} max={5} step={1} className="w-full" value={form.cleanliness} onChange={(e) => set('cleanliness', Number(e.target.value))} />
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {([['smoking', 'I smoke'], ['drinking', 'I drink'], ['pets', 'I have pets']] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-[var(--gold)]" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>

          <fieldset className="grid gap-4 border-t border-line pt-5">
            <legend className="sr-only">Your personality</legend>
            <div>
              <p className="display text-xl font-extrabold">Who you are</p>
              <p className="mt-1 text-sm text-ink-soft">
                Matched against the roommates already living in each place. Skip anything you like.
              </p>
            </div>
            <PersonalityFields value={form.personality} onChange={(v) => set('personality', v)} />
          </fieldset>

          <ErrorNote message={error} />
          <button type="submit" className="btn btn-gold py-3.5" disabled={busy}>
            {busy ? 'Scoring listings…' : 'Find my matches'}
          </button>
        </form>

        <div aria-live="polite">
          {results === null ? (
            <Empty title="Your best fits show up here.">
              <p>Set what matters on the left and run the match.</p>
              {user && !user.has_profile && (
                <Link href="/onboarding" className="btn btn-ghost mt-5">Or save your answers with the quiz</Link>
              )}
            </Empty>
          ) : results.length === 0 ? (
            <Empty title="Nothing to match yet."><p>No open listings fit those types.</p></Empty>
          ) : (
            <>
              <p className="text-sm text-ink-soft">
                Scored {scanned.toLocaleString()} open listings. Top {results.length}, best first.
                {!hasPersonality(form.personality) && ' Add who you are on the left to match on the roommates too.'}
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((r) => (
                  <div key={r.listing.id}>
                    <ListingCard listing={r.listing} match={r.match} />
                    <ul className="mt-2 grid gap-1 px-1 text-xs text-ink-soft">
                      {r.match.highlights.filter((h) => !h.startsWith('Personality')).slice(0, 2).map((h) => (
                        <li key={h} className="flex gap-1.5"><span className="text-ok" aria-hidden>✓</span>{h}</li>
                      ))}
                      {r.match.concerns.filter((c) => !c.startsWith('Personality')).slice(0, 1).map((c) => (
                        <li key={c} className="flex gap-1.5"><span className="text-warn" aria-hidden>!</span>{c}</li>
                      ))}
                    </ul>
                    <div className="mt-2.5">
                      <RoommatesPanel compact household={r.listing.household} fit={r.match.personality_fit} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
