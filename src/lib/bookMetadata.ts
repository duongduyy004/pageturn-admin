export type BookMetadata = {
  title?: string
  author?: string
  authors?: string[]
  description?: string
  language?: string
  category?: string
}

export type ExtractedCoverImage = {
  file: File
  path: string
}

export type BookMetadataResult = {
  format: 'epub' | 'pdf' | 'unknown'
  metadata: BookMetadata
  missingFields: Array<keyof BookMetadata>
  coverImage?: ExtractedCoverImage
  warning?: string
}

const METADATA_FIELDS: Array<keyof BookMetadata> = ['title', 'author', 'description', 'language', 'category']

const textDecoder = new TextDecoder()
const latinDecoder = new TextDecoder('windows-1252')

export async function extractBookMetadata(file: File): Promise<BookMetadataResult> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'epub' || file.type === 'application/epub+zip') {
    const result = await extractEpubMetadata(file)
    return withMissingFields('epub', result.metadata, undefined, result.coverImage)
  }
  if (extension === 'pdf' || file.type === 'application/pdf') {
    const result = await extractPdfMetadata(file)
    return withMissingFields('pdf', result.metadata, undefined, result.coverImage)
  }

  return withMissingFields('unknown', {}, 'Metadata extraction supports EPUB and PDF files.')
}

function withMissingFields(
  format: BookMetadataResult['format'],
  metadata: BookMetadata,
  warning?: string,
  coverImage?: ExtractedCoverImage,
): BookMetadataResult {
  const authors = normalizeAuthors(metadata.authors ?? metadata.author)
  const cleaned: BookMetadata = {
    title: normalizeText(metadata.title),
    author: authors.length ? authors.join(', ') : normalizeText(metadata.author),
    authors: authors.length ? authors : undefined,
    description: normalizeText(metadata.description),
    language: normalizeText(metadata.language),
    category: normalizeText(metadata.category),
  }
  Object.keys(cleaned).forEach((key) => {
    const value = cleaned[key as keyof BookMetadata]
    if (!value || (Array.isArray(value) && value.length === 0)) delete cleaned[key as keyof BookMetadata]
  })

  return {
    format,
    metadata: cleaned,
    missingFields: METADATA_FIELDS.filter((field) => {
      if (field === 'author') return !cleaned.author && !cleaned.authors?.length
      return !cleaned[field]
    }),
    coverImage,
    warning,
  }
}

async function extractEpubMetadata(file: File): Promise<{ metadata: BookMetadata; coverImage?: ExtractedCoverImage }> {
  const buffer = await file.arrayBuffer()
  return extractEpubPackageMetadata(new Uint8Array(buffer), file.name)
}

async function extractEpubPackageMetadata(
  source: Uint8Array,
  fileName: string,
): Promise<{ metadata: BookMetadata; coverImage?: ExtractedCoverImage }> {
  const entries = readZipEntries(source)
  const container = await readZipText(entries, 'META-INF/container.xml')
  const opfPath = getXmlAttribute(container, 'rootfile', 'full-path')
  const opf = opfPath ? await readZipText(entries, opfPath) : ''

  if (!opf) {
    return { metadata: {} }
  }

  const allAuthors = readEpubAuthors(opf)
  return {
    metadata: {
      title: readXmlTag(opf, 'title'),
      authors: allAuthors,
      description: readXmlTag(opf, 'description'),
      language: readXmlTag(opf, 'language'),
      category: readXmlTag(opf, 'subject'),
    },
    coverImage: await extractEpubCover(entries, opf, opfPath, fileName),
  }
}

function isUsefulMetadataValue(value?: string) {
  const normalized = normalizeText(value)?.toLowerCase()
  return Boolean(normalized && normalized !== 'unknown' && normalized !== 'anonymous')
}

function normalizeAuthors(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : []
  return uniqueAuthors(values.flatMap((item) => normalizeText(item)?.split(/\s*(?:;|\|)\s*/) ?? []))
}

