import ePub from 'epubjs'
import { formatTitle } from './formatTitle'

const LOAD_TIMEOUT_MS = 15000

// Whole-word/phrase matches only, so e.g. "Discovery" isn't mistaken for "cover"
const NON_CHAPTER_PATTERN = new RegExp(
  `\\b(${[
    // Front matter
    'title',
    'copyright',
    'dedication',
    'acknowledge?ments?',
    'preface',
    'introduction',
    'foreword',
    '(table of )?contents',
    'toc',
    'cover',
    // Back matter
    'endnotes?',
    'appendix',
    'glossary',
    'index',
    'bibliography',
    'references',
    'about the author',
    'colophon',
  ].join('|')})\\b`,
  'i'
)

const isFrontOrBackMatter = (title) => !!title && NON_CHAPTER_PATTERN.test(title)

// Strip leading numbering such as "1. ", "1.1. ", "Chapter 3: " or "4 "
const cleanTitle = (title) => {
  if (!title) return title
  return title
    .trim()
    .replace(/^(\d+\.)+\s*/, '')
    .replace(/^Chapter\s+\d+[.\s:]+/i, '')
    .replace(/^\d+\s+/, '')
    .trim()
}

const cleanHref = (href) => (href ? href.replace(/\s+/g, '') : null)

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = () => resolve(URL.createObjectURL(blob))
    reader.readAsDataURL(blob)
  })

const extractCover = async (book) => {
  try {
    const url = await book.coverUrl()
    if (url) return url
  } catch (err) {
    console.warn('book.coverUrl() failed, falling back to manifest lookup:', err)
  }

  // manifest is an object keyed by item id, not an array
  const manifestItems = Object.values(book.package.manifest || {})
  const coverItem =
    manifestItems.find((item) => item.properties?.includes('cover-image')) ||
    manifestItems.find(
      (item) =>
        item.type?.startsWith('image/') &&
        (item.href?.toLowerCase().includes('cover') || item.id?.toLowerCase().includes('cover'))
    )
  if (!coverItem) return null

  const blob = await book.archive.getBlob(coverItem.href)
  return blobToDataUrl(blob)
}

const toChapter = (item, fallbackTitle) => {
  const chapter = {
    id: item.id || null,
    title: formatTitle(cleanTitle(item.label)) || fallbackTitle,
    href: cleanHref(item.href),
  }
  if (item.subitems?.length) {
    chapter.subchapters = extractChapters(item.subitems, 'Untitled Subchapter')
  }
  return chapter
}

const extractChapters = (items, fallbackTitle) =>
  items
    .filter((item) => !isFrontOrBackMatter(cleanTitle(item.label)))
    .map((item) => toChapter(item, fallbackTitle))

/**
 * Extracts metadata, cover and chapters from an EPUB file
 * @param {File} file - The EPUB file picked from the browser
 * @returns {Promise<{cover: string|null, title: string, author: string, chapters: Array, rawToc: Array}>}
 *   `cover` is a blob: or data: URL usable directly as an <img> src
 */
export const extractEpubData = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const book = ePub(arrayBuffer)

    await Promise.race([
      book.ready,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('EPUB loading timed out after 15 seconds')),
          LOAD_TIMEOUT_MS
        )
      ),
    ])

    const metadata = book.package.metadata
    const title = metadata.title || 'Untitled'
    const author = metadata.creator || 'Unknown Author'

    let cover = null
    try {
      cover = await extractCover(book)
    } catch (err) {
      console.warn('Could not extract cover image:', err)
    }

    const toc = book.navigation?.toc || []
    // A single wrapper entry (e.g. the book title) usually holds the real chapters
    const topLevel = toc.length === 1 && toc[0].subitems?.length ? toc[0].subitems : toc
    const chapters = extractChapters(topLevel, 'Untitled Chapter')

    return { cover, title, author, chapters, rawToc: toc }
  } catch (error) {
    console.error('Error extracting EPUB data:', error)
    throw new Error(`Failed to extract EPUB data: ${error.message}`)
  }
}
