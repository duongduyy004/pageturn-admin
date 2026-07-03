import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { getSession, setSession, subscribe } from './sessionStore'
import type { AuthResponse, AuthUser } from './types'

type AuthContextValue = {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAdmin: boolean
  signIn: (session: AuthResponse) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSession)

  const value = useMemo<AuthContextValue>(() => ({
    accessToken: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
    user: session?.user ?? null,
    isAdmin: session?.user.role === 'ADMIN',
    signIn: (next) => {
      setSession({ accessToken: next.accessToken, refreshToken: next.refreshToken, user: next.user })
    },
    signOut: () => {
      setSession(null)
    },
  }), [session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
