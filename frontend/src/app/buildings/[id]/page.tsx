'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Empty, ErrorNote, StarInput, Stars, VerifiedBadge } from '@/components/Bits'
import {
  del,
  post,
  upload,
  type Answer,
  type BuildingDetail,
  type BuildingReview,
  type ExternalInfo,
  type Insights,
} from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { day, titleCase, usd } from '@/lib/format'
import { useApi } from '@/lib/hooks'

const SUGGESTED = ['Is there a pest problem?', 'How fast is maintenance?', 'Is the wifi reliable?', 'Does it feel safe?']

function SourceBanner({ b, fetching }: { b: BuildingDetail; fetching: boolean }) {
  if (fetching) {
    return (
      <p className="chip chip-gold w-fit" role="status">
        <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        Summarizing public reviews for this building…
      </p>
    )
  }
  if (b.insights_source === 'homie') {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        <span className="chip chip-ok">HOMIE reviews</span>
        {b.insights?.period_start &&
          `Written ${day(b.insights.period_start, true)} to ${day(b.insights.period_end, true)}`}
      </p>
    )
  }
  if (b.insights_source === 'google') {
    return (
      <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm leading-relaxed">
        <p className="font-bold text-warn">Summary of public Google reviews</p>
        <p className="mt-1 text-ink-soft">
          This building has {b.review_count} HOMIE review{b.review_count === 1 ? '' : 's'} (fewer than {b.min_reviews}),
          so this summary comes from a random sample of {b.external.sample_size} public Google reviews
          {b.external.pool_size ? ` drawn from the ${b.external.pool_size} most recent` : ''}
          {b.external.fetched_at && `, collected ${day(b.external.fetched_at, true)}`}. Those reviewers are not
          verified residents or necessarily students. It is replaced by HOMIE reviews once there are {b.min_reviews}.
        </p>
      </div>
    )
  }
  if (b.insights_source === 'homie_thin') {
    return (
      <div className="rounded-2xl border border-line bg-surface-2 p-4 text-sm text-ink-soft">
        Only {b.review_count} HOMIE review{b.review_count === 1 ? '' : 's'} so far, so treat this as early signal,
        not a pattern.
        {b.external.status === 'disabled' && ' A public-review summary is not available for this building.'}
        {b.external.status === 'ready' && b.external.sample_size === 0 && ' No public reviews were found for it either.'}
      </div>
    )
  }
  return null
}

function InsightsTable({ insights }: { insights: Insights }) {
  const rows = [...insights.categories].sort((a, b) => b.mentions - a.mentions)
  if (rows.length === 0) return <p className="text-sm text-ink-soft">Reviews so far do not cover the usual topics.</p>
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">What reviewers talk about</caption>
      <thead className="text-left text-ink-soft">
        <tr>
          <th className="py-2 font-normal">Topic</th>
          <th className="py-2 text-right font-normal">Complaints</th>
          <th className="w-2/5 py-2 pl-4 font-normal"><span className="sr-only">Share negative</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => (
          <tr key={c.category} className="border-t border-line">
            <td className="py-2.5 font-semibold">
              {titleCase(c.category)}
              {c.is_recurring_issue && <span className="chip chip-bad ml-2 py-0.5">Recurring</span>}
            </td>
            <td className="py-2.5 text-right tabular-nums text-ink-soft">{c.negative} of {c.mentions}</td>
            <td className="py-2.5 pl-4">
              <span className="block h-2 overflow-hidden rounded-full bg-surface-2">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: c.is_recurring_issue ? 'var(--bad)' : 'var(--gold)' }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${c.negative_share * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.06 }}
                />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type Turn = { question: string; answer: Answer | null; error?: string }

