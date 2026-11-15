'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { useApi } from '@/lib/hooks'
import type { Health } from '@/lib/api'

export function Footer() {
  const { user } = useAuth()
  const { data, error } = useApi<Health>('/health')
  const [dot, text] = error
    ? ['bg-bad', 'API offline']
    : !data
      ? ['bg-ink-soft', 'Checking API']
      : data.status === 'ok'
        ? data.storage === 'temporary'
          ? ['bg-warn', `API v${data.version}, demo storage (resets periodically)`]
          : ['bg-ok', `API v${data.version} connected`]
        : ['bg-warn', `API v${data.version}, database not connected`]

  return (
    <footer className="border-t border-line">
      <div className="shell flex flex-col gap-3 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <span>HOMIE is a student project and is not affiliated with USC.</span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {user && <Link href="/onboarding" className="hover:text-ink">My preferences</Link>}
          {user?.is_admin && <Link href="/admin" className="hover:text-ink">Admin</Link>}
          <span className="inline-flex items-center gap-2">
            <span className={`size-2 rounded-full ${dot}`} aria-hidden />
            {text}
          </span>
        </span>
      </div>
    </footer>
  )
}
