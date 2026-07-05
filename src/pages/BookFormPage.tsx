import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import type { ChangeEvent, FocusEvent, MutableRefObject, ReactNode, RefCallback } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { extractBookMetadata, type BookMetadataResult, type ExtractedCoverImage } from '../lib/bookMetadata'
import type { PublicBookDetail } from '../lib/types'
import { getLanguageCode, languages } from '../utils/language'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

type BookForm = {
  title: string
  author: string
  description: string
  language: string
  category: string
  categoryId: string
  active: boolean
  file: FileList
  coverImage: FileList
}

type FileMode = 'current' | 'upload'

type FilePickerRegistration = {
  name: string
  onBlur: (event: FocusEvent<HTMLInputElement>) => void
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  ref: RefCallback<HTMLInputElement>
}

type FilePickerFieldProps = {
  label: string
  accept: string
  fileName: string
  registration: FilePickerRegistration
  inputRef: MutableRefObject<HTMLInputElement | null>
  error?: string
  required?: boolean
  hint?: string
}

type FieldLabelProps = {
  children: ReactNode
  required?: boolean
}

function FieldLabel({ children, required }: FieldLabelProps) {
  return <span className="inline-flex items-baseline gap-1">{children}{required && <span className="font-extrabold text-[#c92222]">*</span>}</span>
}

function FileTabs({ value, onChange, hasCurrent }: { value: FileMode; onChange: (value: FileMode) => void; hasCurrent: boolean }) {
  return (
    <div className="inline-grid w-fit grid-cols-[repeat(2,minmax(0,128px))] gap-1 rounded-lg border border-[#c8d0c8] bg-[#fbfcfa] p-1" role="tablist">
      <button className={value === 'current' ? "rounded-md border-0 bg-transparent px-2.5 py-2 font-bold text-[#66746b] disabled:cursor-not-allowed disabled:opacity-45 !bg-[#1f6f4a] !text-white" : "rounded-md border-0 bg-transparent px-2.5 py-2 font-bold text-[#66746b] disabled:cursor-not-allowed disabled:opacity-45"} type="button" role="tab" disabled={!hasCurrent} aria-selected={value === 'current'} onClick={() => onChange('current')}>Current</button>
      <button className={value === 'upload' ? "rounded-md border-0 bg-transparent px-2.5 py-2 font-bold text-[#66746b] disabled:cursor-not-allowed disabled:opacity-45 !bg-[#1f6f4a] !text-white" : "rounded-md border-0 bg-transparent px-2.5 py-2 font-bold text-[#66746b] disabled:cursor-not-allowed disabled:opacity-45"} type="button" role="tab" aria-selected={value === 'upload'} onClick={() => onChange('upload')}>Upload new</button>
    </div>
  )
}

const emptyBook: BookForm = { title: '', author: '', description: '', language: '', category: '', categoryId: '', active: true, file: undefined as unknown as FileList, coverImage: undefined as unknown as FileList }
const maxBookFileSize = 50 * 1024 * 1024

function FilePickerField({ label, accept, fileName, registration, inputRef, error, required, hint }: FilePickerFieldProps) {
  return (
    <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]"><FieldLabel required={required}>{label}</FieldLabel>
      <input
        className="pointer-events-none absolute size-px opacity-0"
        type="file"
        accept={accept}
        tabIndex={-1}
        name={registration.name}
        onBlur={registration.onBlur}
        onChange={registration.onChange}
        ref={(element) => {
          registration.ref(element)
          inputRef.current = element
        }}
      />
      <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" onClick={() => inputRef.current?.click()}>Choose file</button>
        <input readOnly value={fileName || 'No file chosen'} />
      </span>
      {hint && <span className="text-sm font-semibold text-[#66746b]">{hint}</span>}
      {error && <small>{error}</small>}
    </label>
  )
}

function appendText(form: FormData, key: string, value: string | boolean | undefined) {
  if (value !== undefined && value !== '') form.append(key, String(value))
}

