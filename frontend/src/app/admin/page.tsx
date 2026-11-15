'use client'

import { useState } from 'react'
import { Empty, ErrorNote, PageHeader } from '@/components/Bits'
import { fetchBlobUrl, post, type Verification } from '@/lib/api'
import { useRequireAuth } from '@/lib/auth'
import { day } from '@/lib/format'
import { useApi } from '@/lib/hooks'

export default function Admin() {
  const { ready, user } = useRequireAuth()
  const isAdmin = ready && !!user?.is_admin
  const { data, error, reload } = useApi<Verification[]>(isAdmin ? '/admin/verifications' : null)
  const [busy, setBusy] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (ready && !user?.is_admin) {
    return <div className="shell py-20"><Empty title="Admins only." /></div>
  }

  const view = async (v: Verification) => {
    setActionError(null)
    try {
      // The document needs the bearer token, so it is fetched and opened as a blob.
      const url = await fetchBlobUrl(`/admin/verifications/${v.id}/document`)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not open the document')
    }
  }

  const decide = async (v: Verification, approve: boolean) => {
    const verb = approve ? 'Approve' : 'Reject'
    if (!window.confirm(`${verb} ${v.user_display} as a resident of ${v.apartment_name}? The document is deleted either way.`)) return
    setBusy(v.id)
    setActionError(null)
    try {
      await post(`/admin/verifications/${v.id}/decision`, { approve })
      reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save the decision')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Residency checks">
        Confirm the document shows the student&apos;s name and the building&apos;s address. Documents are
        deleted as soon as you decide.
      </PageHeader>
      <div className="shell pb-20">
        <ErrorNote message={error ?? actionError} />
        {data && data.length === 0 ? (
          <Empty title="Nothing waiting." />
        ) : (
          <ul className="mt-4 grid gap-3">
            {data?.map((v) => (
              <li key={v.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-bold">{v.user_display}</p>
                  <p className="text-sm text-ink-soft">{v.apartment_name} · submitted {day(v.created_at, true)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!v.has_document} onClick={() => view(v)}>View document</button>
                  <button type="button" className="btn btn-gold btn-sm" disabled={busy === v.id} onClick={() => decide(v, true)}>Approve</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy === v.id} onClick={() => decide(v, false)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
