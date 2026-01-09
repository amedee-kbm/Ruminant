import { extractEpubData } from './epubService'
import { dataUrlToBlob, sanitizeFileName } from './fileUtils'
import supabase from '../supabaseClient'

/**
 * Uploads a cover image to Supabase storage and returns the URL
 * @param {Blob} coverBlob - The cover image blob
 * @param {string} userId - The user ID
 * @param {number} timestamp - Timestamp for unique file naming
 * @returns {Promise<string|null>} - The cover URL or null if upload fails
 */
const uploadCover = async (coverBlob, userId, timestamp) => {
  const coverExt = coverBlob.type?.split('/')[1] || 'jpg'
  const coverPath = `${userId}/${timestamp}-cover.${coverExt}`

  const { error: coverError } = await supabase.storage.from('covers').upload(coverPath, coverBlob, {
    upsert: true,
    contentType: coverBlob.type || 'image/jpeg',
  })

  if (coverError) {
    throw new Error(coverError.message)
  }

  // Try to get public URL first (works if bucket is public)
  const { data: publicUrlData } = supabase.storage.from('covers').getPublicUrl(coverPath)
  let coverUrl = publicUrlData?.publicUrl || null

  // If public URL doesn't work, try signed URL (works for private buckets)
  // Signed URLs expire after the specified seconds (here: 1 year = 31536000)
  if (!coverUrl) {
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from('covers')
      .createSignedUrl(coverPath, 31536000) // 1 year expiry
    if (!signedError && signedUrlData?.signedUrl) {
      coverUrl = signedUrlData.signedUrl
    } else {
      console.error('Failed to generate cover URL:', signedError)
    }
  }

  console.log('Cover URL generated:', coverUrl)
  return coverUrl
}

/**
 * Uploads an EPUB file and its metadata to Supabase
 * @param {File} file - The EPUB file to upload
 * @param {string} userId - The user ID
 * @returns {Promise<{title: string, message: string}>} - Success message with book title
 * @throws {Error} - If upload fails
 */
export const uploadBook = async (file, userId) => {
  if (!userId) {
    throw new Error('You must be signed in to upload a book.')
  }

  // 1) Parse EPUB to get metadata + cover
  const data = await extractEpubData(file)
  console.log('📖 EPUB extracted data:', {
    title: data?.title,
    author: data?.author,
    hasCover: !!data?.cover,
    chapterCount: data?.chapters?.length || 0,
  })

  const safeName = sanitizeFileName(file.name, 'epub')
  const timestamp = Date.now()

  // 2) Upload EPUB to storage (books bucket)
  const epubPath = `${userId}/${timestamp}-${safeName}`
  const { error: epubError } = await supabase.storage.from('books').upload(epubPath, file, {
    upsert: true,
    contentType: file.type || 'application/epub+zip',
  })

  if (epubError) {
    throw new Error(epubError.message)
  }

  // 3) Upload cover to covers bucket (respecting policy: first segment is user id)
  let coverUrl = null
  if (data.cover) {
    const coverBlob = await dataUrlToBlob(data.cover)
    coverUrl = await uploadCover(coverBlob, userId, timestamp)
  }

  // 4) Save book record and get the inserted book ID
  const { data: insertedBook, error: insertError } = await supabase
    .from('books')
    .insert({
      user_id: userId,
      title: data.title || file.name,
      author: data.author || 'Unknown author',
      epub_path: epubPath,
      cover_url: coverUrl,
    })
    .select()
    .single()

  if (insertError) {
    console.error('❌ Failed to insert book record:', insertError)
    throw new Error(insertError.message)
  }

  // Handle case where RLS blocks RETURNING clause (insert succeeds but select returns null)
  let bookId = null
  let bookTitle = data.title || file.name

  if (insertedBook && insertedBook.id) {
    bookId = insertedBook.id
    bookTitle = insertedBook.title
    console.log('✅ Inserted book record:', { bookId, title: bookTitle, userId })
  } else {
    // RLS blocked RETURNING - try to fetch the book we just inserted
    console.warn('⚠️ Book insert succeeded but RETURNING was blocked by RLS. Attempting to re-fetch...')
    try {
      const { data: fetchedBook, error: fetchError } = await supabase
        .from('books')
        .select('id, title')
        .eq('user_id', userId)
        .eq('epub_path', epubPath)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!fetchError && fetchedBook) {
        bookId = fetchedBook.id
        bookTitle = fetchedBook.title
        console.log('✅ Re-fetched book record:', { bookId, title: bookTitle, userId })
      } else {
        console.warn('⚠️ Could not re-fetch book after insert:', { fetchError, fetchedBook })
      }
    } catch (fetchErr) {
      console.warn('⚠️ Exception while re-fetching book:', fetchErr)
    }
  }

  // 5) Return chapters so the UI can let the user choose which ones to save
  return {
    title: bookTitle,
    message: `Imported "${bookTitle}"`,
    bookId, // may be null if RLS blocks both RETURNING and re-fetch
    chapters: data.chapters || [],
  }
}

