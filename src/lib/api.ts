import type { ApiResponse, AuthResponse, Page, PublicBook, PublicBookDetail, User } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

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

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
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
}
