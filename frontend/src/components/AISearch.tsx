'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ErrorNote } from '@/components/Bits'
import { ListingCard } from '@/components/ListingCard'
import { post, type AISearchResponse, type Understood } from '@/lib/api'
import { day, usd } from '@/lib/format'

const EXAMPLES = [
  'Vegetarian grad student, quiet, no smoking. Under $1,300 from January to May, walking distance to campus.',
  'Furnished room with parking for summer, budget $1,500, I have a cat.',
  'Take over a lease near Figueroa next academic year, up to $2,800, clean roommates who split chores.',
]

/** Plain-English box. With `goTo`, it sends people to /match?q=… instead of searching in place. */
export function AISearchBox({
  initial = '',
  busy = false,
  onSearch,
  goTo = false,
}: {
  initial?: string
  busy?: boolean
  onSearch?: (query: string) => void
  goTo?: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState(initial)
  useEffect(() => setQuery(initial), [initial])

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    if (q.length < 3) return
    if (goTo) router.push(`/match?q=${encodeURIComponent(q)}`)
    else onSearch?.(q)
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label htmlFor="ai-query" className="label">
        Describe your ideal place in your own words
      </label>
      <textarea
        id="ai-query"
        rows={4}
        maxLength={1000}
        className="input resize-none leading-relaxed"
        placeholder="Budget, dates, area, how you live, must-haves…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex, i) => (
          <button key={ex} type="button" className="select-pill py-1 text-xs" onClick={() => setQuery(ex)}>
            Try example {i + 1}
          </button>
        ))}
      </div>
      <button type="submit" className="btn btn-gold" disabled={busy || query.trim().length < 3}>
        {busy ? 'Finding apartments…' : 'Find apartments'}
      </button>
    </form>
  )
}

/** Full AI search: box plus results. Reads ?q= so the home page can hand off a query. */
export function AIMatch() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<AISearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (q: string) => {
    setQuery(q)
    setBusy(true)
    setError(null)
    try {
      setResult(await post<AISearchResponse>('/matching/ai', { query: q, limit: 8 }))
      const url = new URL(window.location.href)
      url.searchParams.set('q', q)
      window.history.replaceState(null, '', url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) void run(q)
  }, [])

  return (
    <section className="shell grid items-start gap-8 pb-16 lg:grid-cols-[22rem_1fr]">
      <div className="card p-6 lg:sticky lg:top-24">
        <AISearchBox initial={query} busy={busy} onSearch={run} />
      </div>
      <div aria-live="polite">
        <ErrorNote message={error} />
        {!result && !busy && !error && (
          <div className="card p-8 leading-relaxed text-ink-soft">
            Write what you need the way you would text a friend. HOMIE reads it, scores every open
            listing, and explains its top picks.
          </div>
        )}
        {busy && <p className="text-ink-soft">Reading your request and scoring listings…</p>}
        {result && !busy && <AIResults result={result} />}
      </div>
    </section>
  )
}

function AIResults({ result }: { result: AISearchResponse }) {
  return (
    <>
      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">What HOMIE understood</h2>
          <span className="text-xs text-ink-soft">
            {result.used_model
              ? `Read by ${modelLabel(result.model)}`
              : 'Read by the keyword reader (AI model not connected)'}
          </span>
        </div>
        {result.understood.summary && <p className="mt-2 leading-relaxed">{result.understood.summary}</p>}
        <ul className="mt-3 flex flex-wrap gap-2">
          {chips(result.understood).map((c) => (
            <li key={c} className="chip">
              {c}
            </li>
          ))}
        </ul>
        {result.note && <p className="mt-3 text-sm text-ink-soft">{result.note}</p>}
      </div>

      <p className="mt-6 mb-4 text-sm text-ink-soft">
        Scored {result.scanned.toLocaleString()} listings. Top {result.results.length}:
      </p>
      <ol className="grid gap-6 sm:grid-cols-2">
        {result.results.map(({ listing, match, why, feature_hits }, i) => (
          <li key={listing.id} className="grid content-start gap-3">
            <ListingCard listing={listing} match={match} />
            <div className="card p-4">
              <p className="text-xs font-bold tracking-widest text-accent uppercase">
                Pick {i + 1}: why it fits you
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">{why}</p>
              {feature_hits.length > 0 && (
                <p className="mt-2 text-xs text-ink-soft">Includes: {feature_hits.join(', ')}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

function chips(u: Understood): string[] {
  const out: string[] = []
  if (u.budget_max) out.push(`Up to ${usd(u.budget_max)}/mo`)
  if (u.move_in) out.push(`From ${day(u.move_in, true)}`)
  if (u.move_out) out.push(`Until ${day(u.move_out, true)}`)
  out.push(...u.preferred_neighborhoods)
  if (u.max_distance_miles) out.push(`Within ${u.max_distance_miles} mi of campus`)
  for (const t of u.listing_types) out.push(t.replace('_', ' '))
  if (u.sleep_schedule) out.push(`${u.sleep_schedule} sleeper`)
  if (u.noise_tolerance && u.noise_tolerance <= 2) out.push('Quiet')
  if (u.cleanliness && u.cleanliness >= 4) out.push('Clean')
  if (u.smoking === false) out.push('No smoking')
  if (u.smoking) out.push('Smoker')
  if (u.drinking === false) out.push("Doesn't drink")
  if (u.drinking) out.push('Drinks')
  if (u.pets) out.push('Has a pet')
  if (u.pets === false) out.push('No pets')
  if (u.diet) out.push(u.diet === 'veg' ? 'Vegetarian' : 'Non-veg')
  for (const m of u.must_haves) out.push(`Needs ${m}`)
  return out.length ? out : ['No specific preferences found, showing the best overall fits']
}

function modelLabel(model: string | null): string {
  if (!model) return 'the AI model'
  if (model.includes('llama-3.3-70b')) return 'Llama 3.3 70B on Groq'
  return model
}
