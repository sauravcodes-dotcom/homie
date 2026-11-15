'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ErrorNote } from '@/components/Bits'
import { post, type CodeRequest, type Session } from '@/lib/api'
import { useAuth } from '@/lib/auth'

function LoginForm() {
  const { user, loading, completeSignIn } = useAuth()
  const router = useRouter()
  const param = useSearchParams().get('next')
  const next = param && param.startsWith('/') && !param.startsWith('//') ? param : '/discover'
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) router.replace(user.has_profile ? next : '/onboarding')
  }, [loading, user, next, router])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/@usc\.edu$/i.test(email.trim())) {
      setError('Use your @usc.edu email address.')
      return
    }
    void run(async () => {
      const res = await post<CodeRequest>('/auth/request-code', { email })
      setEmail(res.email)
      setDemoCode(res.demo_code)
      setStep('code')
    })
  }

  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const res = await post<Session>('/auth/verify', { email, code: code.trim() })
      completeSignIn(res.token, res.user)
    })
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="card grid gap-5 p-8">
        <div>
          <h1 className="display text-5xl font-extrabold">
            Enter your <span className="hl">code.</span>
          </h1>
          {demoCode ? (
            <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-2 p-4 text-sm leading-relaxed">
              <p className="font-semibold">Demo mode: email delivery is not set up yet.</p>
              <p className="mt-1 text-ink-soft">
                Your code for {email} is{' '}
                <span className="display text-2xl font-bold tracking-widest text-accent">{demoCode}</span>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-ink-soft">
              We sent a 6-digit code to <strong className="text-ink">{email}</strong>. It expires in 10 minutes.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="code" className="label">6-digit code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="input display py-4 text-center text-4xl tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <ErrorNote message={error} />
        <button type="submit" className="btn btn-gold py-3.5" disabled={busy || code.length !== 6}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="button"
          className="text-sm font-semibold text-accent"
          onClick={() => {
            setStep('email')
            setCode('')
            setError(null)
          }}
        >
          Use a different email
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} className="card grid gap-5 p-8" noValidate>
      <div>
        <h1 className="display text-5xl font-extrabold">
          Trojans <span className="hl">only.</span>
        </h1>
        <p className="mt-3 text-ink-soft">
          HOMIE is only for USC students. Enter your @usc.edu email and we will send a 6-digit code.
          No password.
        </p>
      </div>
      <div>
        <label htmlFor="email" className="label">USC email</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="ttrojan@usc.edu"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <ErrorNote message={error} />
      <button type="submit" className="btn btn-gold py-3.5" disabled={busy}>
        {busy ? 'Sending code…' : 'Send code'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="shell grid min-h-[70dvh] place-items-center py-16">
      <div className="w-full max-w-md">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