function uniqueAuthors(authors: Array<string | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  authors.forEach((author) => {
    const normalized = normalizeText(author)
    if (!normalized || !isUsefulMetadataValue(normalized)) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    result.push(normalized)
  })
  return result
}

async function extractEpubCover(
  entries: Map<string, ZipEntry>,
  opf: string,
  opfPath: string,
  bookFileName: string,
): Promise<ExtractedCoverImage | undefined> {
  const coverId = getMetaContent(opf, 'cover')
  const manifestItem = coverId ? getManifestItemById(opf, coverId) : getFirstCoverManifestItem(opf)
  if (!manifestItem) return undefined

  const coverPath = resolveZipPath(opfPath, manifestItem.href)
  const coverBytes = await readZipBytes(entries, coverPath)
  if (!coverBytes) return undefined

  const mimeType = manifestItem.mediaType || mimeTypeFromPath(coverPath)
  if (!mimeType.startsWith('image/')) return undefined

  const extension = extensionFromMimeType(mimeType) || coverPath.split('.').pop() || 'jpg'
  const baseName = bookFileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'cover'
  const buffer = Uint8Array.from(coverBytes).buffer as ArrayBuffer
  return {
    file: new File([buffer], baseName + '-cover.' + extension, { type: mimeType }),
    path: coverPath,
  }
}

async function extractPdfMetadata(file: File): Promise<{ metadata: BookMetadata; coverImage?: ExtractedCoverImage }> {
  const [pdfjsResult, rawMetadata] = await Promise.all([
    extractPdfJsMetadata(file).catch(() => ({ metadata: {} as BookMetadata, coverImage: undefined as ExtractedCoverImage | undefined })),
    extractRawPdfMetadata(file),
  ])

  return {
    metadata: {
      title: pdfjsResult.metadata.title || rawMetadata.title,
      author: pdfjsResult.metadata.author || rawMetadata.author,
      description: pdfjsResult.metadata.description || rawMetadata.description,
      category: pdfjsResult.metadata.category || rawMetadata.category,
      language: pdfjsResult.metadata.language || rawMetadata.language,
    },
    coverImage: pdfjsResult.coverImage,
  }
}

async function extractPdfJsMetadata(file: File): Promise<{ metadata: BookMetadata; coverImage?: ExtractedCoverImage }> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
  const buffer = await file.arrayBuffer()
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  const result = await document.getMetadata()
  const coverImage = await renderPdfFirstPageCover(document, file.name)
  await document.destroy()

  const info = result.info as Record<string, unknown>
  const xmp = result.metadata
  return {
    metadata: {
      title: readPdfJsInfoField(info, 'Title') || readPdfJsMetadataField(xmp, 'dc:title'),
      author: readPdfJsInfoField(info, 'Author') || readPdfJsMetadataField(xmp, 'dc:creator') || readPdfJsInfoField(info, 'Creator'),
      description: readPdfJsInfoField(info, 'Subject') || readPdfJsMetadataField(xmp, 'dc:description'),
      category: readPdfJsInfoField(info, 'Keywords') || readPdfJsMetadataField(xmp, 'pdf:Keywords'),
      language: readPdfJsMetadataField(xmp, 'dc:language'),
    },
    coverImage,
  }
}

async function renderPdfFirstPageCover(document: { getPage: (pageNumber: number) => Promise<any> }, fileName: string): Promise<ExtractedCoverImage | undefined> {
  const page = await document.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const targetWidth = 600
  const scale = Math.min(targetWidth / viewport.width, 2)
  const scaledViewport = page.getViewport({ scale })
  const canvas = window.document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return undefined

  canvas.width = Math.ceil(scaledViewport.width)
  canvas.height = Math.ceil(scaledViewport.height)
  await page.render({ canvasContext: context, viewport: scaledViewport }).promise

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) return undefined

  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'cover'
  return {
    file: new File([blob], baseName + '-cover.jpg', { type: 'image/jpeg' }),
    path: 'page-1',
  }
}

