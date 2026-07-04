import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Edit3, Eye, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DataTable } from '../components/DataTable'
import { Dialog } from '../components/Dialog'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { BookCategory } from '../lib/types'

type CategoryForm = { name: string; description: string; displayOrder: number; active: boolean }
type Mode = 'view' | 'edit' | 'create'

const emptyCategory: CategoryForm = { name: '', description: '', displayOrder: 0, active: true }

export function CategoriesPage() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [active, setActive] = useState('')
  const [selected, setSelected] = useState<BookCategory | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>({ defaultValues: emptyCategory })

  const categories = useQuery({
    queryKey: ['book-categories', { page, q, active }],
    queryFn: () => api.listBookCategories(accessToken!, { page, size: 20, q, active }),
    enabled: !!accessToken,
  })

  const create = useMutation({
    mutationFn: (values: CategoryForm) => api.createBookCategory(accessToken!, normalizeForm(values)),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: ['book-categories'] })
      setSelected(category)
      setMode('view')
    },
  })

  const update = useMutation({
    mutationFn: (values: CategoryForm) => api.updateBookCategory(accessToken!, selected!.id, normalizeForm(values)),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: ['book-categories'] })
      await queryClient.invalidateQueries({ queryKey: ['active-book-categories'] })
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      setSelected(category)
      setMode('view')
    },
  })

  const remove = useMutation({
    mutationFn: (category: BookCategory) => api.deleteBookCategory(accessToken!, category.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['book-categories'] })
      await queryClient.invalidateQueries({ queryKey: ['active-book-categories'] })
      closeDialog()
    },
  })

  function normalizeForm(values: CategoryForm) {
    return {
      name: values.name.trim(),
      description: values.description.trim(),
      displayOrder: Number(values.displayOrder) || 0,
      active: values.active,
    }
  }

  function openDialog(category: BookCategory, nextMode: Mode) {
    setSelected(category)
    setMode(nextMode)
    reset({
      name: category.name,
      description: category.description ?? '',
      displayOrder: category.displayOrder,
      active: category.active,
    })
  }

  function startCreate() {
    setSelected(null)
    setMode('create')
    reset(emptyCategory)
  }

  function closeDialog() {
    setSelected(null)
    setMode(null)
  }

  const columns = useMemo<ColumnDef<BookCategory>[]>(() => [
    { accessorKey: 'name', header: 'Name', cell: (info) => <strong>{info.getValue<string>()}</strong> },
    { accessorKey: 'slug', header: 'Slug', cell: (info) => <span className="text-[#66746b]">{info.getValue<string>()}</span> },
    { accessorKey: 'bookCount', header: 'Books' },
    { accessorKey: 'displayOrder', header: 'Order' },
    { accessorKey: 'active', header: 'Status', cell: (info) => <span className={info.getValue<boolean>() ? "inline-flex items-center rounded-full bg-[#e8f6ed] px-[9px] py-1 text-xs font-bold text-[#1d7d44]" : "inline-flex items-center rounded-full bg-[#f7e9e9] px-[9px] py-1 text-xs font-bold text-[#9d2f2f]"}>{info.getValue<boolean>() ? 'Active' : 'Inactive'}</span> },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2.5">
          <button className="inline-flex items-center gap-1.5 border-0 bg-transparent font-bold text-[#1f6f4a]" onClick={() => openDialog(row.original, 'view')}><Eye size={16} />View</button>
          <button className="inline-flex items-center gap-1.5 border-0 bg-transparent font-bold text-[#1f6f4a]" onClick={() => openDialog(row.original, 'edit')}><Edit3 size={16} />Edit</button>
        </div>
      ),
    },
  ], [])

  const currentMutation = mode === 'create' ? create : update

  return (
    <main className="p-7">
      <div className="mb-[18px] flex items-center justify-between gap-[18px]">
        <div><span className="text-xs font-bold uppercase tracking-normal text-[#66746b]">Catalog</span><h1 className="m-0 text-[30px] font-bold leading-tight tracking-normal text-[#17211b]">Categories</h1></div>
        <div className="flex gap-2.5"><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" onClick={() => categories.refetch()}><RefreshCcw size={16} />Refresh</button><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" onClick={startCreate}><Plus size={16} />New category</button></div>
      </div>
      <div className="mb-3.5 grid grid-cols-[minmax(220px,1fr)_180px] gap-2.5 max-[1000px]:grid-cols-1">
        <label className="relative flex items-center [&_svg]:absolute [&_svg]:left-3 [&_svg]:text-[#66746b] [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-[#c8d0c8] [&_input]:bg-white [&_input]:py-2.5 [&_input]:pr-[11px] [&_input]:pl-9 [&_input]:text-[#17211b]"><Search size={16} /><input placeholder="Search categories" value={q} onChange={(e) => { setPage(0); setQ(e.target.value) }} /></label>
        <select className="w-full rounded-lg border border-[#c8d0c8] bg-white px-[11px] py-2.5 text-[#17211b]" value={active} onChange={(e) => { setPage(0); setActive(e.target.value) }}>
          <option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
      </div>
      {categories.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{categories.error.message}</div>}
      <DataTable data={categories.data?.content ?? []} columns={columns} emptyLabel={categories.isLoading ? 'Loading categories...' : 'No categories found'} />
      <div className="mt-3 flex items-center justify-end gap-3 text-[#66746b]">
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))}>Previous</button>
        <span>Page {page + 1} of {categories.data?.totalPages || 1}</span>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" disabled={!categories.data || page + 1 >= categories.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>

      <Dialog open={mode !== null} title={mode === 'create' ? 'Create category' : mode === 'edit' ? 'Edit category' : 'Category details'} onClose={closeDialog}>
        {mode === 'view' && selected && (
          <>
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2.5 [&_dd]:m-0 [&_dt]:font-bold [&_dt]:text-[#66746b]">
              <dt>Name</dt><dd>{selected.name}</dd>
              <dt>Slug</dt><dd>{selected.slug}</dd>
              <dt>Description</dt><dd>{selected.description || '—'}</dd>
              <dt>Books</dt><dd>{selected.bookCount}</dd>
              <dt>Order</dt><dd>{selected.displayOrder}</dd>
              <dt>Status</dt><dd><span className={selected.active ? "inline-flex items-center rounded-full bg-[#e8f6ed] px-[9px] py-1 text-xs font-bold text-[#1d7d44]" : "inline-flex items-center rounded-full bg-[#f7e9e9] px-[9px] py-1 text-xs font-bold text-[#9d2f2f]"}>{selected.active ? 'Active' : 'Inactive'}</span></dd>
              <dt>Created</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd>
              <dt>Updated</dt><dd>{new Date(selected.updatedAt).toLocaleString()}</dd>
            </dl>
            <div className="mt-1 flex flex-wrap gap-2.5">
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" onClick={() => setMode('edit')}><Edit3 size={16} />Edit</button>
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#e0b8b8] !text-[#a52828]" disabled={remove.isPending || selected.bookCount > 0} onClick={() => remove.mutate(selected)}><Trash2 size={16} />Delete</button>
            </div>
            {selected.bookCount > 0 && <div className="grid gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3 font-semibold text-[#344239]"><span>Categories assigned to books cannot be deleted. Set inactive to hide them from new uploads.</span></div>}
            {remove.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{remove.error.message}</div>}
          </>
        )}
        {(mode === 'edit' || mode === 'create') && (
          <form className="grid gap-[22px]" onSubmit={handleSubmit((values) => currentMutation.mutate(values))}>
            <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Name<input {...register('name', { required: 'Name is required' })} />{errors.name && <small>{errors.name.message}</small>}</label>
            <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Description<textarea rows={3} {...register('description')} /></label>
            <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Display order<input type="number" {...register('displayOrder', { valueAsNumber: true })} /></label>
            <label className="flex flex-row items-center gap-[9px] font-bold text-[#344239] [&_input]:w-auto"><input type="checkbox" {...register('active')} />Active category</label>
            {currentMutation.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{currentMutation.error.message}</div>}
            <div className="mt-1 flex flex-wrap gap-2.5">
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" disabled={currentMutation.isPending}>{currentMutation.isPending ? 'Saving...' : mode === 'create' ? 'Create category' : 'Save changes'}</button>
              {selected && <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" onClick={() => setMode('view')}>Cancel</button>}
            </div>
          </form>
        )}
      </Dialog>
    </main>
  )
}
