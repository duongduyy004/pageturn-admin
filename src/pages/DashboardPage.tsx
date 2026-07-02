import { useQuery } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

export function DashboardPage() {
  const { accessToken } = useAuth()
  const books = useQuery({
    queryKey: ['books', 'summary'],
    queryFn: () => api.listBooks(accessToken!, { page: 0, size: 1 }),
    enabled: !!accessToken,
  })
  const users = useQuery({
    queryKey: ['users', 'summary'],
    queryFn: () => api.listUsers(accessToken!, { page: 0, size: 1 }),
    enabled: !!accessToken,
  })

  return (
    <main className="page">
      <div className="page-title">
        <div><span className="eyebrow">Operations</span><h1>Overview</h1></div>
      </div>
      <section className="metric-grid">
        <article className="metric"><BookOpen /><span>Books</span><strong>{books.data?.totalElements ?? '...'}</strong></article>
        <article className="metric"><Users /><span>Users</span><strong>{users.data?.totalElements ?? '...'}</strong></article>
        <article className="metric"><CheckCircle2 /><span>API session</span><strong>Active</strong></article>
      </section>
      <section className="work-panel">
        <h2>Review queues</h2>
        <div className="queue-list">
          <div><strong>Catalog maintenance</strong><span>Upload books, replace files, update metadata, and deactivate listings.</span></div>
          <div><strong>User administration</strong><span>Search accounts, change roles, and activate or suspend users.</span></div>
        </div>
      </section>
    </main>
  )
}
