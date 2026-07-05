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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function previewFileUrl(book: PublicBookDetail) {
  return `${API_BASE_URL}/api/v1/store/${book.id}/download`
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
  const [epubSidebarOpen, setEpubSidebarOpen] = useState(true)
  const [pdfPagesHost, setPdfPagesHost] = useState<HTMLDivElement | null>(null)
  const pdfDocumentRef = useRef<any>(null)
  const pdfRenderTaskRef = useRef<any[]>([])
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [currentPdfPage, setCurrentPdfPage] = useState(1)
  const [pdfScale, setPdfScale] = useState(1)
  const [pdfSidebarOpen, setPdfSidebarOpen] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const fileUrl = book.fileUrl ? previewFileUrl(book) : ''

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

    async function renderEpub() {
      setReaderLoading(true)

      try {
        const { default: ePub } = await import('epubjs')
        if (cancelled) return

        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error(`Unable to load EPUB preview (${response.status})`)
        bookInstance = ePub(await response.arrayBuffer())
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
  }, [book.fileUrl, fileUrl, format, readerHost])

  useEffect(() => {
    let cancelled = false

    setPdfError(null)
    setPdfPageCount(0)
    setCurrentPdfPage(1)
    pdfRenderTaskRef.current.forEach((task) => task?.cancel?.())
    pdfRenderTaskRef.current = []
    pdfDocumentRef.current?.destroy?.()
    pdfDocumentRef.current = null

    if (format !== 'pdf' || !book.fileUrl) {
      setPdfLoading(false)
      return undefined
    }

    async function loadPdf() {
      setPdfLoading(true)
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc ||= new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error(`Unable to load PDF preview (${response.status})`)
        const document = await pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise
        if (cancelled) {
          await document.destroy()
          return
        }
        pdfDocumentRef.current = document
        setPdfPageCount(document.numPages)
        setPdfLoading(false)
      } catch (error) {
        if (cancelled) return
        setPdfLoading(false)
        setPdfError(error instanceof Error ? error.message : 'Unable to load PDF preview')
      }
    }

    void loadPdf()

    return () => {
      cancelled = true
      pdfRenderTaskRef.current.forEach((task) => task?.cancel?.())
      pdfRenderTaskRef.current = []
      pdfDocumentRef.current?.destroy?.()
      pdfDocumentRef.current = null
    }
  }, [book.fileUrl, fileUrl, format])

  useEffect(() => {
    let cancelled = false
    const pdfDocument = pdfDocumentRef.current
    if (format !== 'pdf' || !pdfDocument || !pdfPagesHost || !pdfPageCount) return undefined
    const pagesHost = pdfPagesHost

    async function renderPdfPages() {
      setPdfLoading(true)
      pdfRenderTaskRef.current.forEach((task) => task?.cancel?.())
      pdfRenderTaskRef.current = []
      pagesHost.replaceChildren()
      try {
        const containerWidth = pagesHost.clientWidth - 24 || 900
        for (let pageNumber = 1; pageNumber <= pdfPageCount; pageNumber += 1) {
          const page = await pdfDocument.getPage(pageNumber)
          if (cancelled) return
          const baseViewport = page.getViewport({ scale: 1 })
          const fitScale = Math.min(containerWidth / baseViewport.width, 1.5)
          const viewport = page.getViewport({ scale: fitScale * pdfScale })
          const wrapper = document.createElement('div')
          wrapper.className = 'grid scroll-mt-3 gap-2 justify-items-center'
          wrapper.dataset.pdfPage = String(pageNumber)
          const label = document.createElement('span')
          label.className = 'text-xs font-bold text-[#66746b]'
          label.textContent = `Page ${pageNumber}`
          const canvas = document.createElement('canvas')
          canvas.className = 'block max-w-none bg-white shadow-[0_4px_22px_rgba(16,35,28,.18)]'
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Unable to render PDF preview')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          wrapper.append(label, canvas)
          pagesHost.append(wrapper)
          const renderTask = page.render({ canvasContext: context, viewport })
          pdfRenderTaskRef.current.push(renderTask)
          await renderTask.promise
        }
        if (!cancelled) {
          setPdfLoading(false)
          setPdfError(null)
        }
      } catch (error) {
        if (cancelled || error instanceof Error && error.name === 'RenderingCancelledException') return
        setPdfLoading(false)
        setPdfError(error instanceof Error ? error.message : 'Unable to render PDF preview')
      }
    }

    void renderPdfPages()

    return () => {
      cancelled = true
      pdfRenderTaskRef.current.forEach((task) => task?.cancel?.())
      pdfRenderTaskRef.current = []
    }
  }, [format, pdfPagesHost, pdfPageCount, pdfScale])

  useEffect(() => {
    if (format !== 'pdf' || !pdfPagesHost) return undefined
    const pagesHost = pdfPagesHost

    function updateCurrentPage() {
      const pages = Array.from(pagesHost.querySelectorAll<HTMLElement>('[data-pdf-page]'))
      const current = pages.reduce((closest, page) => {
        const distance = Math.abs(page.offsetTop - pagesHost.scrollTop)
        return distance < closest.distance ? { page, distance } : closest
      }, { page: pages[0], distance: Number.POSITIVE_INFINITY })
      const pageNumber = Number(current.page?.dataset.pdfPage)
      if (pageNumber) setCurrentPdfPage(pageNumber)
    }

    pagesHost.addEventListener('scroll', updateCurrentPage, { passive: true })
    updateCurrentPage()
    return () => pagesHost.removeEventListener('scroll', updateCurrentPage)
  }, [format, pdfPagesHost, pdfPageCount, pdfScale])

  function scrollToPdfPage(pageNumber: number) {
    setCurrentPdfPage(pageNumber)
    pdfPagesHost?.querySelector<HTMLElement>(`[data-pdf-page="${pageNumber}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="grid gap-3 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold leading-tight tracking-normal text-[#17211b]">Reader preview</h2>
        {book.fileUrl && format !== 'pdf' && <a className="inline-flex items-center gap-[7px] font-bold text-[#1f6f4a]" href={fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open file</a>}
      </div>
      {format === 'epub' && book.fileUrl && (
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] px-3 py-2 text-sm font-semibold text-[#344239]">
            <div className="flex items-center gap-2">
              <button className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#c8d0c8] bg-white px-3 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={readerPages.length === 0} onClick={() => setEpubSidebarOpen((open) => !open)}>{epubSidebarOpen ? 'Hide pages' : 'Show pages'}</button>
              <span>{readerPages.length ? `${readerPages.length} pages` : 'Loading EPUB reader...'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#c8d0c8] bg-white px-3 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={!readerReady} onClick={() => renditionRef.current?.prev()}>Previous</button>
              <button className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#c8d0c8] bg-white px-3 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={!readerReady} onClick={() => renditionRef.current?.next()}>Next</button>
            </div>
          </div>
          {readerLoading && <div className="grid gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3 font-semibold text-[#344239]"><span>Loading EPUB reader...</span></div>}
          {readerError && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{readerError}</div>}
          <div className={epubSidebarOpen ? 'grid grid-cols-[180px_minmax(0,1fr)] gap-2.5 max-[720px]:grid-cols-1' : 'grid'}>
            {epubSidebarOpen && (
              <aside className="h-[min(64vh,720px)] overflow-auto rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-2">
                <div className="grid gap-1">
                  {readerPages.map((page, index) => {
                    const active = currentPageHref === page.href
                    return (
                      <button className={active ? 'rounded-md bg-[#dcebe2] px-2 py-1.5 text-left text-sm font-bold text-[#1f6f4a]' : 'rounded-md px-2 py-1.5 text-left text-sm font-semibold text-[#344239] hover:bg-[#edf0eb]'} key={`${page.href}-${index}`} type="button" onClick={() => {
                        setCurrentPageHref(page.href)
                        renditionRef.current?.display(page.href)
                      }}>{page.label}</button>
                    )
                  })}
                </div>
              </aside>
            )}
            <div className="h-[min(64vh,720px)] w-full overflow-x-hidden overflow-y-auto rounded-lg border border-[#dfe3dc] bg-white [&_.epub-container]:!overflow-x-hidden [&_.epub-container]:!overflow-y-auto" ref={setReaderHost} />
          </div>
        </div>
      )}
      {format === 'pdf' && book.fileUrl && (
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] px-3 py-2 text-sm font-semibold text-[#344239]">
            <div className="flex items-center gap-2">
              <button className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#c8d0c8] bg-white px-3 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={!pdfPageCount} onClick={() => setPdfSidebarOpen((open) => !open)}>{pdfSidebarOpen ? 'Hide pages' : 'Show pages'}</button>
              <span>{pdfPageCount ? `${pdfPageCount} pages` : 'Loading PDF reader...'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#c8d0c8] bg-white px-3 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={pdfScale <= 0.75 || pdfLoading} onClick={() => setPdfScale((scale) => Math.max(scale - 0.25, 0.75))}>Zoom out</button>
              <span className="min-w-12 text-center">{Math.round(pdfScale * 100)}%</span>
              <button className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#c8d0c8] bg-white px-3 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={pdfScale >= 2 || pdfLoading} onClick={() => setPdfScale((scale) => Math.min(scale + 0.25, 2))}>Zoom in</button>
            </div>
          </div>
          {pdfLoading && <div className="grid gap-2 rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-3 font-semibold text-[#344239]"><span>Loading PDF reader...</span></div>}
          {pdfError && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{pdfError}</div>}
          <div className={pdfSidebarOpen ? 'grid grid-cols-[150px_minmax(0,1fr)] gap-2.5 max-[720px]:grid-cols-1' : 'grid'}>
            {pdfSidebarOpen && (
              <aside className="h-[min(64vh,720px)] overflow-auto rounded-lg border border-[#dfe3dc] bg-[#fbfcfa] p-2">
                <div className="grid gap-1">
                  {Array.from({ length: pdfPageCount }, (_, index) => {
                    const pageNumber = index + 1
                    const active = currentPdfPage === pageNumber
                    return (
                      <button className={active ? 'rounded-md bg-[#dcebe2] px-2 py-1.5 text-left text-sm font-bold text-[#1f6f4a]' : 'rounded-md px-2 py-1.5 text-left text-sm font-semibold text-[#344239] hover:bg-[#edf0eb]'} key={pageNumber} type="button" onClick={() => scrollToPdfPage(pageNumber)}>Page {pageNumber}</button>
                    )
                  })}
                </div>
              </aside>
            )}
            <div className="grid h-[min(64vh,720px)] w-full content-start gap-5 overflow-auto rounded-lg border border-[#dfe3dc] bg-white p-3 text-center" ref={setPdfPagesHost} />
          </div>
        </div>
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