async function extractRawPdfMetadata(file: File): Promise<BookMetadata> {
  const sampleBytes = 1024 * 1024
  const firstChunk = await file.slice(0, sampleBytes).arrayBuffer()
  const lastChunk = file.size > sampleBytes
    ? await file.slice(Math.max(file.size - sampleBytes, 0), file.size).arrayBuffer()
    : new ArrayBuffer(0)
  const text = latinDecoder.decode(firstChunk) + '\n' + latinDecoder.decode(lastChunk)

  return {
    title: readPdfInfoField(text, 'Title') || readXmpTag(text, 'dc:title'),
    author: readPdfInfoField(text, 'Author') || readXmpTag(text, 'dc:creator') || readPdfInfoField(text, 'Creator'),
    description: readPdfInfoField(text, 'Subject') || readXmpTag(text, 'dc:description'),
    category: readPdfInfoField(text, 'Keywords') || readXmpTag(text, 'pdf:Keywords'),
    language: readXmpTag(text, 'dc:language'),
  }
}

function readPdfJsInfoField(info: Record<string, unknown>, key: string) {
  const value = info[key]
  return typeof value === 'string' ? value : undefined
}

function readPdfJsMetadataField(metadata: { get: (name: string) => string | null } | null, key: string) {
  return metadata?.get(key) ?? undefined
}

type ZipEntry = {
  name: string
  compressionMethod: number
  compressedSize: number
  uncompressedSize: number
  dataOffset: number
  source: Uint8Array
}

type ManifestItem = {
  id: string
  href: string
  mediaType: string
}

