import { useEffect, useState } from 'react'
import { api, type FactorScore, type ListingCriteria, type MatchResult } from '../lib/api'

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

const FACTOR_LABELS: Record<FactorScore['factor'], string> = {
  budget: 'Rent',
  dates: 'Dates',
  location: 'Location',
  lifestyle: 'Lifestyle',
  semantic: 'Profile',
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; result: MatchResult }
  | { kind: 'offline' }

export function MatchDemo() {
  const [budget, setBudget] = useState(1200)
  const [moveIn, setMoveIn] = useState(MOVE_INS[0].value)
  const [smoker, setSmoker] = useState(false)
  const [drinker, setDrinker] = useState(false)
  const [diet, setDiet] = useState<'veg' | 'non_veg'>('veg')
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api
        .scoreMatch(
          {
            budget_max: budget,
            move_in: moveIn,
            move_out: '2027-05-20',
            preferred_neighborhoods: ['University Park', 'North University Park'],
            lifestyle: {
              sleep_schedule: 'early',
              cleanliness: 5,
              smoking: smoker,
              drinking: drinker,
              diet,
              pets: false,
            },
          },
          LISTING,
          controller.signal,
        )
        .then((result) => setState({ kind: 'ready', result }))
        .catch(() => {
          if (!controller.signal.aborted) setState({ kind: 'offline' })
        })
    }, 180)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [budget, moveIn, smoker, drinker, diet])

  return (
    <section
      aria-label="Try a live compatibility match"
      className="rounded-[28px] bg-ink p-6 text-petal shadow-[0_30px_60px_-30px_rgba(34,26,53,0.6)] sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-petal/70">Room in a 2-bed sublease</p>
          <h2 className="mt-1 font-display text-2xl font-semibold leading-tight">
            Ellendale Pl, University Park
          </h2>
          <p className="mt-1 text-sm text-petal/70">$1,150 a month, Jan 3 to May 31</p>
        </div>
        <Score state={state} />
      </div>

      <fieldset className="mt-7 grid gap-5 border-t border-petal/15 pt-6">
        <legend className="sr-only">Your preferences</legend>
        <label className="grid gap-2 text-sm">
          <span className="flex justify-between">
            <span>Your monthly budget</span>
            <span className="tabular-nums font-semibold">${budget.toLocaleString()}</span>
          </span>
          <input
            type="range"
            min={800}
            max={1600}
            step={25}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
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
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  moveIn === m.value
                    ? 'bg-gold font-semibold text-ink'
                    : 'bg-petal/10 text-petal hover:bg-petal/20'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={smoker}
              onChange={(e) => setSmoker(e.target.checked)}
              className="size-4 accent-gold"
            />
            I smoke
          </label>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={drinker}
              onChange={(e) => setDrinker(e.target.checked)}
              className="size-4 accent-gold"
            />
            I drink
          </label>
          <div role="radiogroup" aria-label="Diet" className="flex gap-1 rounded-full bg-petal/10 p-1">
            {DIETS.map((d) => (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={diet === d.value}
                onClick={() => setDiet(d.value)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  diet === d.value ? 'bg-gold font-semibold text-ink' : 'text-petal hover:bg-petal/15'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <Breakdown state={state} />
    </section>
  )
}

function Score({ state }: { state: State }) {
  if (state.kind !== 'ready') {
    return (
      <div className="text-right font-display text-6xl font-bold text-petal/25" aria-hidden>
        --
      </div>
    )
  }
  return (
    <div className="text-right" aria-live="polite">
      <div key={state.result.score} className="score-settle display text-7xl font-extrabold text-gold">
        {state.result.score}
      </div>
      <div className="text-xs text-petal/70">match score</div>
    </div>
  )
}

function Breakdown({ state }: { state: State }) {
  if (state.kind === 'offline') {
    return (
      <p className="mt-6 rounded-2xl bg-petal/10 p-4 text-sm leading-relaxed text-petal/85">
        Live scoring is offline. Start the API from <code className="text-gold">backend/</code> with{' '}
        <code className="text-gold">uvicorn app.main:app --reload</code> and this card updates on
        its own.
      </p>
    )
  }
  if (state.kind === 'loading') {
    return <p className="mt-6 text-sm text-petal/60">Scoring this match…</p>
  }
  return (
    <ul className="mt-6 grid gap-3">
      {state.result.factors.map((f) => (
        <li key={f.factor} className="grid grid-cols-[5.5rem_1fr] items-center gap-x-4 gap-y-1">
          <span className="text-sm font-semibold">{FACTOR_LABELS[f.factor]}</span>
          <span className="h-2 overflow-hidden rounded-full bg-petal/10">
            <span
              className={`block h-full rounded-full transition-[width] duration-500 ${
                f.score >= 0.75 ? 'bg-pool' : f.score >= 0.5 ? 'bg-gold' : 'bg-alert'
              }`}
              style={{ width: `${Math.max(4, f.score * 100)}%` }}
            />
          </span>
          <span className="col-start-2 text-xs text-petal/70">{f.reason}</span>
        </li>
      ))}
    </ul>
  )
}
