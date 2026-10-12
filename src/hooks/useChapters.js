import { useCallback, useEffect, useState } from 'react'
import { fetchChapters, saveChapterList, updateChapter } from '../lib/booksApi'

/** A book's chapters, updated locally as the user types and saved separately */
export const useChapters = (bookId, userId) => {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!bookId || !userId) return
    try {
      setChapters(await fetchChapters(bookId, userId))
    } catch (err) {
      console.error('Error fetching chapters:', err)
    } finally {
      setLoading(false)
    }
  }, [bookId, userId])

  useEffect(() => {
    reload()
  }, [reload])

  const updateChapterLocally = useCallback((chapterId, fields) => {
    setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, ...fields } : c)))
  }, [])

  /** @throws if the database update fails */
  const saveChapter = useCallback(
    (chapterId, fields) => updateChapter(chapterId, userId, fields),
    [userId]
  )

  /**
   * Replaces the chapter list (rename, reorder, add, remove), then reloads it.
   * Reloads even on failure, since a partial save may have gone through.
   * @throws if any step fails
   */
  const saveList = async (edited) => {
    try {
      await saveChapterList(bookId, userId, chapters, edited)
    } finally {
      await reload()
    }
  }

  return { chapters, loading, updateChapterLocally, saveChapter, saveList }
}