function readZipEntries(source: Uint8Array) {
  const entries = new Map<string, ZipEntry>()
  const endOffset = findEndOfCentralDirectory(source)
  if (endOffset < 0) return entries

  const view = new DataView(source.buffer, source.byteOffset, source.byteLength)
  const centralDirectorySize = view.getUint32(endOffset + 12, true)
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true)
  let offset = centralDirectoryOffset
  const end = centralDirectoryOffset + centralDirectorySize

  while (offset < end && view.getUint32(offset, true) === 0x02014b50) {
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const name = textDecoder.decode(source.subarray(offset + 46, offset + 46 + fileNameLength))
    const localNameLength = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength

    entries.set(name, { name, compressionMethod, compressedSize, uncompressedSize, dataOffset, source })
    offset += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function findEndOfCentralDirectory(source: Uint8Array) {
  for (let offset = source.length - 22; offset >= Math.max(0, source.length - 65557); offset -= 1) {
    if (
      source[offset] === 0x50 &&
      source[offset + 1] === 0x4b &&
      source[offset + 2] === 0x05 &&
      source[offset + 3] === 0x06
    ) {
      return offset
    }
  }
  return -1
}

async function readZipText(entries: Map<string, ZipEntry>, name: string) {
  const bytes = await readZipBytes(entries, name)
  return bytes ? textDecoder.decode(bytes) : ''
}

async function readZipBytes(entries: Map<string, ZipEntry>, name: string) {
  const entry = entries.get(name)
  if (!entry) return null

  const compressed = entry.source.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize)
  if (entry.compressionMethod === 0) {
    return compressed
  }
  if (entry.compressionMethod !== 8) {
    return null
  }

  const compressedBuffer = Uint8Array.from(compressed).buffer as ArrayBuffer
  const stream = new Blob([compressedBuffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const inflated = await new Response(stream).arrayBuffer()
  const content = new Uint8Array(inflated)
  return content.subarray(0, entry.uncompressedSize || content.length)
}

function readEpubAuthors(opf: string) {
  const creators = (opf.match(/<(?:[\w-]+:)?creator(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w-]+:)?creator>/gi) ?? [])
    .map((tag) => {
      const name = decodeXml(tag.replace(/<[^>]+>/g, ' '))
      return normalizeText(name)
    })
    .filter((name): name is string => isUsefulMetadataValue(name))

  return uniqueAuthors(creators)
}

function readXmlTag(xml: string, tagName: string) {
  const match = xml.match(new RegExp('<(?:[\\w-]+:)?' + tagName + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?' + tagName + '>', 'i'))
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, ' ')) : ''
}

function readXmpTag(text: string, tagName: string) {
  const escaped = tagName.replace(':', '\\:')
  const direct = text.match(new RegExp('<' + escaped + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + escaped + '>', 'i'))
  if (direct) return decodeXml(direct[1].replace(/<[^>]+>/g, ' '))

  const bag = text.match(new RegExp('<' + escaped + '[\\s\\S]*?<rdf:li(?:\\s[^>]*)?>([\\s\\S]*?)</rdf:li>[\\s\\S]*?</' + escaped + '>', 'i'))
  return bag ? decodeXml(bag[1].replace(/<[^>]+>/g, ' ')) : ''
}

function getXmlAttribute(xml: string, tagName: string, attributeName: string) {
  const tag = xml.match(new RegExp('<(?:[\\w-]+:)?' + tagName + '\\s[^>]*>', 'i'))?.[0] ?? ''
  return decodeXml(tag.match(new RegExp(attributeName + "=[\"']([^\"']+)[\"']", 'i'))?.[1] ?? '')
}

function getMetaContent(xml: string, name: string) {
  const metaTags = xml.match(/<meta\s[^>]*>/gi) ?? []
  const tag = metaTags.find((item) => getAttribute(item, 'name').toLowerCase() === name.toLowerCase())
  return tag ? getAttribute(tag, 'content') : ''
}

function getManifestItemById(xml: string, id: string) {
  return getManifestItems(xml).find((item) => item.id === id)
}

function getFirstCoverManifestItem(xml: string) {
  return getManifestItems(xml).find((item) => item.id.toLowerCase().includes('cover') && item.mediaType.startsWith('image/'))
}

function getManifestItems(xml: string): ManifestItem[] {
  return (xml.match(/<item\s[^>]*>/gi) ?? [])
    .map((tag) => ({
      id: getAttribute(tag, 'id'),
      href: getAttribute(tag, 'href'),
      mediaType: getAttribute(tag, 'media-type'),
    }))
    .filter((item) => item.id && item.href)
}

function getAttribute(tag: string, attributeName: string) {
  return decodeXml(tag.match(new RegExp(attributeName + "=[\"']([^\"']+)[\"']", 'i'))?.[1] ?? '')
}

function resolveZipPath(opfPath: string, href: string) {
  const opfDirectory = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''
  const parts = (opfDirectory ? opfDirectory + '/' + href : href).split('/')
  const resolved: string[] = []
  parts.forEach((part) => {
    if (!part || part === '.') return
    if (part === '..') resolved.pop()
    else resolved.push(part)
  })
  return resolved.join('/')
}

function mimeTypeFromPath(path: string) {
  const extension = path.split('.').pop()?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'svg') return 'image/svg+xml'
  return 'image/jpeg'
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/svg+xml') return 'svg'
  return ''
}

function readPdfInfoField(text: string, field: string) {
  const match = text.match(new RegExp('/' + field + '\\s*(\\((?:\\\\.|[^\\\\)])*\\)|<([0-9a-fA-F\\s]+)>)'))
  if (!match) return ''
  if (match[2]) return decodePdfHex(match[2])
  return decodePdfLiteral(match[1].slice(1, -1))
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, escape: string) => {
      const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }
      return escapes[escape] ?? escape
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)))
}

function decodePdfHex(value: string) {
  const hex = value.replace(/\s/g, '')
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((pair) => Number.parseInt(pair.padEnd(2, '0'), 16)) ?? [])
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }
  return latinDecoder.decode(bytes)
}

function decodeXml(value: string) {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

function normalizeText(value?: string) {
  return value?.replace(/\s+/g, ' ').trim()
}
