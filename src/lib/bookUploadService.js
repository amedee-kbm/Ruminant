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
  
  const { error: coverError } = await supabase.storage
    .from('covers')
    .upload(coverPath, coverBlob, {
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

  const safeName = sanitizeFileName(file.name, 'epub')
  const timestamp = Date.now()

  // 2) Upload EPUB to storage (books bucket)
  const epubPath = `${userId}/${timestamp}-${safeName}`
  const { error: epubError } = await supabase.storage
    .from('books')
    .upload(epubPath, file, {
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
    throw new Error(insertError.message)
  }

  const bookId = insertedBook.id

  // 5) Insert chapters into database if they exist
  if (data.chapters && data.chapters.length > 0) {
    const chaptersToInsert = data.chapters.map((chapter, index) => ({
      book_id: bookId,
      chapter_index: index,
      title: chapter.title || `Chapter ${index + 1}`,
      locator: chapter.href || `chapter-${index}`,
      user_id: userId,
    }))

    const { error: chaptersError } = await supabase
      .from('chapters')
      .insert(chaptersToInsert)

    if (chaptersError) {
      console.warn('Error inserting chapters:', chaptersError)
      // Don't throw - book upload succeeded, chapters can be added later
    } else {
      console.log(`Inserted ${chaptersToInsert.length} chapters for book ${bookId}`)
    }
  }

  return {
    title: data?.title || file.name,
    message: `Imported "${data?.title || file.name}"`,
  }
}

