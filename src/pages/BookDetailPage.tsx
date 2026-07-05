import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Edit3, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { BookPreview, formatAuthors } from '../components/BookPreview'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatLanguage } from '../utils/language'

const allowedDescriptionTags = new Set(['A', 'B', 'BR', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'UL'])

function sanitizeDescriptionHtml(value: string) {
  const doc = new DOMParser().parseFromString(value, 'text/html')
  doc.body.querySelectorAll('*').forEach((element) => {
    if (!allowedDescriptionTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }
    Array.from(element.attributes).forEach((attribute) => {
      if (element.tagName === 'A' && attribute.name === 'href' && /^https?:\/\//i.test(attribute.value)) return
      element.removeAttribute(attribute.name)
    })
    if (element.tagName === 'A') {
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noreferrer')
    }
  })
  return doc.body.innerHTML
}

function BookDescription({ value }: { value?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!value) return <>-</>

  return (
    <div className="grid gap-2">
      <div className={expanded ? "grid gap-2 [&_a]:font-bold [&_a]:text-[#1f6f4a] [&_ol]:m-0 [&_ol]:pl-5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-5" : "grid max-h-28 overflow-hidden gap-2 [&_a]:font-bold [&_a]:text-[#1f6f4a] [&_ol]:m-0 [&_ol]:pl-5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-5"} dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(value) }} />
      <button className="w-fit border-0 bg-transparent p-0 font-bold text-[#1f6f4a]" type="button" onClick={() => setExpanded((current) => !current)}>{expanded ? 'Collapse' : 'Expand'}</button>
    </div>
  )
}

export function BookDetailPage() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams({ strict: false }) as { bookId?: string }
  const bookId = Number(params.bookId)

  const book = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => api.getBook(accessToken!, bookId),
    enabled: !!accessToken && Number.isFinite(bookId),
  })

  const remove = useMutation({
    mutationFn: () => api.deleteBook(accessToken!, bookId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      await navigate({ to: '/books' })
    },
  })

  return (
    <main className="p-7 pb-0">
      <div className="mb-[18px] flex items-center justify-between gap-[18px]">
        <div><span className="text-xs font-bold uppercase tracking-normal text-[#66746b]">Catalog</span><h1 className="m-0 text-[30px] font-bold leading-tight tracking-normal text-[#17211b]">{book.data?.title ?? 'Book details'}</h1></div>
        <div className="flex gap-2.5">
          <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" to="/books">Back to books</Link>
          {book.data && <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" to="/books/$bookId/edit" params={{ bookId: String(book.data.id) }}><Edit3 size={16} />Edit</Link>}
          {book.data && <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#e0b8b8] !text-[#a52828]" disabled={remove.isPending} onClick={() => remove.mutate()}><Trash2 size={16} />Delete</button>}
        </div>
      </div>
      {book.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{book.error.message}</div>}
      {remove.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{remove.error.message}</div>}
      {book.isLoading && <div className="grid gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3 font-semibold text-[#344239]"><span>Loading book...</span></div>}
      {book.data && (
        <div className="grid grid-cols-[minmax(260px,340px)_minmax(0,960px)] items-start justify-start gap-4 max-[1000px]:grid-cols-1">
          <aside className="grid items-start gap-3.5 max-[1000px]:w-full max-[1000px]:max-w-none">
            {book.data.coverUrl && <img className="aspect-[2/3] w-full max-w-[180px] rounded-lg border border-[#dfe3dc] bg-[#edf0eb] object-cover max-[1000px]:max-w-[150px]" src={book.data.coverUrl} alt={book.data.title + ' cover'} />}
            <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2.5 [&_dd]:m-0 [&_dd]:break-words [&_dt]:font-bold [&_dt]:text-[#66746b]">
              <dt>Title</dt><dd>{book.data.title}</dd>
              <dt>Authors</dt><dd>{formatAuthors(book.data) || 'Unknown'}</dd>
              <dt>Description</dt><dd><BookDescription value={book.data.description} /></dd>
              <dt>Language</dt><dd>{formatLanguage(book.data.language) || '-'}</dd>
              <dt>Category</dt><dd>{book.data.category || 'None'}</dd>
              <dt>Format</dt><dd><span className="inline-flex items-center rounded-full bg-[#edf5ef] px-[9px] py-1 text-xs font-bold text-[#1f6f4a]">{book.data.fileFormat}</span></dd>
              <dt>File size</dt><dd>{(book.data.fileSize / 1024 / 1024).toFixed(2)} MB</dd>
              <dt>Status</dt><dd><span className={book.data.active ? "inline-flex items-center rounded-full bg-[#e8f6ed] px-[9px] py-1 text-xs font-bold text-[#1d7d44]" : "inline-flex items-center rounded-full bg-[#f7e9e9] px-[9px] py-1 text-xs font-bold text-[#9d2f2f]"}>{book.data.active ? 'Active' : 'Inactive'}</span></dd>
              <dt>Created</dt><dd>{new Date(book.data.createdAt).toLocaleString()}</dd>
              <dt>Updated</dt><dd>{new Date(book.data.updatedAt).toLocaleString()}</dd>
            </dl>
          </aside>
          <section className="w-full max-w-[960px] min-w-0 max-[1000px]:max-w-none">
            <BookPreview book={book.data} />
          </section>
        </div>
      )}
    </main>
  )
}
