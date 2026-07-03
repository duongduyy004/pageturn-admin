import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Edit3, ExternalLink, Eye, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DataTable } from '../components/DataTable'
import { Dialog } from '../components/Dialog'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { PublicBook, PublicBookDetail } from '../lib/types'

type BookForm = {
  title: string
  author: string
  description: string
  language: string
  category: string
  active: boolean
  file: FileList
  coverImage: FileList
}

type Mode = 'view' | 'edit' | 'create'

const emptyBook: BookForm = { title: '', author: '', description: '', language: '', category: '', active: true, file: undefined as unknown as FileList, coverImage: undefined as unknown as FileList }

function appendText(form: FormData, key: string, value: string | boolean | undefined) {
  if (value !== undefined && value !== '') form.append(key, String(value))
}

function toFormData(values: BookForm) {
  const form = new FormData()
  appendText(form, 'title', values.title.trim())
  appendText(form, 'author', values.author.trim())
  appendText(form, 'description', values.description.trim())
  appendText(form, 'language', values.language.trim())
  appendText(form, 'category', values.category.trim())
  appendText(form, 'active', values.active)
  if (values.file?.[0]) form.append('file', values.file[0])
  if (values.coverImage?.[0]) form.append('coverImage', values.coverImage[0])
  return form
}

