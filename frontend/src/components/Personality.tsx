'use client'

import { motion } from 'motion/react'
import { useId } from 'react'
import { INTERESTS, TRAITS, type Interest, type Personality, type Trait } from '@/lib/api'

export const TRAIT_LABEL: Record<Trait, string> = {
  organized: 'Organized',
  laid_back: 'Laid-back',
  talkative: 'Talkative',
  reserved: 'Reserved',
  spontaneous: 'Spontaneous',
  planner: 'Planner',
  homebody: 'Homebody',
  adventurous: 'Adventurous',
}
export const INTEREST_LABEL: Record<Interest, string> = {
  cooking: 'Cooking',
  fitness: 'Fitness',
  gaming: 'Gaming',
  music: 'Music',
  movies: 'Movies',
  outdoors: 'Outdoors',
  sports: 'Sports',
  art: 'Art',
  reading: 'Reading',
  nightlife: 'Nightlife',
  tech: 'Tech',
  faith: 'Faith',
}
const ENERGY = ['Recharge alone', 'Quieter side', 'Bit of both', 'Pretty social', 'Always up for people']
const MAX_TRAITS = 4
const MAX_INTERESTS = 6

type Who = 'me' | 'roommates'

const toggle = <T,>(list: T[] = [], item: T, max: number) =>
  list.includes(item) ? list.filter((x) => x !== item) : list.length >= max ? list : [...list, item]

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null | undefined
  options: { value: T; title: string; sub?: string }[]
  onChange: (v: T | null) => void
}) {
  const group = useId()
  return (
    <div role="radiogroup" aria-label={label}>
      <span className="label">{label}</span>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : o.value)}
              className={`relative rounded-2xl border px-2.5 py-2.5 text-left transition-colors ${on ? 'border-gold text-ink' : 'border-line text-ink-soft hover:border-ink-soft'}`}
            >
              {on && (
                <motion.span
                  layoutId={`${group}-on`}
                  className="absolute inset-0 -z-0 rounded-2xl bg-gradient-to-br from-cardinal/35 to-gold/15"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  aria-hidden
                />
              )}
              <span className="relative block text-sm font-bold">{o.title}</span>
              {o.sub && <span className="relative mt-0.5 block text-[11px] leading-snug opacity-80">{o.sub}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The personality questions. `who="roommates"` asks about the people already living there. */
export function PersonalityFields({
  value,
  onChange,
  who = 'me',
}: {
  value: Personality | null | undefined
  onChange: (p: Personality) => void
  who?: Who
}) {
  const p = value ?? {}
  const set = (patch: Personality) => onChange({ ...p, ...patch })
  const they = who === 'roommates'
  const energyId = useId()

  return (
    <div className="grid gap-5">
      <div>
        <label htmlFor={energyId} className="label flex justify-between gap-3">
          {they ? 'How social are the roommates?' : 'How social are you?'}
          <span className="text-ink">{p.social_energy ? ENERGY[p.social_energy - 1] : 'Not set'}</span>
        </label>
        <div className="relative flex items-center gap-1.5" role="radiogroup" id={energyId} aria-label="Social energy">
          {ENERGY.map((label, i) => {
            const level = i + 1
            const on = p.social_energy === level
            const filled = (p.social_energy ?? 0) >= level
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={label}
                onClick={() => set({ social_energy: on ? null : level })}
                className="group relative h-9 flex-1"
              >
                <span
                  className={`absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full transition-colors duration-300 ${filled ? 'bg-gradient-to-r from-cardinal to-gold' : 'bg-surface-2 group-hover:bg-line'}`}
                  style={{ opacity: filled ? 0.55 + level * 0.09 : 1 }}
                />
                {on && (
                  <motion.span
                    layoutId={`${energyId}-thumb`}
                    className="absolute top-1/2 right-0 size-5 -translate-y-1/2 translate-x-1/2 rounded-full border-[3px] border-bg bg-gold shadow-[0_0_0_3px_rgba(255,204,0,0.35)]"
                    transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  />
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-ink-soft">
          <span>Introvert</span>
          <span>Extrovert</span>
        </div>
      </div>

      <Choice
        label={they ? 'The home they keep' : 'The home you want'}
        value={p.home_vibe}
        onChange={(v) => set({ home_vibe: v })}
        options={[
          { value: 'quiet', title: 'Quiet', sub: 'A calm place to recharge' },
          { value: 'balanced', title: 'Balanced', sub: 'Social some nights' },
          { value: 'social', title: 'Lively', sub: 'Friends over often' },
        ]}
      />

      <Choice
        label={they ? 'Where they study' : 'Where you study'}
        value={p.study_style}
        onChange={(v) => set({ study_style: v })}
        options={[
          { value: 'at_home', title: 'At home' },
          { value: 'library', title: 'On campus' },
          { value: 'mix', title: 'Both' },
        ]}
      />

      <Choice
        label={they ? 'When something bugs them' : 'When something bugs you'}
        value={p.communication}
        onChange={(v) => set({ communication: v })}
        options={[
          { value: 'direct', title: 'Say it', sub: 'Bring it up right away' },
          { value: 'easygoing', title: 'Let it go', sub: 'Small things slide' },
        ]}
      />

      <div>
        <span className="label flex justify-between">
          {they ? 'They are…' : 'You are…'}
          <span className="font-normal text-ink-soft">up to {MAX_TRAITS}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {TRAITS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={p.traits?.includes(t) ?? false}
              className="select-pill py-1.5 text-sm"
              onClick={() => set({ traits: toggle(p.traits, t, MAX_TRAITS) })}
            >
              {TRAIT_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label flex justify-between">
          {they ? 'They are into' : 'You are into'}
          <span className="font-normal text-ink-soft">up to {MAX_INTERESTS}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={p.interests?.includes(i) ?? false}
              className="select-pill py-1.5 text-sm"
              onClick={() => set({ interests: toggle(p.interests, i, MAX_INTERESTS) })}
            >
              {INTEREST_LABEL[i]}
            </button>
          ))}
        </div>
      </div>

      {they && (
        <div>
          <label htmlFor={`${energyId}-about`} className="label">A line about them (optional)</label>
          <textarea
            id={`${energyId}-about`}
            className="input min-h-20"
            maxLength={400}
            placeholder="Two juniors in engineering who cook together on Sundays."
            value={p.about ?? ''}
            onChange={(e) => set({ about: e.target.value || null })}
          />
        </div>
      )}
    </div>
  )
}

export const hasPersonality = (p: Personality | null | undefined) =>
  !!p && !!(p.social_energy || p.home_vibe || p.study_style || p.communication || p.traits?.length || p.interests?.length || p.about)

/** Drops empty personality answers so an untouched form sends nothing. */
export const cleanPersonality = (p: Personality | null | undefined): Personality | undefined =>
  hasPersonality(p) ? p! : undefined

/** "Who you'd live with": the roommates' personality, and how it fits yours when scored. */
export function RoommatesPanel({
  household,
  personality,
  fit,
  compact = false,
  title = 'Who you’d live with',
}: {
  household: string | null | undefined
  personality?: Personality | null
  fit?: string | null
  compact?: boolean
  title?: string
}) {
  if (!household && !fit) return null
  const chips = [
    ...(personality?.traits ?? []).map((t) => TRAIT_LABEL[t]),
    ...(personality?.interests ?? []).map((i) => INTEREST_LABEL[i]),
  ]
  const [good, talk] = splitFit(fit)
  return (
    <section className={compact ? 'rounded-2xl border border-line bg-surface-2/60 p-3.5' : 'card p-5'}>
      <h3 className={`flex items-center gap-2 font-bold ${compact ? 'text-[11px] tracking-[0.18em] text-accent uppercase' : 'font-display text-lg'}`}>
        <svg viewBox="0 0 24 24" className={compact ? 'size-3.5' : 'size-5'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <circle cx="17" cy="9" r="2.6" />
          <path d="M15.5 14.2A4.6 4.6 0 0 1 21 18.5" />
        </svg>
        {title}
      </h3>
      {household && <p className={`mt-2 leading-relaxed text-ink-soft ${compact ? 'line-clamp-3 text-xs' : 'text-sm'}`}>{household}</p>}
      {!compact && chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>
      )}
      {(good || talk) && (
        <ul className={`mt-3 grid gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          {good && (
            <li className="flex gap-2">
              <span className="text-ok" aria-hidden>✓</span>
              <span>{good}</span>
            </li>
          )}
          {talk && (
            <li className="flex gap-2">
              <span className="text-warn" aria-hidden>!</span>
              <span>{talk}</span>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

/** The API's fit sentence is "Good things. Worth talking about: …". Split it for display. */
function splitFit(fit: string | null | undefined): [string | null, string | null] {
  if (!fit) return [null, null]
  const at = fit.indexOf('Worth talking about:')
  if (at === -1) return [fit, null]
  return [fit.slice(0, at).trim() || null, fit.slice(at).trim()]
}