/**
 * Saves a selected set of chapters for a given book to the database.
 * The caller is responsible for deciding which chapters to include.
 *
 * @param {string} bookId
 * @param {Array<{ title?: string, href?: string }>} chapters
 * @param {string} userId
 */
export const saveChaptersForBook = async (bookId, chapters, userId) => {
  if (!bookId || !userId) {
    console.warn('saveChaptersForBook called without bookId or userId', { bookId, userId })
    return
  }

  if (!chapters || chapters.length === 0) {
    console.log('saveChaptersForBook called with no chapters, skipping insert', { bookId, userId })
    return
  }

  // Normalize locator: strip host, fragment, leading slashes, decode and lowercase
  const normalizeLocator = (href = '') =>
    decodeURIComponent(
      (href || '')
        .split('#')[0]
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/+/, '')
    )
      .trim()
      .toLowerCase()

  const chaptersToInsert = chapters.map((chapter, index) => {
    const locator = chapter.href || `chapter-${index}`
    const normalized = normalizeLocator(locator)
    return {
      book_id: bookId,
      chapter_index: index,
      title: chapter.title || `Chapter ${index + 1}`,
      locator,
      locator_normalized: normalized,
      user_id: userId,
      markdown_content: null,
      pre_questions: [],
    }
  })

  console.log('📝 Saving selected chapters for book:', {
    bookId,
    userId,
    chapterCount: chaptersToInsert.length,
    sample: chaptersToInsert.slice(0, 5),
  })

  try {
    const { error: upsertError } = await supabase
      .from('chapters')
      .upsert(chaptersToInsert, { onConflict: ['book_id', 'locator_normalized'] })

    if (upsertError) {
      console.warn('Upsert chapters error, falling back to insert:', upsertError)

      const fallbackRows = chaptersToInsert.map(
        ({ book_id, chapter_index, title, locator, user_id, markdown_content }) => ({
          book_id,
          chapter_index,
          title,
          locator,
          user_id,
          markdown_content,
        })
      )

      const { error: insertError } = await supabase.from('chapters').insert(chaptersToInsert)
      if (insertError) {
        console.warn('Error inserting chapters with extended fields:', insertError)

        try {
          const { error: fallbackError } = await supabase.from('chapters').insert(fallbackRows)
          if (fallbackError) {
            console.warn('Fallback insert also failed:', fallbackError)
          } else {
            console.log(`Inserted ${fallbackRows.length} chapters (fallback) for book ${bookId}`)
          }
        } catch (fallbackErr) {
          console.warn('Unexpected error during fallback insert:', fallbackErr)
        }
      } else {
        console.log(`Inserted ${chaptersToInsert.length} chapters for book ${bookId}`)
      }
    } else {
      console.log(`Upserted/updated ${chaptersToInsert.length} chapters for book ${bookId}`)
    }
  } catch (err) {
    console.warn('Unexpected error upserting/inserting chapters:', err)
  }
}
