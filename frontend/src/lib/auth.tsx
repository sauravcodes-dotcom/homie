'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, get, post, tokenStore, type User } from './api'

type AuthState = {
  user: User | null
  loading: boolean
  refresh: () => Promise<User | null>
  completeSignIn: (token: string, user: User) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      setLoading(false)
      return null
    }
    try {
      const me = await get<User>('/auth/me')
      setUser(me)
      return me
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) tokenStore.set(null)
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const completeSignIn = useCallback((token: string, next: User) => {
    tokenStore.set(token)
    setUser(next)
    setLoading(false)
  }, [])

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined)
    tokenStore.set(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, refresh, completeSignIn, logout }),
    [user, loading, refresh, completeSignIn, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Redirects signed-out visitors to /login (and profile-less ones to the quiz). */
export function useRequireAuth(options: { profile?: boolean } = {}) {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const needsProfile = Boolean(options.profile)

  useEffect(() => {
    if (auth.loading) return
    if (!auth.user) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    else if (needsProfile && !auth.user.has_profile) router.replace('/onboarding')
  }, [auth.loading, auth.user, needsProfile, pathname, router])

  const ready = !auth.loading && !!auth.user && (!needsProfile || auth.user.has_profile)
  return { ...auth, ready }
}
