'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ErrorNote } from '@/components/Bits'
import { cleanPersonality, PersonalityFields } from '@/components/Personality'
import { get, patch, put, type Lifestyle, type Profile } from '@/lib/api'
import { useRequireAuth } from '@/lib/auth'
import { NEIGHBORHOODS, todayISO, usd } from '@/lib/format'

type Draft = {
  full_name: string
  budget_max: number
  move_in: string
  move_out: string
  preferred_neighborhoods: string[]
  lifestyle: Lifestyle
  bio: string
  is_discoverable: boolean
}

const SCALE = [1, 2, 3, 4, 5]

function Pills<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | null | undefined
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="select-pill px-5 py-3 text-base"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Onboarding() {
  const { user, ready, refresh } = useRequireAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({
    full_name: '',
    budget_max: 1300,
    move_in: todayISO(),
    move_out: '',
    preferred_neighborhoods: [],
    lifestyle: {},
    bio: '',
    is_discoverable: false,
  })

  // Returning users edit their existing answers.
  useEffect(() => {
    if (!ready || !user) return
    // New accounts start with the email's local part as a placeholder name; do not suggest it.
    const placeholder = user.email.split('@')[0]
    setDraft((d) => ({ ...d, full_name: user.full_name === placeholder ? '' : user.full_name }))
    if (!user.has_profile) return
    get<Profile>('/profile')
      .then((p) =>
        setDraft((d) => ({
          ...d,
          budget_max: p.budget_max,
          move_in: p.move_in,
          move_out: p.move_out ?? '',
          preferred_neighborhoods: p.preferred_neighborhoods,
          lifestyle: p.lifestyle,
          bio: p.bio,
          is_discoverable: p.is_discoverable,
        })),
      )
      .catch(() => undefined)
  }, [ready, user])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const life = (patchLife: Lifestyle) => setDraft((d) => ({ ...d, lifestyle: { ...d.lifestyle, ...patchLife } }))

  const steps: { title: string; hint?: string; valid: boolean; body: React.ReactNode }[] = [
    {
      title: 'What should we call you?',
      hint: 'Other students see your first name and last initial. Never your email.',
      valid: draft.full_name.trim().length > 0,
      body: (
        <input
          className="input py-4 text-xl"
          placeholder="Tommy Trojan"
          aria-label="Your name"
          autoFocus
          maxLength={200}
          value={draft.full_name}
          onChange={(e) => set('full_name', e.target.value)}
        />
      ),
    },
    {
      title: 'What is the most you can pay a month?',
      valid: true,
      body: (
        <div>
          <p className="display text-shine text-8xl font-extrabold tabular-nums">{usd(draft.budget_max)}</p>
          <input
            type="range"
            min={500}
            max={3500}
            step={25}
            aria-label="Maximum monthly rent"
            className="mt-6 w-full"
            value={draft.budget_max}
            onChange={(e) => set('budget_max', Number(e.target.value))}
          />
        </div>
      ),
    },
    {
      title: 'When do you need it?',
      hint: 'Leave move-out empty if you are staying for the year.',
      valid: !!draft.move_in && (!draft.move_out || draft.move_out > draft.move_in),
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="move_in">Move in</label>
            <input id="move_in" type="date" className="input" value={draft.move_in} onChange={(e) => set('move_in', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="move_out">Move out (optional)</label>
            <input id="move_out" type="date" className="input" min={draft.move_in} value={draft.move_out} onChange={(e) => set('move_out', e.target.value)} />
          </div>
        </div>
      ),
    },
    {
      title: 'Where do you want to live?',
      hint: 'Pick as many as you like.',
      valid: true,
      body: (
        <div className="flex flex-wrap gap-2.5">
          {NEIGHBORHOODS.map((n) => {
            const on = draft.preferred_neighborhoods.includes(n)
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                className="select-pill px-5 py-3 text-base"
                onClick={() =>
                  set(
                    'preferred_neighborhoods',
                    on ? draft.preferred_neighborhoods.filter((x) => x !== n) : [...draft.preferred_neighborhoods, n],
                  )
                }
              >
                {n}
              </button>
            )
          })}
        </div>
      ),
    },
    {
      title: 'Early bird or night owl?',
      valid: true,
      body: (
        <Pills
          label="Sleep schedule"
          value={draft.lifestyle.sleep_schedule}
          onChange={(v) => life({ sleep_schedule: v })}
          options={[
            { value: 'early', label: 'Up early' },
            { value: 'flexible', label: 'Depends on the day' },
            { value: 'late', label: 'Up late' },
          ]}
        />
      ),
    },
    {
      title: 'How clean do you keep things?',
      hint: '1 is relaxed about mess, 5 is spotless.',
      valid: true,
      body: (
        <div className="grid gap-7">
          <Pills label="Cleanliness" value={draft.lifestyle.cleanliness} onChange={(v) => life({ cleanliness: v })} options={SCALE.map((n) => ({ value: n, label: String(n) }))} />
          <div>
            <p className="mb-3 font-semibold">How much noise is fine at home?</p>
            <Pills label="Noise tolerance" value={draft.lifestyle.noise_tolerance} onChange={(v) => life({ noise_tolerance: v })} options={SCALE.map((n) => ({ value: n, label: String(n) }))} />
          </div>
          <div>
            <p className="mb-3 font-semibold">How often do you have people over?</p>
            <Pills label="Guests" value={draft.lifestyle.guests_frequency} onChange={(v) => life({ guests_frequency: v })} options={SCALE.map((n) => ({ value: n, label: String(n) }))} />
          </div>
        </div>
      ),
    },
    {
      title: 'Smoking, drinking, food and pets?',
      valid: true,
      body: (
        <div className="grid gap-7">
          <div>
            <p className="mb-3 font-semibold">Do you smoke?</p>
            <Pills label="Smoking" value={draft.lifestyle.smoking} onChange={(v) => life({ smoking: v })} options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
          </div>
          <div>
            <p className="mb-3 font-semibold">Do you drink?</p>
            <Pills label="Drinking" value={draft.lifestyle.drinking} onChange={(v) => life({ drinking: v })} options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
          </div>
          <div>
            <p className="mb-3 font-semibold">What do you cook in a shared kitchen?</p>
            <Pills label="Diet" value={draft.lifestyle.diet} onChange={(v) => life({ diet: v })} options={[{ value: 'veg', label: 'Vegetarian' }, { value: 'non_veg', label: 'Non-veg' }]} />
          </div>
          <div>
            <p className="mb-3 font-semibold">Pets in the picture?</p>
            <Pills label="Pets" value={draft.lifestyle.pets} onChange={(v) => life({ pets: v })} options={[{ value: false, label: 'No pets' }, { value: true, label: 'Have or want pets' }]} />
          </div>
        </div>
      ),
    },
    {
      title: 'What are you like to live with?',
      hint: 'HOMIE matches this against the roommates already in each place, and against other students. Skip anything.',
      valid: true,
      body: (
        <PersonalityFields
          value={draft.lifestyle.personality}
          onChange={(personality) => life({ personality: cleanPersonality(personality) ?? null })}
        />
      ),
    },
    {
      title: 'Describe yourself in a few lines.',
      hint: 'HOMIE compares this with listing descriptions, so write it how you would say it.',
      valid: true,
      body: (
        <div className="grid gap-5">
          <textarea
            className="input min-h-36"
            maxLength={1500}
            aria-label="About you"
            placeholder="Quiet junior, cook most nights, usually in bed by midnight…"
            value={draft.bio}
            onChange={(e) => set('bio', e.target.value)}
          />
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--gold)]"
              checked={draft.is_discoverable}
              onChange={(e) => set('is_discoverable', e.target.checked)}
            />
            <span>
              <span className="font-semibold">Show me to students looking for roommates</span>
              <span className="block text-sm text-ink-soft">
                They see your first name, bio, budget, dates and lifestyle answers, and can message
                you. Off by default; change it any time.
              </span>
            </span>
          </label>
        </div>
      ),
    },
  ]

  const last = step === steps.length - 1
  const current = steps[step]

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      await patch('/auth/me', { full_name: draft.full_name.trim() })
      await put('/profile', {
        budget_max: draft.budget_max,
        move_in: draft.move_in,
        move_out: draft.move_out || null,
        preferred_neighborhoods: draft.preferred_neighborhoods,
        lifestyle: draft.lifestyle,
        bio: draft.bio,
        is_discoverable: draft.is_discoverable,
      })
      await refresh()
      router.push('/discover')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setBusy(false)
    }
  }

  if (!ready) return <div className="shell py-24"><div className="skeleton mx-auto h-80 max-w-2xl" /></div>

  return (
    <div className="shell flex min-h-[calc(100dvh-10rem)] max-w-3xl flex-col py-10">
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
        <div className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="mt-4 text-sm font-bold tracking-widest text-ink-soft uppercase">
        {step + 1} of {steps.length}
      </p>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          if (!current.valid || busy) return
          if (last) void finish()
          else setStep((s) => s + 1)
        }}
      >
        <div className="flex-1 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <h1 className="display text-[clamp(2.4rem,6vw,4.25rem)] font-extrabold">{current.title}</h1>
              {current.hint && <p className="mt-3 text-ink-soft">{current.hint}</p>}
              <div className="mt-9">{current.body}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <ErrorNote message={error} />
        <div className="mt-4 flex items-center justify-between gap-4">
          <button type="button" className="btn btn-ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          <button type="submit" className="btn btn-gold px-8 py-3.5" disabled={!current.valid || busy}>
            {last ? (busy ? 'Saving…' : 'See my matches') : 'Next'}
          </button>
        </div>
      </form>
    </div>
  )
}
