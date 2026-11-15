import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { navigate } from '../lib/router'

export function SignIn({ next }: { next?: string }) {
  const { completeSignIn } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const usc = /@usc\.edu$/i.test(email.trim())

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!usc) {
      setError('Use your @usc.edu email address.')
      return
    }
    setBusy(true)
    try {
      const res = await api.requestCode(email)
      setEmail(res.email)
      setDemoCode(res.demo_code)
      setStep('code')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.verifyCode(email, code.trim())
      completeSignIn(res.token, res.user)
      navigate(next ?? '/listings')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-md px-5 py-16 sm:py-24">
      <h1 className="display text-5xl font-extrabold">Sign in</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">
        HOMIE is only for USC students. Sign in with your @usc.edu email and we will send you a
        6-digit code.
      </p>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="mt-8 grid gap-4" noValidate>
          <label className="grid gap-2 text-sm font-semibold">
            USC email
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="ttrojan@usc.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-ink/15 bg-white px-4 py-3 text-base font-normal"
            />
          </label>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-jacaranda px-5 py-3 font-semibold text-petal hover:bg-jacaranda-dark disabled:opacity-60"
          >
            {busy ? 'Sending code…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-8 grid gap-4">
          {demoCode ? (
            <div className="rounded-2xl bg-gold/30 p-4 text-sm leading-relaxed">
              <p className="font-semibold">Demo mode: email delivery is not set up yet.</p>
              <p className="mt-1">
                Your code for {email} is{' '}
                <span className="font-display text-lg font-bold tracking-widest">{demoCode}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">We sent a code to {email}. It expires in 10 minutes.</p>
          )}
          <label className="grid gap-2 text-sm font-semibold">
            6-digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="rounded-xl border border-ink/15 bg-white px-4 py-3 font-display text-2xl tracking-[0.4em]"
            />
          </label>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="rounded-full bg-jacaranda px-5 py-3 font-semibold text-petal hover:bg-jacaranda-dark disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setCode('')
              setError(null)
            }}
            className="text-sm text-ink-soft underline underline-offset-4"
          >
            Use a different email
          </button>
        </form>
      )}
    </section>
  )
}
