export type ApiResponse<T> = {
  timestamp: string
  status: number
  success: boolean
  message: string
  data: T
}

export type Page<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export type AuthUser = { id: number; email: string; displayName: string; role: 'USER' | 'ADMIN' }
export type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser }

export type User = {
  id: number
  email: string
  displayName: string
  role: 'USER' | 'ADMIN'
  active: boolean
  createdAt: string
  updatedAt: string
}

export type PublicBook = {
  id: number
  title: string
  authors?: string[] | null
  language?: string | null
  coverUrl?: string | null
  fileFormat: string
  fileSize: number
  categoryId?: number | null
  category?: string | null
  downloadCount: number
}

export type PublicBookDetail = PublicBook & {
  description?: string | null
  fileUrl?: string | null
  addedBy: number
  active: boolean
  createdAt: string
  updatedAt: string
}


export type BookCategory = {
  id: number
  name: string
  slug: string
  description?: string | null
  displayOrder: number
  active: boolean
  bookCount: number
  createdAt: string
  updatedAt: string
}

export type BookCategorySummary = Pick<BookCategory, 'id' | 'name' | 'slug' | 'description'>
