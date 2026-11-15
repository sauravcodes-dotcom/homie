'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, get } from './api'

/** GET `path` (skipped while null). Returns data, error message and a reload function. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (path === null) return
    const controller = new AbortController()
    setLoading(true)
    get<T>(path, controller.signal)
      .then((d) => {
        setData(d)
        setError(null)
        setStatus(200)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Something went wrong')
        setStatus(e instanceof ApiError ? e.status : 0)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, setData, error, status, loading, reload }
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Run `fn` every `ms` while the tab is visible. */
export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (ms === null) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ref.current()
    }, ms)
    return () => clearInterval(id)
  }, [ms])
}
