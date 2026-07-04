import { ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PublicBook, PublicBookDetail } from '../lib/types'

type ReaderPage = { href: string; label: string }

export function formatAuthors(book: Pick<PublicBook, 'authors'>) {
  return book.authors?.length ? book.authors.join(', ') : ''
}

function normalizeFormat(format?: string | null) {
  return format?.replace(/^\./, '').toLowerCase() ?? ''
}

function collectTocLabels(items: any[] | undefined, labels = new Map<string, string>()) {
  items?.forEach((item) => {
    if (item.href && item.label) labels.set(item.href.split('#')[0], item.label)
    collectTocLabels(item.subitems, labels)
  })
  return labels
}

function buildReaderPages(bookInstance: any, navigation: any): ReaderPage[] {
  const tocLabels = collectTocLabels(navigation?.toc)
  const spineItems = bookInstance?.spine?.spineItems ?? []
  return spineItems
    .map((item: any, index: number) => {
      const href = item.href ?? item.url
      if (!href) return null
      return {
        href,
        label: tocLabels.get(href.split('#')[0]) ?? item.label ?? `Page ${index + 1}`,
      }
    })
    .filter(Boolean) as ReaderPage[]
}

export function BookPreview({ book }: { book: PublicBookDetail }) {
  const format = normalizeFormat(book.fileFormat)
  const [readerHost, setReaderHost] = useState<HTMLDivElement | null>(null)
  const renditionRef = useRef<any>(null)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerError, setReaderError] = useState<string | null>(null)
  const [readerReady, setReaderReady] = useState(false)
  const [readerPages, setReaderPages] = useState<ReaderPage[]>([])
  const [currentPageHref, setCurrentPageHref] = useState('')

  useEffect(() => {
    let cancelled = false
    let bookInstance: any = null
    let displayTimer: ReturnType<typeof setTimeout> | null = null

    const clearDisplayTimer = () => {
      if (displayTimer) {
        clearTimeout(displayTimer)
        displayTimer = null
      }
    }

    const markReady = () => {
      if (cancelled) return
      clearDisplayTimer()
      setReaderReady(true)
      setReaderLoading(false)
      setReaderError(null)
    }

    setReaderError(null)
    setReaderReady(false)
    setReaderPages([])
    setCurrentPageHref('')
    renditionRef.current?.destroy?.()
    renditionRef.current = null

    if (format !== 'epub' || !book.fileUrl || !readerHost) {
      setReaderLoading(false)
      return undefined
    }

    const fileUrl = book.fileUrl

    async function renderEpub() {
      setReaderLoading(true)

      try {
        const { default: ePub } = await import('epubjs')
        if (cancelled) return

        bookInstance = ePub(fileUrl)
        await Promise.race([
          bookInstance.opened,
          new Promise((_, reject) => {
            displayTimer = setTimeout(() => reject(new Error('Unable to open EPUB preview')), 15000)
          }),
        ])
        clearDisplayTimer()
        if (cancelled) return

        const navigation = await bookInstance.loaded.navigation.catch(() => null)
        if (!cancelled) setReaderPages(buildReaderPages(bookInstance, navigation))

        const rendition = bookInstance.renderTo(readerHost, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'scrolled-doc',
        })
        renditionRef.current = rendition
        rendition.on('rendered', (section: any) => {
          if (section?.href) setCurrentPageHref(section.href)
          markReady()
        })
        rendition.on('relocated', (location: any) => {
          const href = location?.start?.href ?? location?.end?.href
          if (href) setCurrentPageHref(href)
          markReady()
        })

        await Promise.race([
          rendition.display(),
          new Promise((_, reject) => {
            displayTimer = setTimeout(() => reject(new Error('Unable to render EPUB preview')), 15000)
          }),
        ])
        markReady()
      } catch (error) {
        if (cancelled) return
        clearDisplayTimer()
        setReaderReady(false)
        setReaderLoading(false)
        setReaderError(error instanceof Error ? error.message : 'Unable to render EPUB preview')
      }
    }

    void renderEpub()

    return () => {
      cancelled = true
      clearDisplayTimer()
      renditionRef.current?.destroy?.()
      renditionRef.current = null
      bookInstance?.destroy?.()
    }
  }, [book.fileUrl, format, readerHost])


  return (
    <section className="grid gap-3 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold leading-tight tracking-normal text-[#17211b]">Reader preview</h2>
        {book.fileUrl && <a className="inline-flex items-center gap-[7px] font-bold text-[#1f6f4a]" href={book.fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open file</a>}
      </div>
      {format === 'epub' && book.fileUrl && (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-[auto_minmax(160px,1fr)_auto] items-center gap-2 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b]">
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={!readerReady} onClick={() => renditionRef.current?.prev()}>Previous</button>
            <select
              aria-label="Page list"
              disabled={!readerReady || readerPages.length === 0}
              value={currentPageHref}
              onChange={(event) => {
                const href = event.target.value
                setCurrentPageHref(href)
                renditionRef.current?.display(href)
              }}
            >
              {!currentPageHref && <option value="">Page list</option>}
              {readerPages.map((page, index) => (
                <option key={`${page.href}-${index}`} value={page.href}>{page.label}</option>
              ))}
            </select>
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={!readerReady} onClick={() => renditionRef.current?.next()}>Next</button>
          </div>
          {readerLoading && <div className="grid gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3 font-semibold text-[#344239]"><span>Loading EPUB reader...</span></div>}
          {readerError && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{readerError}</div>}
          <div className="h-[min(58vh,620px)] w-full rounded-lg border border-[#dfe3dc] bg-white h-[min(64vh,720px)] overflow-x-hidden overflow-y-auto [&_.epub-container]:!overflow-x-hidden [&_.epub-container]:!overflow-y-auto" ref={setReaderHost} />
        </div>
      )}
      {format === 'pdf' && book.fileUrl && (
        <iframe className="h-[min(58vh,620px)] w-full rounded-lg border border-[#dfe3dc] bg-white" src={book.fileUrl} title={book.title + ' preview'} />
      )}
      {book.fileUrl && format !== 'epub' && format !== 'pdf' && (
        <div className="grid gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3 font-semibold text-[#344239]">
          <span>Inline preview is not available for this file type.</span>
          <span className="text-[#66746b]">Use Open file to inspect the uploaded book.</span>
        </div>
      )}
      {!book.fileUrl && <div className="grid gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3 font-semibold text-[#344239]"><span>No uploaded file is available for preview.</span></div>}
    </section>
  )
}
