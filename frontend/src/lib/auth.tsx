import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, tokenStore, type User } from './api'

type AuthState = {
  user: User | null
  loading: boolean
  completeSignIn: (token: string, user: User) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  useEffect(() => {
    if (!tokenStore.get()) return
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false))
  }, [])

  const completeSignIn = useCallback((token: string, next: User) => {
    tokenStore.set(token)
    setUser(next)
  }, [])

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined)
    tokenStore.set(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, completeSignIn, signOut }),
    [user, loading, completeSignIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
