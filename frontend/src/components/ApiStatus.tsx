import { useEffect, useState } from 'react'
import { api, type Health } from '../lib/api'

export function ApiStatus() {
  const [health, setHealth] = useState<Health | null | 'error'>(null)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth('error'))
  }, [])

  const [color, text] =
    health === null
      ? ['bg-ink-soft/40', 'Checking API']
      : health === 'error'
        ? ['bg-alert', 'API offline']
        : health.status === 'ok'
          ? ['bg-pool', `API v${health.version}, database connected`]
          : ['bg-gold', `API v${health.version}, database not connected`]

  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      {text}
    </span>
  )
}
