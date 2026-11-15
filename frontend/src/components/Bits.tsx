'use client'

import { motion } from 'motion/react'
import { Fragment } from 'react'
import type { Benchmark, FairPrice, RiskReport } from '@/lib/api'
import { usd } from '@/lib/format'

export function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" className={size} aria-hidden>
          <path
            d="m10 1.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"
            fill={n <= Math.round(value) ? 'var(--gold)' : 'var(--line)'}
            stroke={n <= Math.round(value) ? 'var(--gold)' : 'var(--ink-soft)'}
            strokeWidth="0.6"
          />
        </svg>
      ))}
    </span>
  )
}

export function StarInput({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (n: number) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className="rounded-md p-0.5 transition-transform hover:scale-125"
        >
          <svg viewBox="0 0 20 20" className="size-7" aria-hidden>
            <path
              d="m10 1.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"
              fill={n <= value ? 'var(--gold)' : 'transparent'}
              stroke={n <= value ? 'var(--gold)' : 'var(--ink-soft)'}
              strokeWidth="1"
            />
          </svg>
        </button>
      ))}
    </div>
  )
}

export function VerifiedBadge({ label = 'USC verified' }: { label?: string }) {
  return (
    <span className="chip chip-ok">
      <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
        <path d="M6.4 11.6 3 8.2l1.2-1.2 2.2 2.2 5.4-5.4L13 5z" fill="currentColor" />
      </svg>
      {label}
    </span>
  )
}

