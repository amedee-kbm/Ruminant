import { dataUrlToBlob } from './fileUtils'
import supabase from '../supabaseClient'

// Strip host, fragment and leading slashes; decode and lowercase
const normalizeLocator = (href = '') =>
  decodeURIComponent(
    href
      .split('#')[0]
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/+/, '')
  )
    .trim()
    .toLowerCase()

/**
 * Uploads a cover image to the covers bucket (first path segment must be the user id)
 * @returns {Promise<{path: string, url: string}>} - Storage path and public URL
 */
const uploadCover = async (coverBlob, userId, timestamp) => {
  const coverExt = coverBlob.type?.split('/')[1] || 'jpg'
  const coverPath = `${userId}/${timestamp}-cover.${coverExt}`

  const { error } = await supabase.storage.from('covers').upload(coverPath, coverBlob, {
    upsert: true,
    contentType: coverBlob.type || 'image/jpeg',
  })
  if (error) throw new Error(error.message)

  return {
    path: coverPath,
    url: supabase.storage.from('covers').getPublicUrl(coverPath).data.publicUrl,
  }
}

// Best effort: don't leave a cover in storage that no book record points to
const removeCover = async (coverPath) => {
  const { error } = await supabase.storage.from('covers').remove([coverPath])
  if (error) console.warn('Could not clean up cover:', error)
}

/**
 * Seeds the chapters table. Upserts on (book_id, locator_normalized) when that constraint
 * exists; falls back to a plain insert (e.g. when two TOC entries share a file).
 * @returns {Promise<boolean>} - Whether the chapters were saved
 */
const saveChapters = async (chapters, bookId, userId) => {
  const rows = chapters.map((chapter, index) => {
    const locator = chapter.href || `chapter-${index}`
    return {
      book_id: bookId,
      chapter_index: index,
      title: chapter.title || `Chapter ${index + 1}`,
      locator,
      locator_normalized: normalizeLocator(locator),
      user_id: userId,
      markdown_content: null,
    }
  })

  const { error: upsertError } = await supabase
    .from('chapters')
    .upsert(rows, { onConflict: 'book_id,locator_normalized' })
  if (!upsertError) return true

  console.warn('Upserting chapters failed, falling back to insert:', upsertError)
  const { error: insertError } = await supabase.from('chapters').insert(rows)
  if (!insertError) return true

  // Last resort for databases without the locator_normalized column
  console.warn('Inserting chapters failed, retrying without locator_normalized:', insertError)
  const legacyRows = rows.map((row) => {
    const { locator_normalized, ...rest } = row // eslint-disable-line no-unused-vars
    return rest
  })
  const { error: legacyError } = await supabase.from('chapters').insert(legacyRows)
  if (!legacyError) return true

  console.error('Saving chapters failed:', legacyError)
  return false
}

/**
 * Creates a book and its chapters
 * @param {{title: string, author?: string, coverUrl?: string, chapters: {title: string, href?: string}[]}} book
 * @returns {Promise<{id: string, title: string, chaptersSaved: boolean}>}
 * @throws {Error} - If the book record can't be created
 */
export const createBook = async ({ title, author, coverUrl, chapters }, userId) => {
  if (!userId) {
    throw new Error('You must be signed in to add a book.')
  }

  const { data: book, error } = await supabase
    .from('books')
    .insert({
      user_id: userId,
      title,
      author: author || null,
      cover_url: coverUrl ?? null,
    })
    .select('id, title')
    .single()
  if (error) throw new Error(error.message)

  const chaptersSaved = chapters.length ? await saveChapters(chapters, book.id, userId) : true
  return { ...book, chaptersSaved }
}

/**
 * Imports a book's title, author, cover and chapter list from an EPUB.
 * The EPUB itself isn't stored: Ruminant is for reflecting, not reading.
 * @returns {Promise<{id: string, title: string, chaptersSaved: boolean}>}
 * @throws {Error} - If the import fails
 */
export const importEpub = async (file, userId) => {
  // epub.js is only needed once a file is picked, so keep it out of the library page bundle
  const { extractEpubData } = await import('./epubService')
  const data = await extractEpubData(file)

  let cover = null
  if (data.cover) {
    try {
      cover = await uploadCover(await dataUrlToBlob(data.cover), userId, Date.now())
    } catch (err) {
      // A missing cover shouldn't block the import
      console.warn('Cover upload failed:', err)
    }
  }

  try {
    return await createBook(
      {
        title: data.title || file.name.replace(/\.epub$/i, ''),
        author: data.author,
        coverUrl: cover?.url,
        chapters: data.chapters,
      },
      userId
    )
  } catch (err) {
    if (cover) await removeCover(cover.path)
    throw err
  }
}
