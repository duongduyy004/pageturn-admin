import { getSession, setSession } from './sessionStore'
import type { ApiResponse, AuthResponse, BookCategory, BookCategorySummary, Page, PublicBook, PublicBookDetail, User } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
const AUTH_PATH_PREFIX = '/api/v1/auth/'

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

type RequestOptions = RequestInit & { token?: string | null }

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const session = getSession()
  if (!session?.refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('refresh failed')
        const body = await response.json()
        const auth = body.data as AuthResponse
        setSession({ accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user })
        return auth.accessToken
      })
      .catch(() => {
        setSession(null)
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (response.status === 401 && !retried && options.token && !path.startsWith(AUTH_PATH_PREFIX)) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      return request<T>(path, { ...options, token: newToken }, true)
    }
  }

  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    const message = body?.message ?? `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, body?.data)
  }

  return (body as ApiResponse<T>).data
}

function params(values: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  return search.toString()
}

export const api = {
  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: (token: string) => request<AuthResponse['user']>('/api/v1/auth/me', { token }),

  listUsers: (token: string, query: { page: number; size: number; q?: string; role?: string; active?: string }) =>
    request<Page<User>>(`/api/v1/admin/users?${params(query)}`, { token }),
  getUser: (token: string, id: number) => request<User>(`/api/v1/admin/users/${id}`, { token }),
  updateUser: (token: string, id: number, input: Partial<Pick<User, 'email' | 'displayName' | 'role' | 'active'>>) =>
    request<User>(`/api/v1/admin/users/${id}`, { method: 'PATCH', token, body: JSON.stringify(input) }),

  listBooks: (token: string, query: { page: number; size: number; q?: string; category?: string; active?: string }) =>
    request<Page<PublicBook>>(`/api/v1/admin/store?${params(query)}`, { token }),
  getBook: (token: string, id: number) => request<PublicBookDetail>(`/api/v1/admin/store/${id}`, { token }),
  createBook: (token: string, form: FormData) =>
    request<PublicBookDetail>('/api/v1/admin/store', { method: 'POST', token, body: form }),
  updateBook: (token: string, id: number, form: FormData) =>
    request<PublicBookDetail>(`/api/v1/admin/store/${id}`, { method: 'PUT', token, body: form }),
  deleteBook: (token: string, id: number) =>
    request<void>(`/api/v1/admin/store/${id}`, { method: 'DELETE', token }),

  listBookCategories: (token: string, query: { page: number; size: number; q?: string; active?: string }) =>
    request<Page<BookCategory>>(`/api/v1/admin/book-categories?${params(query)}`, { token }),
  listActiveBookCategories: (token: string) =>
    request<BookCategorySummary[]>('/api/v1/store/categories', { token }),
  getBookCategory: (token: string, id: number) =>
    request<BookCategory>(`/api/v1/admin/book-categories/${id}`, { token }),
  createBookCategory: (token: string, input: Pick<BookCategory, 'name' | 'description' | 'displayOrder' | 'active'>) =>
    request<BookCategory>('/api/v1/admin/book-categories', { method: 'POST', token, body: JSON.stringify(input) }),
  updateBookCategory: (token: string, id: number, input: Partial<Pick<BookCategory, 'name' | 'description' | 'displayOrder' | 'active'>>) =>
    request<BookCategory>(`/api/v1/admin/book-categories/${id}`, { method: 'PATCH', token, body: JSON.stringify(input) }),
  deleteBookCategory: (token: string, id: number) =>
    request<void>(`/api/v1/admin/book-categories/${id}`, { method: 'DELETE', token }),
}