function parseAuthors(value: string) {
  const seen = new Set<string>()
  return value
    .split(/\s*(?:,|;|\|)\s*/)
    .map((author) => author.trim())
    .filter((author) => {
      if (!author) return false
      const key = author.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function toFormData(values: BookForm, extractedCoverImage?: ExtractedCoverImage | null) {
  const form = new FormData()
  const authors = parseAuthors(values.author)
  appendText(form, 'title', values.title.trim())
  authors.forEach((author) => form.append('authors', author))
  appendText(form, 'description', values.description.trim())
  appendText(form, 'language', values.language.trim())
  appendText(form, 'categoryId', values.categoryId)
  if (!values.categoryId) form.append('category', '')
  appendText(form, 'active', values.active)
  if (values.file?.[0]) form.append('file', values.file[0])
  if (values.coverImage?.[0]) form.append('coverImage', values.coverImage[0])
  else if (extractedCoverImage) form.append('coverImage', extractedCoverImage.file)
  return form
}

function fillFormValues(detail: PublicBookDetail): BookForm {
  return {
    title: detail.title,
    author: detail.authors?.join(', ') ?? '',
    description: detail.description ?? '',
    language: getLanguageCode(detail.language) || detail.language || '',
    category: detail.category ?? '',
    categoryId: detail.categoryId ? String(detail.categoryId) : '',
    active: detail.active,
    file: undefined as unknown as FileList,
    coverImage: undefined as unknown as FileList,
  }
}

function BookFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { bookId?: string }
  const bookId = Number(params.bookId)
  const [metadataResult, setMetadataResult] = useState<BookMetadataResult | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [bookFileName, setBookFileName] = useState('')
  const [bookFileMode, setBookFileMode] = useState<FileMode>(mode === 'edit' ? 'current' : 'upload')
  const [coverImageMode, setCoverImageMode] = useState<FileMode>(mode === 'edit' ? 'current' : 'upload')
  const [extractedCoverImage, setExtractedCoverImage] = useState<ExtractedCoverImage | null>(null)
  const [coverImagePreviewUrl, setCoverImagePreviewUrl] = useState<string | null>(null)
  const [coverPreviewOpen, setCoverPreviewOpen] = useState(false)
  const [coverImageFileName, setCoverImageFileName] = useState('')
  const bookFileInputRef = useRef<HTMLInputElement | null>(null)
  const coverImageInputRef = useRef<HTMLInputElement | null>(null)
  const coverObjectUrlRef = useRef<string | null>(null)
  const { register, handleSubmit, reset, getValues, setValue, clearErrors, formState: { errors } } = useForm<BookForm>({ defaultValues: emptyBook })

  useEffect(() => () => revokeCoverObjectUrl(), [])

  const categories = useQuery({
    queryKey: ['active-book-categories'],
    queryFn: () => api.listActiveBookCategories(accessToken!),
    enabled: !!accessToken,
  })

  const detail = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => api.getBook(accessToken!, bookId),
    enabled: !!accessToken && mode === 'edit' && Number.isFinite(bookId),
  })

  useEffect(() => {
    if (mode === 'edit' && detail.data) {
      reset(fillFormValues(detail.data))
      clearBookFileField()
      clearCoverImageField(detail.data.coverUrl ?? null)
      setBookFileMode(detail.data.fileUrl ? 'current' : 'upload')
      setCoverImageMode(detail.data.coverUrl ? 'current' : 'upload')
      setMetadataResult(null)
      setMetadataError(null)
      setExtractedCoverImage(null)
    }
  }, [detail.data, mode, reset])

  const create = useMutation({
    mutationFn: (values: BookForm) => api.createBook(accessToken!, toFormData(values, extractedCoverImage)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      await navigate({ to: '/books' })
    },
  })

  const update = useMutation({
    mutationFn: (values: BookForm) => api.updateBook(accessToken!, bookId, toFormData(values, extractedCoverImage)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      await queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      await navigate({ to: '/books' })
    },
  })

  function clearBookFileField() {
    if (bookFileInputRef.current) {
      bookFileInputRef.current.value = ''
    }
    setBookFileName('')
    setValue('file', undefined as unknown as FileList)
  }

  function selectBookFileMode(nextMode: FileMode) {
    setBookFileMode(nextMode)
    if (nextMode === 'current') {
      clearBookFileField()
      clearErrors('file')
    }
  }

  function selectCoverImageMode(nextMode: FileMode) {
    setCoverImageMode(nextMode)
    if (nextMode === 'current') {
      clearCoverImageField(detail.data?.coverUrl ?? null)
      clearErrors('coverImage')
    } else {
      clearCoverImageField()
    }
  }

  function revokeCoverObjectUrl() {
    if (coverObjectUrlRef.current) {
      URL.revokeObjectURL(coverObjectUrlRef.current)
      coverObjectUrlRef.current = null
    }
  }

  function setCoverPreviewFromFile(file: File) {
    revokeCoverObjectUrl()
    const previewUrl = URL.createObjectURL(file)
    coverObjectUrlRef.current = previewUrl
    setCoverImagePreviewUrl(previewUrl)
    setCoverImageFileName(file.name)
  }

  function clearCoverImageField(nextPreviewUrl: string | null = null) {
    if (coverImageInputRef.current) {
      coverImageInputRef.current.value = ''
    }
    revokeCoverObjectUrl()
    setCoverImagePreviewUrl(nextPreviewUrl)
    setCoverPreviewOpen(false)
    setCoverImageFileName('')
    setValue('coverImage', undefined as unknown as FileList, { shouldDirty: true, shouldTouch: true, shouldValidate: mode === 'edit' && !nextPreviewUrl })
    if (mode === 'create' || nextPreviewUrl) clearErrors('coverImage')
  }

  function fillCoverImageField(coverImage: ExtractedCoverImage) {
    const input = coverImageInputRef.current
    if (!input) return
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(coverImage.file)
    input.files = dataTransfer.files
    setValue('coverImage', dataTransfer.files, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    clearErrors('coverImage')
    setCoverPreviewFromFile(coverImage.file)
  }

  function handleCoverImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setExtractedCoverImage(null)
    if (file) {
      setCoverImageMode('upload')
      setValue('coverImage', event.target.files as FileList, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
      clearErrors('coverImage')
      setCoverPreviewFromFile(file)
    } else {
      clearCoverImageField(detail.data?.coverUrl ?? null)
    }
  }

  async function extractCurrentPdfCover() {
    if (!detail.data?.fileUrl) return
    setMetadataError(null)
    setMetadataLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/store/${detail.data.id}/download`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error(`Unable to read current PDF (${response.status})`)
      const blob = await response.blob()
      const fileName = (detail.data.title || 'book').replace(/[^a-z0-9_-]+/gi, '-') + '.pdf'
      const result = await extractBookMetadata(new File([blob], fileName, { type: 'application/pdf' }))
      if (!result.coverImage) throw new Error('Unable to extract cover from current PDF.')
      setCoverImageMode('upload')
      fillCoverImageField(result.coverImage)
      setExtractedCoverImage(result.coverImage)
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : 'Unable to extract cover from current PDF.')
    } finally {
      setMetadataLoading(false)
    }
  }

  async function handleBookFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setMetadataResult(null)
    setMetadataError(null)
    setExtractedCoverImage(null)
    clearCoverImageField()
    if (!file) {
      setBookFileName('')
      return
    }
    setBookFileMode('upload')
    setBookFileName(file.name)
    if (file.size > maxBookFileSize) {
      setMetadataError('Book file must be 50MB or smaller.')
      return
    }
    if (!(/\.(epub|pdf)$/i.test(file.name) || file.type === 'application/epub+zip' || file.type === 'application/pdf')) {
      setMetadataError('Book file must be EPUB or PDF.')
      return
    }

    setMetadataLoading(true)
    try {
      const result = await extractBookMetadata(file)
      Object.entries(result.metadata).forEach(([key, value]) => {
        if (key === 'authors') {
          if (Array.isArray(value) && value.length) {
            setValue('author', value.join(', '), { shouldDirty: true, shouldValidate: true })
          }
          return
        }
        if (key === 'language' && typeof value === 'string') {
          const language = getLanguageCode(value)
          if (language) setValue('language', language, { shouldDirty: true, shouldValidate: true })
          return
        }
        const field = key as keyof Pick<BookForm, 'title' | 'author' | 'description' | 'category'>
        if (typeof value === 'string' && value) {
          setValue(field, value, { shouldDirty: true, shouldValidate: true })
        }
      })
      const extractedCategory = result.metadata.category?.trim().toLowerCase()
      if (extractedCategory) {
        const matchedCategory = categories.data?.find((item) => item.name.toLowerCase() === extractedCategory)
        if (matchedCategory) {
          setValue('categoryId', String(matchedCategory.id), { shouldDirty: true, shouldValidate: true })
          setValue('category', matchedCategory.name, { shouldDirty: true })
        }
      }
      if (result.coverImage) {
        setCoverImageMode('upload')
        fillCoverImageField(result.coverImage)
      }
      setExtractedCoverImage(result.coverImage ?? null)
      setMetadataResult(result)
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : 'Unable to read metadata from this file.')
    } finally {
      setMetadataLoading(false)
    }
  }

  const currentMutation = mode === 'create' ? create : update
  const bookFileInput = register('file', {
    validate: () => {
      const file = bookFileInputRef.current?.files?.[0]
      if (!file && mode === 'edit' && bookFileMode === 'current' && detail.data?.fileUrl) return true
      if (!file) return 'Book file is required'
      if (file.size > maxBookFileSize) return 'Book file must be 50MB or smaller'
      return /\.(epub|pdf)$/i.test(file.name) || file.type === 'application/epub+zip' || file.type === 'application/pdf' || 'Book file must be EPUB or PDF'
    },
    onChange: handleBookFileChange,
  })
  const coverImageInput = register('coverImage', {
    ...(mode === 'edit' ? { validate: () => Boolean(coverImageInputRef.current?.files?.length || (coverImageMode === 'current' && detail.data?.coverUrl)) || 'Cover image is required' } : {}),
    onChange: handleCoverImageChange,
  })
  const title = mode === 'create' ? 'Add new book' : 'Edit book'

  return (
    <main className="w-full max-w-[960px] overflow-x-hidden p-7">
      <div className="mb-[18px] flex items-center justify-between gap-[18px]">
        <div><span className="text-xs font-bold uppercase tracking-normal text-[#66746b]">Catalog</span><h1 className="m-0 text-[30px] font-bold leading-tight tracking-normal text-[#17211b]">{title}</h1></div>
        <div className="flex gap-2.5"><Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" to="/books">Back to books</Link></div>
      </div>
      {detail.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{detail.error.message}</div>}
      {mode === 'edit' && detail.isLoading && <div className="grid gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3 font-semibold text-[#344239]"><span>Loading book...</span></div>}
      {mode === 'create' || detail.data ? (
        <form className="grid gap-[22px]" onSubmit={handleSubmit((values) => currentMutation.mutate(values))}>
          <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]"><FieldLabel required>Title</FieldLabel><input {...register('title', { required: 'Title is required' })} />{errors.title && <small>{errors.title.message}</small>}</label>
          <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]"><FieldLabel required>Authors</FieldLabel><input {...register('author', { validate: (value) => parseAuthors(value).length > 0 || 'Authors are required' })} />{errors.author && <small>{errors.author.message}</small>}</label>
          <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Description<textarea rows={4} {...register('description')} /></label>
          <div className="grid grid-cols-2 gap-[18px] max-[1000px]:grid-cols-1"><label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]"><FieldLabel required>Language</FieldLabel><select className="w-full rounded-lg border border-[#c8d0c8] bg-white px-[11px] py-2.5 text-[#17211b]" {...register('language', { required: 'Language is required' })}><option value="">Select language</option>{languages.map((item) => <option key={item.code} value={item.code}>{item.name}{item.native !== item.name ? ` (${item.native})` : ''}</option>)}</select>{errors.language && <small>{errors.language.message}</small>}</label><label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]"><FieldLabel required>Category</FieldLabel><select className="w-full rounded-lg border border-[#c8d0c8] bg-white px-[11px] py-2.5 text-[#17211b]" {...register('categoryId', { required: 'Category is required' })}><option value="">Uncategorized</option>{(categories.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.categoryId && <small>{errors.categoryId.message}</small>}</label></div>
          <input type="hidden" {...register('category')} />
          {mode === 'edit' ? (
            <div className="grid gap-2.5 [&_small]:font-semibold [&_small]:text-[#a52828]">
              <FieldLabel required>Book file</FieldLabel>
              <FileTabs value={bookFileMode} onChange={selectBookFileMode} hasCurrent={Boolean(detail.data?.fileUrl)} />
              {bookFileMode === 'current' ? (
                <div className="grid items-start gap-2.5 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3">
                  {detail.data?.fileUrl ? <a className="inline-flex items-center gap-[7px] font-bold text-[#1f6f4a]" href={detail.data.fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open current book file</a> : <span className="text-[#66746b]">No current book file is available.</span>}
                </div>
              ) : (
                <FilePickerField
                  label="Upload book file"
                  accept=".epub,.pdf"
                  fileName={bookFileName}
                  registration={bookFileInput}
                  inputRef={bookFileInputRef}
                  error={errors.file?.message}
                  hint="Accepted file types: EPUB, PDF. Maximum size: 50MB"
                />
              )}
              {bookFileMode === 'current' && errors.file && <small>{errors.file.message}</small>}
            </div>
          ) : (
            <FilePickerField
              label="Book file"
              accept=".epub,.pdf"
              fileName={bookFileName}
              registration={bookFileInput}
              inputRef={bookFileInputRef}
              error={errors.file?.message}
              required
              hint="Accepted file types: EPUB, PDF. Maximum size: 50MB"
            />
          )}
          {mode === 'edit' ? (
            <div className="grid gap-2.5 [&_small]:font-semibold [&_small]:text-[#a52828]">
              <FieldLabel required>Cover image</FieldLabel>
              <FileTabs value={coverImageMode} onChange={selectCoverImageMode} hasCurrent={Boolean(detail.data?.coverUrl)} />
              {coverImageMode === 'current' ? (
                <div className="grid items-start gap-2.5 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3">
                  {detail.data?.coverUrl ? (
                    <button className="inline-flex w-fit items-start gap-3 border-0 bg-transparent p-0 [&_img]:aspect-[2/3] [&_img]:w-28 [&_img]:rounded-md [&_img]:border [&_img]:border-[#dfe3dc] [&_img]:bg-[#edf0eb] [&_img]:object-cover hover:[&_img]:border-[#1f6f4a]" type="button" onClick={() => setCoverPreviewOpen(true)} aria-label="Open current cover preview">
                      <img src={detail.data.coverUrl} alt="Current cover preview" />
                    </button>
                  ) : <span className="text-[#66746b]">No current cover image is available.</span>}
                  {detail.data?.fileFormat?.toLowerCase() === 'pdf' && detail.data.fileUrl && <button className="inline-flex w-fit min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={metadataLoading} onClick={extractCurrentPdfCover}>{metadataLoading ? 'Extracting cover...' : 'Use first PDF page as cover'}</button>}
                </div>
              ) : (
                <>
                  <FilePickerField
                    label="Upload cover image"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    fileName={coverImageFileName}
                    registration={coverImageInput}
                    inputRef={coverImageInputRef}
                    error={errors.coverImage?.message}
                  />
                  {detail.data?.fileFormat?.toLowerCase() === 'pdf' && detail.data.fileUrl && <button className="inline-flex w-fit min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={metadataLoading} onClick={extractCurrentPdfCover}>{metadataLoading ? 'Extracting cover...' : 'Use first PDF page as cover'}</button>}
                  {coverImagePreviewUrl && (
                    <button className="inline-flex w-fit items-start gap-3 border-0 bg-transparent p-0 [&_img]:aspect-[2/3] [&_img]:w-28 [&_img]:rounded-md [&_img]:border [&_img]:border-[#dfe3dc] [&_img]:bg-[#edf0eb] [&_img]:object-cover hover:[&_img]:border-[#1f6f4a]" type="button" onClick={() => setCoverPreviewOpen(true)} aria-label="Open cover preview">
                      <img src={coverImagePreviewUrl} alt="Cover preview" />
                    </button>
                  )}
                </>
              )}
              {coverImageMode === 'current' && errors.coverImage && <small>{errors.coverImage.message}</small>}
            </div>
          ) : (
            <>
              <FilePickerField
                label="Cover image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                fileName={coverImageFileName}
                registration={coverImageInput}
                inputRef={coverImageInputRef}
                error={errors.coverImage?.message}
              />
              {coverImagePreviewUrl && (
                <button className="inline-flex w-fit items-start gap-3 border-0 bg-transparent p-0 [&_img]:aspect-[2/3] [&_img]:w-28 [&_img]:rounded-md [&_img]:border [&_img]:border-[#dfe3dc] [&_img]:bg-[#edf0eb] [&_img]:object-cover hover:[&_img]:border-[#1f6f4a]" type="button" onClick={() => setCoverPreviewOpen(true)} aria-label="Open cover preview">
                  <img src={coverImagePreviewUrl} alt="Cover preview" />
                </button>
              )}
            </>
          )}
          <label className="flex flex-row items-center gap-[9px] font-bold text-[#344239] [&_input]:w-auto"><input type="checkbox" {...register('active')} />Active listing</label>
          {currentMutation.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{currentMutation.error.message}</div>}
          <div className="mt-1 flex flex-wrap gap-2.5">
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" disabled={currentMutation.isPending}>{currentMutation.isPending ? 'Saving...' : mode === 'create' ? 'Add new book' : 'Save changes'}</button>
            <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" to="/books">Cancel</Link>
          </div>
        </form>
      ) : null}
      {coverPreviewOpen && coverImagePreviewUrl && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(16,35,28,.58)] p-7" role="dialog" aria-modal="true" onClick={() => setCoverPreviewOpen(false)}>
          <div className="relative max-h-[calc(100vh-56px)] max-w-[min(92vw,720px)]" onClick={(event) => event.stopPropagation()}>
            <button className="inline-flex rounded-md border-0 bg-transparent p-1 text-[#66746b] hover:bg-[#edf0eb] hover:text-[#17211b] absolute right-2.5 top-2.5 bg-[rgba(255,255,255,.92)] text-[#17211b]" type="button" onClick={() => setCoverPreviewOpen(false)} aria-label="Close cover preview">x</button>
            <img className="block max-h-[calc(100vh-56px)] max-w-full rounded-lg bg-white object-contain shadow-[0_24px_70px_rgba(16,35,28,.32)]" src={coverImagePreviewUrl} alt="Cover preview enlarged" />
          </div>
        </div>
      )}
    </main>
  )
}

export function BookCreatePage() {
  return <BookFormPage mode="create" />
}

export function BookEditPage() {
  return <BookFormPage mode="edit" />
}
