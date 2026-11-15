'use client'

import { useEffect, useState } from 'react'
import { post, type ListingCriteria, type MatchResult, type SeekerCriteria } from '@/lib/api'
import { FactorBars, ScoreRing } from './Match'

const LISTING: ListingCriteria = {
  id: 'ellendale-2b',
  monthly_rent: 1150,
  available_from: '2027-01-03',
  available_to: '2027-05-31',
  neighborhood: 'University Park',
  lifestyle: {
    sleep_schedule: 'early',
    cleanliness: 4,
    smoking: false,
    drinking: false,
    diet: 'veg',
    pets: false,
  },
}

const DIETS = [
  { value: 'veg', label: 'Veg' },
  { value: 'non_veg', label: 'Non-veg' },
] as const

const MOVE_INS = [
  { value: '2027-01-02', label: 'Jan 2' },
  { value: '2027-01-20', label: 'Jan 20' },
  { value: '2027-03-01', label: 'Mar 1' },
  { value: '2027-06-01', label: 'Jun 1' },
]

type State = { kind: 'loading' } | { kind: 'ready'; result: MatchResult } | { kind: 'offline' }

/** Live call to the real scoring endpoint. Change an input, watch the score move. */
export function MatchDemo() {
  const [budget, setBudget] = useState(1200)
  const [moveIn, setMoveIn] = useState(MOVE_INS[0].value)
  const [smoker, setSmoker] = useState(false)
  const [drinker, setDrinker] = useState(false)
  const [diet, setDiet] = useState<'veg' | 'non_veg'>('veg')
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      const seeker: SeekerCriteria = {
        budget_max: budget,
        move_in: moveIn,
        move_out: '2027-06-20',
        preferred_neighborhoods: ['University Park', 'North University Park'],
        lifestyle: {
          sleep_schedule: 'early',
          cleanliness: 5,
          smoking: smoker,
          drinking: drinker,
          diet,
          pets: false,
        },
      }
      post<MatchResult>('/matching/score', { seeker, listing: LISTING })
        .then((result) => !cancelled && setState({ kind: 'ready', result }))
        .catch(() => !cancelled && setState({ kind: 'offline' }))
    }, 160)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [budget, moveIn, smoker, drinker, diet])

  return (
    <section
      aria-label="Try a live compatibility match"
      className="card relative overflow-hidden p-6 shadow-[0_40px_90px_-40px_var(--glow)] sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">Room in a 2-bed sublease</p>
          <h3 className="mt-1 font-display text-2xl leading-tight font-bold">Ellendale Pl, University Park</h3>
          <p className="mt-1 text-sm text-ink-soft">$1,150 a month, Jan 3 to May 31</p>
        </div>
        {state.kind === 'ready' ? (
          <div aria-live="polite">
            <ScoreRing score={state.result.score} size={92} />
          </div>
        ) : (
          <div className="skeleton size-[92px] rounded-full" aria-hidden />
        )}
      </div>

      <fieldset className="mt-7 grid gap-5 border-t border-line pt-6">
        <legend className="sr-only">Your preferences</legend>
        <label className="grid gap-2 text-sm">
          <span className="flex justify-between">
            <span>Your monthly budget</span>
            <span className="font-bold tabular-nums">${budget.toLocaleString()}</span>
          </span>
          <input type="range" min={800} max={1600} step={25} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
        </label>
        <div className="grid gap-2 text-sm">
          <span id="move-in-label">You want to move in</span>
          <div role="radiogroup" aria-labelledby="move-in-label" className="flex flex-wrap gap-2">
            {MOVE_INS.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={moveIn === m.value}
                onClick={() => setMoveIn(m.value)}
                className="select-pill"
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={smoker} onChange={(e) => setSmoker(e.target.checked)} className="size-4 accent-[var(--gold)]" />
            I smoke
          </label>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={drinker} onChange={(e) => setDrinker(e.target.checked)} className="size-4 accent-[var(--gold)]" />
            I drink
          </label>
          <div role="radiogroup" aria-label="Diet" className="flex gap-2">
            {DIETS.map((d) => (
              <button key={d.value} type="button" role="radio" aria-checked={diet === d.value} onClick={() => setDiet(d.value)} className="select-pill py-1.5">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="mt-6">
        {state.kind === 'offline' && (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-ink-soft">
            Live scoring is offline. Start the API from <code className="text-accent">backend/</code> with{' '}
            <code className="text-accent">uvicorn app.main:app --reload</code> and this card updates on its own.
          </p>
        )}
        {state.kind === 'loading' && <p className="text-sm text-ink-soft">Scoring this match…</p>}
        {state.kind === 'ready' && <FactorBars match={state.result} />}
      </div>
    </section>
  )
}
