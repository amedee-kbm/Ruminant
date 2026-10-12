import supabase from '../supabaseClient'

/**
 * Row-level security hides rows instead of rejecting the request, so a blocked update or
 * delete "succeeds" having changed nothing. Ask for the affected ids and treat none as failure.
 */
const expectRows = ({ data, error }, action) => {
  if (error) throw error
  if (!data?.length) {
    throw new Error(
      `The database didn't allow you to ${action}. Check the row-level security policies.`
    )
  }
  return data
}

// Every query is scoped to the user as well as relying on row-level security

/** Books with each chapter's takeaway, so the library can show progress */
export const fetchBooks = async (userId) => {
  const { data, error } = await supabase
    .from('books')
    .select('*, chapters(markdown_content)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const fetchBook = async (bookId, userId) => {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export const fetchChapters = async (bookId, userId) => {
  const { data, error } = await supabase
    .from('chapters')
    .select('id,title,chapter_index,locator,markdown_content')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .order('chapter_index', { ascending: true })
  if (error) throw error
  return data
}

export const updateChapter = async (chapterId, userId, fields) => {
  const result = await supabase
    .from('chapters')
    .update(fields)
    .eq('id', chapterId)
    .eq('user_id', userId)
    .select('id')
  expectRows(result, 'save this chapter')
}

export const updateBook = async (bookId, userId, fields) => {
  const result = await supabase
    .from('books')
    .update(fields)
    .eq('id', bookId)
    .eq('user_id', userId)
    .select('id')
  expectRows(result, 'edit this book')
}

// Public cover URLs end in /object/public/covers/<path>
const coverPathFromUrl = (url) => url?.split('/object/public/covers/')[1]

/** Deletes a book (its chapters cascade) and, best effort, its cover image */
export const deleteBook = async (book, userId) => {
  const result = await supabase
    .from('books')
    .delete()
    .eq('id', book.id)
    .eq('user_id', userId)
    .select('id')
  expectRows(result, 'delete this book')

  const coverPath = coverPathFromUrl(book.cover_url)
  if (coverPath) {
    const { error: coverError } = await supabase.storage
      .from('covers')
      .remove([decodeURIComponent(coverPath)])
    if (coverError) console.warn('Could not delete cover:', coverError)
  }
}

// Above any real chapter_index, so reordering never collides with (book_id, chapter_index)
const TEMP_INDEX_OFFSET = 1_000_000

/**
 * Saves an edited chapter list: removes chapters left out of `edited`, renames and reorders
 * the rest, and inserts entries without an id. Notes are untouched.
 * @param {{id: string, locator: string}[]} original - Chapters as loaded
 * @param {{id?: string, title: string}[]} edited - The new list, in order
 */
export const saveChapterList = async (bookId, userId, original, edited) => {
  const keptIds = new Set(edited.filter((c) => c.id).map((c) => c.id))
  const deletedIds = original.filter((c) => !keptIds.has(c.id)).map((c) => c.id)
  const locators = new Map(original.map((c) => [c.id, c.locator]))

  if (deletedIds.length) {
    const result = await supabase
      .from('chapters')
      .delete()
      .in('id', deletedIds)
      .eq('user_id', userId)
      .select('id')
    expectRows(result, 'remove chapters')
  }

  const rows = edited.map((c, index) => ({ ...c, chapter_index: index }))
  const existing = rows
    .filter((c) => c.id)
    .map((c) => ({
      id: c.id,
      book_id: bookId,
      user_id: userId,
      title: c.title,
      locator: locators.get(c.id),
      chapter_index: c.chapter_index,
    }))

  // Indices are unique per book, so park every chapter out of the way before renumbering
  for (const offset of [TEMP_INDEX_OFFSET, 0]) {
    if (!existing.length) break
    const { error } = await supabase
      .from('chapters')
      .upsert(existing.map((c) => ({ ...c, chapter_index: c.chapter_index + offset })))
    if (error) throw error
  }

  const added = rows
    .filter((c) => !c.id)
    .map((c) => ({
      book_id: bookId,
      user_id: userId,
      title: c.title,
      chapter_index: c.chapter_index,
      locator: `manual-${crypto.randomUUID()}`,
    }))
  if (added.length) {
    const { error } = await supabase.from('chapters').insert(added)
    if (error) throw error
  }
}
