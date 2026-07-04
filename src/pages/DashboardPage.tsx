import { useQuery } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, Tags, Users } from 'lucide-react'
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
  const categories = useQuery({
    queryKey: ['book-categories', 'summary'],
    queryFn: () => api.listBookCategories(accessToken!, { page: 0, size: 1 }),
    enabled: !!accessToken,
  })

  return (
    <main className="p-7">
      <div className="mb-[18px] flex items-center justify-between gap-[18px]">
        <div><span className="text-xs font-bold uppercase tracking-normal text-[#66746b]">Operations</span><h1 className="m-0 text-[30px] font-bold leading-tight tracking-normal text-[#17211b]">Overview</h1></div>
      </div>
      <section className="mb-[18px] grid grid-cols-4 gap-4 max-[1000px]:grid-cols-1">
        <article className="grid gap-2.5 rounded-lg border border-[#dfe3dc] bg-white p-[18px] [&_span]:text-[#66746b] [&_strong]:text-[28px] [&_svg]:text-[#1f6f4a]"><BookOpen /><span>Books</span><strong>{books.data?.totalElements ?? '...'}</strong></article>
        <article className="grid gap-2.5 rounded-lg border border-[#dfe3dc] bg-white p-[18px] [&_span]:text-[#66746b] [&_strong]:text-[28px] [&_svg]:text-[#1f6f4a]"><Tags /><span>Categories</span><strong>{categories.data?.totalElements ?? '...'}</strong></article>
        <article className="grid gap-2.5 rounded-lg border border-[#dfe3dc] bg-white p-[18px] [&_span]:text-[#66746b] [&_strong]:text-[28px] [&_svg]:text-[#1f6f4a]"><Users /><span>Users</span><strong>{users.data?.totalElements ?? '...'}</strong></article>
        <article className="grid gap-2.5 rounded-lg border border-[#dfe3dc] bg-white p-[18px] [&_span]:text-[#66746b] [&_strong]:text-[28px] [&_svg]:text-[#1f6f4a]"><CheckCircle2 /><span>API session</span><strong>Active</strong></article>
      </section>
      <section className="rounded-lg border border-[#dfe3dc] bg-white p-[18px]">
        <h2 className="m-0 text-lg font-bold leading-tight tracking-normal text-[#17211b]">Review queues</h2>
        <div className="mt-3.5 grid gap-3 [&_div]:grid [&_div]:gap-1 [&_div]:border-t [&_div]:border-[#edf0eb] [&_div]:py-3 [&_span]:text-[#66746b]">
          <div><strong>Catalog maintenance</strong><span>Upload books, replace files, update metadata, and deactivate listings.</span></div>
          <div><strong>User administration</strong><span>Search accounts, change roles, and activate or suspend users.</span></div>
        </div>
      </section>
    </main>
  )
}