function AskPanel({ id, disabled }: { id: string; disabled: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const ask = async (q: string) => {
    const text = q.trim()
    if (text.length < 3 || busy) return
    setBusy(true)
    setQuestion('')
    setTurns((t) => [...t, { question: text, answer: null }])
    let turn: Turn
    try {
      turn = { question: text, answer: await post<Answer>(`/apartments/${id}/ask`, { question: text }) }
    } catch (e) {
      turn = { question: text, answer: null, error: e instanceof Error ? e.message : 'Could not answer that' }
    }
    setTurns((t) => [...t.slice(0, -1), turn])
    setBusy(false)
    requestAnimationFrame(() => end.current?.scrollIntoView({ block: 'nearest' }))
  }

  return (
    <section className="card flex flex-col p-6" aria-labelledby="ask-heading">
      <h2 id="ask-heading" className="font-display text-xl font-bold">Ask this building</h2>
      <p className="mt-1 text-sm text-ink-soft">Answers come only from reviews, with the evidence shown.</p>

      {turns.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button key={s} type="button" className="select-pill py-1.5 text-sm" disabled={disabled} onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid max-h-[26rem] gap-4 overflow-y-auto" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className="grid gap-2">
            <p className="justify-self-end rounded-2xl rounded-br-md bg-cardinal px-4 py-2 text-[#fff6e3]">{t.question}</p>
            {t.error ? (
              <ErrorNote message={t.error} />
            ) : !t.answer ? (
              <div className="skeleton h-16 w-3/4" />
            ) : (
              <div className="rounded-2xl rounded-bl-md bg-surface-2 p-4">
                <p className="leading-relaxed">{t.answer.answer}</p>
                {t.answer.citations.length > 0 && (
                  <ul className="mt-3 grid gap-2">
                    {t.answer.citations.map((c, n) => (
                      <li key={c.review_id} className="border-l-2 border-gold pl-3 text-sm text-ink-soft">
                        <span className="font-semibold text-ink">[{n + 1}]</span> “{c.quote}”
                        <span className="block text-xs">
                          {c.is_verified_resident ? 'Verified resident' : 'Unverified'} · {day(c.submitted_on, true)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-ink-soft">
                  {t.answer.source === 'google'
                    ? `From a sample of ${t.answer.sample_size} public Google reviews (not verified residents).`
                    : `From ${t.answer.sample_size} HOMIE review${t.answer.sample_size === 1 ? '' : 's'}, ${t.answer.verified_count} verified.`}
                  {t.answer.generated_by === 'offline' && ' Answer assembled from counts; no AI model is configured.'}
                </p>
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(question) }}>
        <input className="input" aria-label="Your question" placeholder={disabled ? 'No reviews to answer from yet' : 'Is parking included?'} maxLength={400} disabled={disabled} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button type="submit" className="btn btn-gold" disabled={disabled || busy || question.trim().length < 3}>Ask</button>
      </form>
    </section>
  )
}

function ReviewForm({ id, onSaved }: { id: string; onSaved: () => void }) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      id="write"
      className="card grid scroll-mt-24 gap-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          await post(`/apartments/${id}/reviews`, { body, overall_rating: rating, lived_from: from || null, lived_to: to || null })
          onSaved()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not post your review')
        } finally {
          setBusy(false)
        }
      }}
    >
      <div>
        <h2 className="font-display text-xl font-bold">Review this building</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Posted without your name. Mention what you paid, and anything about maintenance, pests,
          management, safety, noise or internet.
        </p>
      </div>
      <StarInput value={rating} onChange={setRating} label="Overall rating" />
      <div>
        <label htmlFor="rbody" className="label">Your review (at least 30 characters)</label>
        <textarea id="rbody" required minLength={30} maxLength={6000} className="input min-h-32" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lf" className="label">Lived here from (optional)</label>
          <input id="lf" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="lt" className="label">Until (optional)</label>
          <input id="lt" type="date" className="input" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <ErrorNote message={error} />
      <button type="submit" className="btn btn-gold justify-self-start" disabled={busy || rating === 0 || body.trim().length < 30}>
        {busy ? 'Posting…' : 'Post review'}
      </button>
    </form>
  )
}

function VerifyPanel({ b, onChange }: { b: BuildingDetail; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (b.my_verification === 'approved') {
    return <div className="card flex items-center gap-3 p-5"><VerifiedBadge label="Verified resident" /><span className="text-sm text-ink-soft">Your reviews here carry the badge.</span></div>
  }
  if (b.my_verification === 'pending') {
    return <p className="card p-5 text-sm text-ink-soft">Your lease document is waiting for review. It is deleted as soon as a decision is made.</p>
  }
  return (
    <div className="card p-5">
      <h3 className="font-display text-lg font-bold">Get the verified-resident badge</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Upload the page of your lease that shows your name and this address (photo or PDF, up to 8 MB). Cover
        anything else, like account numbers. Only a HOMIE admin sees it, and it is deleted after the decision.
        {b.my_verification === 'rejected' && ' Your last upload was not accepted; you can try again.'}
      </p>
      <ErrorNote message={error} />
      <label className="btn btn-ghost mt-3 cursor-pointer">
        {busy ? 'Uploading…' : 'Upload lease page'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setBusy(true)
            setError(null)
            try {
              await upload(`/apartments/${b.id}/verification`, file)
              onChange()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Upload failed')
            } finally {
              setBusy(false)
            }
          }}
        />
      </label>
    </div>
  )
}

export default function BuildingPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const building = useApi<BuildingDetail>(`/apartments/${id}`)
  const reviews = useApi<BuildingReview[]>(`/apartments/${id}/reviews`)
  const [fetching, setFetching] = useState(false)
  const requested = useRef(false)
  const b = building.data
  const reloadBuilding = building.reload
  const reloadReviews = reviews.reload

  // Viewer-specific fields (my review, my verification) need a re-fetch after sign-in resolves.
  useEffect(() => {
    reloadBuilding()
    reloadReviews()
  }, [user?.id, reloadBuilding, reloadReviews])

  // Too few HOMIE reviews and no stored public-review summary yet: build one (once).
  useEffect(() => {
    if (!b || b.external.status !== 'missing' || requested.current) return
    requested.current = true
    setFetching(true)
    post<ExternalInfo>(`/apartments/${id}/external-summary`)
      .then(reloadBuilding)
      .catch(() => undefined)
      .finally(() => setFetching(false))
  }, [b, id, reloadBuilding])

  if (building.status === 404) return <div className="shell py-20"><Empty title="Building not found."><Link href="/buildings" className="btn btn-gold mt-2">All buildings</Link></Empty></div>
  if (!b) return <div className="shell py-12"><ErrorNote message={building.error} /><div className="skeleton mt-4 h-96" /></div>

  const refresh = () => {
    reloadBuilding()
    reloadReviews()
  }
  const shownRating = b.average_rating ?? (b.insights_source === 'google' ? b.external.average_rating : null)

  return (
    <div className="shell py-12">
      <header>
        <Link href="/buildings" className="text-sm font-bold text-accent">← All buildings</Link>
        <h1 className="display mt-3 text-[clamp(2.8rem,8vw,6rem)] font-extrabold">{b.name}</h1>
        <p className="mt-3 text-lg text-ink-soft">{[b.address, b.neighborhood].filter(Boolean).join(' · ')}</p>
        <dl className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-4">
            <dt className="text-sm text-ink-soft">{b.average_rating === null && shownRating !== null ? 'Google rating' : 'Rating'}</dt>
            <dd className="display mt-1 flex items-center gap-2 text-4xl font-extrabold">
              {shownRating !== null ? shownRating.toFixed(1) : '–'}
              {shownRating !== null && <Stars value={shownRating} />}
            </dd>
          </div>
          <div className="card p-4">
            <dt className="text-sm text-ink-soft">HOMIE reviews</dt>
            <dd className="display mt-1 text-4xl font-extrabold tabular-nums">{b.review_count}</dd>
          </div>
          <div className="card p-4">
            <dt className="text-sm text-ink-soft">Verified residents</dt>
            <dd className="display mt-1 text-4xl font-extrabold tabular-nums">{b.verified_count}</dd>
          </div>
          <div className="card p-4">
            <dt className="text-sm text-ink-soft">{b.insights?.median_reported_monthly_cost ? 'Median cost reported' : 'Median listing rent'}</dt>
            <dd className="display mt-1 text-4xl font-extrabold tabular-nums">
              {b.insights?.median_reported_monthly_cost
                ? usd(b.insights.median_reported_monthly_cost)
                : b.median_listing_rent
                  ? usd(b.median_listing_rent)
                  : '–'}
            </dd>
          </div>
        </dl>
        {b.listing_count > 0 && (
          <Link href={`/listings?building=${b.id}`} className="mt-4 inline-block font-bold text-accent">
            {b.listing_count} open listing{b.listing_count === 1 ? '' : 's'} in this building →
          </Link>
        )}
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="card grid content-start gap-5 p-6">
          <h2 className="font-display text-xl font-bold">What residents say</h2>
          <SourceBanner b={b} fetching={fetching} />
          {b.summary && <p className="text-lg leading-relaxed">{b.summary}</p>}
          {b.insights ? (
            <InsightsTable insights={b.insights} />
          ) : (
            !fetching && <p className="text-ink-soft">No reviews yet. Be the first to write one.</p>
          )}
        </section>
        <AskPanel id={id} disabled={!b.insights || b.insights.sample_size === 0} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section>
          <h2 className="font-display text-2xl font-bold">HOMIE reviews</h2>
          {reviews.data && reviews.data.length === 0 && <p className="mt-3 text-ink-soft">None yet.</p>}
          <ul className="mt-4 grid gap-3">
            {reviews.data?.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    {r.overall_rating !== null && <Stars value={r.overall_rating} />}
                    {r.is_verified_resident ? <VerifiedBadge label="Verified resident" /> : <span className="chip">Unverified</span>}
                    {r.is_mine && <span className="chip chip-gold">Yours</span>}
                  </span>
                  <span className="text-xs text-ink-soft">{day(r.created_at, true)}</span>
                </div>
                <p className="mt-3 leading-relaxed whitespace-pre-line">{r.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {r.topics.map((t) => <span key={t} className="chip py-0.5">{titleCase(t)}</span>)}
                  {r.is_mine && (
                    <button
                      type="button"
                      className="ml-auto text-xs font-bold text-bad"
                      onClick={async () => {
                        if (!window.confirm('Delete your review of this building?')) return
                        await del(`/apartments/${id}/reviews/mine`).catch(() => undefined)
                        refresh()
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="grid content-start gap-5">
          {!user ? (
            <div className="card p-6">
              <h2 className="font-display text-xl font-bold">Lived here?</h2>
              <p className="mt-1 text-sm text-ink-soft">Sign in with your USC email to review this building.</p>
              <Link href={`/login?next=/buildings/${id}`} className="btn btn-gold mt-4">Sign in to review</Link>
            </div>
          ) : (
            <>
              {b.my_review_id === null ? (
                <ReviewForm id={id} onSaved={refresh} />
              ) : (
                <p className="card p-5 text-sm text-ink-soft">You have reviewed this building. Thank you.</p>
              )}
              <VerifyPanel b={b} onChange={refresh} />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
