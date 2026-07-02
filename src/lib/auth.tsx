import { createContext, useContext, useMemo, useState } from 'react'
import type { AuthResponse, AuthUser } from './types'

type StoredSession = { accessToken: string; refreshToken: string; user: AuthUser }
type AuthContextValue = {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAdmin: boolean
  signIn: (session: AuthResponse) => void
  signOut: () => void
}

const STORAGE_KEY = 'pageturn-admin-session'
const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readSession())

  const value = useMemo<AuthContextValue>(() => ({
    accessToken: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
    user: session?.user ?? null,
    isAdmin: session?.user.role === 'ADMIN',
    signIn: (next) => {
      const stored = { accessToken: next.accessToken, refreshToken: next.refreshToken, user: next.user }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      setSession(stored)
    },
    signOut: () => {
      localStorage.removeItem(STORAGE_KEY)
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