export function RiskPanel({ risk }: { risk: RiskReport | null }) {
  if (!risk || risk.flags.length === 0) return null
  const cls = risk.level === 'high' ? 'chip-bad' : risk.level === 'medium' ? 'chip-warn' : ''
  const title =
    risk.level === 'high'
      ? 'Several red flags. Be careful.'
      : risk.level === 'medium'
        ? 'Worth a second look'
        : 'Heads up'
  return (
    <section
      className="card p-5"
      style={
        risk.level === 'high'
          ? { borderColor: 'color-mix(in srgb, var(--bad) 55%, transparent)' }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <span className={`chip ${cls}`}>{risk.level} risk</span>
      </div>
      <ul className="mt-3 grid gap-2 text-sm text-ink-soft">
        {risk.flags.map((f) => (
          <li key={f.code} className="flex gap-2">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{
                background:
                  f.severity === 'high' ? 'var(--bad)' : f.severity === 'medium' ? 'var(--warn)' : 'var(--ink-soft)',
              }}
              aria-hidden
            />
            {f.message}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        Automatic checks, not accusations. Never pay before you have seen the place and signed.
      </p>
    </section>
  )
}

const FAIR_CHIP = { below: 'chip-ok', fair: '', above: 'chip-warn' } as const

/** Short fair-price badge for cards. The full sentence is in the tooltip and on the listing page. */
export function FairPriceBadge({ fairPrice, className = '' }: { fairPrice?: FairPrice | null; className?: string }) {
  if (!fairPrice) return null
  return (
    <span className={`chip ${FAIR_CHIP[fairPrice.verdict]} ${className}`} title={fairPrice.summary}>
      {fairPrice.headline}
    </span>
  )
}

/** Where this rent sits among similar listings: a range bar plus exactly what it was compared with. */
export function FairPricePanel({ fairPrice, rent }: { fairPrice: FairPrice; rent: number }) {
  const lo = Math.min(fairPrice.p25, rent) * 0.9
  const hi = Math.max(fairPrice.p75, rent) * 1.1
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Fair price check</h2>
        <FairPriceBadge fairPrice={fairPrice} />
      </div>
      <div className="relative mt-9 h-2 rounded-full bg-surface-2">
        <span
          className="absolute inset-y-0 rounded-full bg-ink-soft/40"
          style={{ left: at(fairPrice.p25), right: `calc(100% - ${at(fairPrice.p75)})` }}
          aria-hidden
        />
        <span className="absolute -top-1 h-4 w-0.5 bg-ink-soft" style={{ left: at(fairPrice.median) }} aria-hidden />
        <span
          className="absolute -top-6 -translate-x-1/2 rounded-md bg-gold px-1.5 py-0.5 text-[11px] font-bold text-[#1d0808]"
          style={{ left: at(rent) }}
        >
          {usd(rent)}
        </span>
        <span
          className="absolute -top-1.5 size-5 -translate-x-1/2 rounded-full border-2 border-bg bg-gold"
          style={{ left: at(rent) }}
          aria-hidden
        />
      </div>
      <p className="mt-4 text-sm">{fairPrice.summary}</p>
      <p className="mt-1.5 text-sm text-ink-soft">
        Median {usd(fairPrice.median)}. The middle half of those listings ask {usd(fairPrice.p25)} to {usd(fairPrice.p75)}.
      </p>
    </section>
  )
}

export function BenchmarkPanel({ benchmark, rent }: { benchmark: Benchmark | null; rent: number }) {
  if (!benchmark) {
    return (
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">Rent check</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Not enough comparable listings on HOMIE yet to benchmark this rent.
        </p>
      </section>
    )
  }
  const lo = Math.min(benchmark.p25, rent) * 0.9
  const hi = Math.max(benchmark.p75, rent) * 1.1
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  const pct = Math.abs(Math.round(benchmark.diff_pct * 100))
  const verdict =
    benchmark.verdict === 'typical'
      ? 'About typical'
      : `${pct}% ${benchmark.verdict === 'below' ? 'below' : 'above'} typical`
  const cls = benchmark.verdict === 'below' ? 'chip-ok' : benchmark.verdict === 'above' ? 'chip-warn' : ''
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Rent check</h2>
        <span className={`chip ${cls}`}>{verdict}</span>
      </div>
      <div className="relative mt-8 h-2 rounded-full bg-surface-2">
        <span
          className="absolute inset-y-0 rounded-full bg-ink-soft/40"
          style={{ left: at(benchmark.p25), right: `calc(100% - ${at(benchmark.p75)})` }}
          aria-hidden
        />
        <span className="absolute -top-1 h-4 w-0.5 bg-ink-soft" style={{ left: at(benchmark.median) }} aria-hidden />
        <span
          className="absolute -top-6 -translate-x-1/2 rounded-md bg-gold px-1.5 py-0.5 text-[11px] font-bold text-[#1d0808]"
          style={{ left: at(rent) }}
        >
          {usd(rent)}
        </span>
        <span
          className="absolute -top-1.5 size-5 -translate-x-1/2 rounded-full border-2 border-bg bg-gold"
          style={{ left: at(rent) }}
          aria-hidden
        />
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        Median {usd(benchmark.median)}, middle half {usd(benchmark.p25)} to {usd(benchmark.p75)}.
        Based on {benchmark.sample_size} other listings in {benchmark.scope_label}.
      </p>
    </section>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card grid place-items-center gap-3 px-6 py-14 text-center">
      <h2 className="display text-3xl font-bold">{title}</h2>
      {children && <div className="max-w-md text-ink-soft">{children}</div>}
    </div>
  )
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">
      {message}
    </p>
  )
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <header className="shell pt-12 pb-8">
      {eyebrow && <p className="text-sm font-bold tracking-widest text-accent uppercase">{eyebrow}</p>}
      <h1 className="display mt-2 text-[clamp(2.6rem,7vw,5rem)] font-extrabold">
        {title.split(' ').map((word, i) => (
          <Fragment key={i}>
          {i > 0 && ' '}
          <span className="inline-block overflow-hidden pr-[0.04em] pb-[0.06em] align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: '110%', rotate: 4 }}
              animate={{ y: '0%', rotate: 0 }}
              transition={{ duration: 0.75, delay: 0.05 + i * 0.06, ease: [0.2, 0.9, 0.2, 1] }}
            >
              {word}
            </motion.span>
          </span>
          </Fragment>
        ))}
      </h1>
      {children && <div className="mt-4 max-w-2xl text-lg text-ink-soft">{children}</div>}
    </header>
  )
}
