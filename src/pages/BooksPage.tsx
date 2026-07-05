import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Edit3, Eye, Plus, RefreshCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { formatAuthors } from '../components/BookPreview'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { PublicBook } from '../lib/types'

export function BooksPage() {
  const { accessToken } = useAuth()
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [active, setActive] = useState('')

  const books = useQuery({
    queryKey: ['books', { page, q, category, active }],
    queryFn: () => api.listBooks(accessToken!, { page, size: 20, q, category, active }),
    enabled: !!accessToken,
  })

  const categories = useQuery({
    queryKey: ['active-book-categories'],
    queryFn: () => api.listActiveBookCategories(accessToken!),
    enabled: !!accessToken,
  })

  const columns = useMemo<ColumnDef<PublicBook>[]>(() => [
    { accessorKey: 'title', header: 'Title', cell: (info) => <strong>{info.getValue<string>()}</strong> },
    { id: 'authors', header: 'Authors', cell: ({ row }) => formatAuthors(row.original) || 'Unknown' },
    { accessorKey: 'category', header: 'Category', cell: (info) => info.getValue<string>() || 'None' },
    { accessorKey: 'fileFormat', header: 'Format', cell: (info) => <span className="inline-flex items-center rounded-full bg-[#edf5ef] px-[9px] py-1 text-xs font-bold text-[#1f6f4a]">{info.getValue<string>()}</span> },
    { accessorKey: 'downloadCount', header: 'Downloads' },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2.5">
          <Link className="inline-flex items-center gap-1.5 border-0 bg-transparent font-bold text-[#1f6f4a]" to="/books/$bookId" params={{ bookId: String(row.original.id) }}><Eye size={16} />View</Link>
          <Link className="inline-flex items-center gap-1.5 border-0 bg-transparent font-bold text-[#1f6f4a]" to="/books/$bookId/edit" params={{ bookId: String(row.original.id) }}><Edit3 size={16} />Edit</Link>
        </div>
      ),
    },
  ], [])

  return (
    <main className="p-7">
      <div className="mb-[18px] flex items-center justify-between gap-[18px]">
        <div><span className="text-xs font-bold uppercase tracking-normal text-[#66746b]">Catalog</span><h1 className="m-0 text-[30px] font-bold leading-tight tracking-normal text-[#17211b]">Books</h1></div>
        <div className="flex gap-2.5"><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" onClick={() => books.refetch()}><RefreshCcw size={16} />Refresh</button><Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" to="/books/new"><Plus size={16} />Add new book</Link></div>
      </div>
      <div className="mb-3.5 grid grid-cols-[minmax(220px,1fr)_160px_150px] gap-2.5 max-[1000px]:grid-cols-1">
        <label className="relative flex items-center [&_svg]:absolute [&_svg]:left-3 [&_svg]:text-[#66746b] [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-[#c8d0c8] [&_input]:bg-white [&_input]:py-2.5 [&_input]:pr-[11px] [&_input]:pl-9 [&_input]:text-[#17211b]"><Search size={16} /><input placeholder="Search title or author" value={q} onChange={(e) => { setPage(0); setQ(e.target.value) }} /></label>
        <select className="w-full rounded-lg border border-[#c8d0c8] bg-white px-[11px] py-2.5 text-[#17211b]" value={category} onChange={(e) => { setPage(0); setCategory(e.target.value) }}>
          <option value="">All categories</option>
          {(categories.data ?? []).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <select className="w-full rounded-lg border border-[#c8d0c8] bg-white px-[11px] py-2.5 text-[#17211b]" value={active} onChange={(e) => { setPage(0); setActive(e.target.value) }}>
          <option value="">All visibility</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
      </div>
      {books.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{books.error.message}</div>}
      <DataTable data={books.data?.content ?? []} columns={columns} emptyLabel={books.isLoading ? 'Loading books...' : 'No books found'} />
      <div className="mt-3 flex items-center justify-end gap-3 text-[#66746b]">
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))}>Previous</button>
        <span>Page {page + 1} of {books.data?.totalPages || 1}</span>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" disabled={!books.data || page + 1 >= books.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
    </main>
  )
}
