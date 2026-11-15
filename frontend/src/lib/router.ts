import { useEffect, useState } from 'react'

// Hash routes ("#/listings/3") keep the static host simple: every path serves
// index.html. Plain anchors like "#reviews" are left for in-page scrolling.
export type Route =
  | { name: 'home' }
  | { name: 'listings' }
  | { name: 'listing'; id: number }
  | { name: 'post' }
  | { name: 'signin'; next?: string }

export function parseRoute(hash: string): Route {
  if (!hash.startsWith('#/')) return { name: 'home' }
  const [path, query = ''] = hash.slice(1).split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'listings' && parts[1] && /^\d+$/.test(parts[1])) {
    return { name: 'listing', id: Number(parts[1]) }
  }
  if (parts[0] === 'listings') return { name: 'listings' }
  if (parts[0] === 'post') return { name: 'post' }
  if (parts[0] === 'signin') {
    const next = new URLSearchParams(query).get('next') ?? undefined
    return { name: 'signin', next }
  }
  return { name: 'home' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      const next = parseRoute(window.location.hash)
      setRoute(next)
      if (window.location.hash.startsWith('#/')) window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`
}
