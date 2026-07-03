import type { AuthUser } from './types'

export type StoredSession = { accessToken: string; refreshToken: string; user: AuthUser }

const STORAGE_KEY = 'pageturn-admin-session'
type Listener = (session: StoredSession | null) => void
const listeners = new Set<Listener>()

function readFromStorage(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

let current: StoredSession | null = readFromStorage()

export function getSession(): StoredSession | null {
  return current
}

export function setSession(session: StoredSession | null) {
  current = session
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  else localStorage.removeItem(STORAGE_KEY)
  listeners.forEach((listener) => listener(current))
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