export function BooksPage() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [active, setActive] = useState('')
  const [selected, setSelected] = useState<PublicBookDetail | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BookForm>({ defaultValues: emptyBook })

  const books = useQuery({
    queryKey: ['books', { page, q, category, active }],
    queryFn: () => api.listBooks(accessToken!, { page, size: 20, q, category, active }),
    enabled: !!accessToken,
  })

  const create = useMutation({
    mutationFn: (values: BookForm) => api.createBook(accessToken!, toFormData(values)),
    onSuccess: async (book) => {
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      setSelected(book)
      setMode('view')
    },
  })

  const update = useMutation({
    mutationFn: (values: BookForm) => api.updateBook(accessToken!, selected!.id, toFormData(values)),
    onSuccess: async (book) => {
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      setSelected(book)
      setMode('view')
    },
  })

  const remove = useMutation({
    mutationFn: (book: PublicBook) => api.deleteBook(accessToken!, book.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      closeDialog()
    },
  })

  function fillForm(detail: PublicBookDetail) {
    reset({
      title: detail.title,
      author: detail.author ?? '',
      description: detail.description ?? '',
      language: detail.language ?? '',
      category: detail.category ?? '',
      active: detail.active,
      file: undefined as unknown as FileList,
      coverImage: undefined as unknown as FileList,
    })
  }

  async function openDialog(book: PublicBook, nextMode: 'view' | 'edit') {
    const detail = await api.getBook(accessToken!, book.id)
    setSelected(detail)
    setMode(nextMode)
    fillForm(detail)
  }

  function startCreate() {
    setSelected(null)
    setMode('create')
    reset(emptyBook)
  }

  function closeDialog() {
    setSelected(null)
    setMode(null)
  }

  const columns = useMemo<ColumnDef<PublicBook>[]>(() => [
    { accessorKey: 'title', header: 'Title', cell: (info) => <strong>{info.getValue<string>()}</strong> },
    { accessorKey: 'author', header: 'Author', cell: (info) => info.getValue<string>() || 'Unknown' },
    { accessorKey: 'category', header: 'Category', cell: (info) => info.getValue<string>() || 'None' },
    { accessorKey: 'fileFormat', header: 'Format', cell: (info) => <span className="pill">{info.getValue<string>()}</span> },
    { accessorKey: 'downloadCount', header: 'Downloads' },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="actions">
          <button className="icon-text" onClick={() => openDialog(row.original, 'view')}><Eye size={16} />View</button>
          <button className="icon-text" onClick={() => openDialog(row.original, 'edit')}><Edit3 size={16} />Edit</button>
        </div>
      ),
    },
  ], [])

  const currentMutation = mode === 'create' ? create : update

  const dialogTitle = mode === 'create' ? 'Create book' : mode === 'edit' ? 'Edit book' : 'Book details'

  return (
    <main className="page">
      <div className="page-title">
        <div><span className="eyebrow">Catalog</span><h1>Books</h1></div>
        <div className="actions"><button className="button" onClick={() => books.refetch()}><RefreshCcw size={16} />Refresh</button><button className="button primary" onClick={startCreate}><Plus size={16} />New book</button></div>
      </div>
      <div className="filters">
        <label className="search-field"><Search size={16} /><input placeholder="Search title or author" value={q} onChange={(e) => { setPage(0); setQ(e.target.value) }} /></label>
        <input placeholder="Category" value={category} onChange={(e) => { setPage(0); setCategory(e.target.value) }} />
        <select value={active} onChange={(e) => { setPage(0); setActive(e.target.value) }}>
          <option value="">All visibility</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
      </div>
      {books.error && <div className="error-box">{books.error.message}</div>}
      <DataTable data={books.data?.content ?? []} columns={columns} emptyLabel={books.isLoading ? 'Loading books...' : 'No books found'} />
      <div className="pager">
        <button className="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))}>Previous</button>
        <span>Page {page + 1} of {books.data?.totalPages || 1}</span>
        <button className="button" disabled={!books.data || page + 1 >= books.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>

      <Dialog open={mode !== null} title={dialogTitle} onClose={closeDialog} wide={mode !== 'view'}>
        {mode === 'view' && selected && (
          <>
            {selected.fileUrl && <a className="file-link" href={selected.fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open uploaded file</a>}
            <dl className="detail-grid">
              <dt>Title</dt><dd>{selected.title}</dd>
              <dt>Author</dt><dd>{selected.author || 'Unknown'}</dd>
              <dt>Description</dt><dd>{selected.description || '—'}</dd>
              <dt>Language</dt><dd>{selected.language || '—'}</dd>
              <dt>Category</dt><dd>{selected.category || 'None'}</dd>
              <dt>Format</dt><dd><span className="pill">{selected.fileFormat}</span></dd>
              <dt>File size</dt><dd>{(selected.fileSize / 1024 / 1024).toFixed(2)} MB</dd>
              <dt>Downloads</dt><dd>{selected.downloadCount}</dd>
              <dt>Status</dt><dd><span className={selected.active ? 'status active' : 'status inactive'}>{selected.active ? 'Active' : 'Inactive'}</span></dd>
              <dt>Created</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd>
              <dt>Updated</dt><dd>{new Date(selected.updatedAt).toLocaleString()}</dd>
            </dl>
            <div className="form-actions">
              <button className="button primary" onClick={() => setMode('edit')}><Edit3 size={16} />Edit</button>
              <button className="button danger" disabled={remove.isPending} onClick={() => remove.mutate(selected)}><Trash2 size={16} />Delete</button>
            </div>
            {remove.error && <div className="error-box">{remove.error.message}</div>}
          </>
        )}
        {(mode === 'edit' || mode === 'create') && (
          <>
            {selected?.fileUrl && <a className="file-link" href={selected.fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open uploaded file</a>}
            <form onSubmit={handleSubmit((values) => currentMutation.mutate(values))}>
              <label>Title<input {...register('title', { required: 'Title is required' })} />{errors.title && <small>{errors.title.message}</small>}</label>
              <label>Author<input {...register('author')} /></label>
              <label>Description<textarea rows={4} {...register('description')} /></label>
              <div className="form-grid"><label>Language<input {...register('language')} /></label><label>Category<input {...register('category')} /></label></div>
              <label>Book file<input type="file" accept=".epub,.pdf,.txt" {...register('file', { required: mode === 'create' ? 'Book file is required' : false })} />{errors.file && <small>{errors.file.message}</small>}</label>
              <label>Cover image<input type="file" accept="image/jpeg" {...register('coverImage')} /></label>
              <label className="check"><input type="checkbox" {...register('active')} />Active listing</label>
              {currentMutation.error && <div className="error-box">{currentMutation.error.message}</div>}
              <div className="form-actions">
                <button className="button primary" disabled={currentMutation.isPending}>{currentMutation.isPending ? 'Saving...' : mode === 'create' ? 'Create book' : 'Save changes'}</button>
                {selected && <button className="button" type="button" onClick={() => setMode('view')}>Cancel</button>}
              </div>
            </form>
          </>
        )}
      </Dialog>
    </main>
  )
}
