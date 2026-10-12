import { useCallback, useEffect, useState } from 'react'
import { fetchBook, updateBook } from '../lib/booksApi'

/** Loads a book record and saves changes to its details */
export const useBook = (bookId, userId) => {
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bookId || !userId) return
    let active = true

    setLoading(true)
    fetchBook(bookId, userId)
      .catch((err) => {
        console.error('Error loading book:', err)
        return null
      })
      .then((data) => {
        if (!active) return
        setBook(data)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [bookId, userId])

  /** @throws if the database update fails */
  const saveDetails = useCallback(
    async (fields) => {
      await updateBook(bookId, userId, fields)
      setBook((prev) => ({ ...prev, ...fields }))
    },
    [bookId, userId]
  )

  const updateBookLocally = useCallback((fields) => {
    setBook((prev) => ({ ...prev, ...fields }))
  }, [])

  /** Saves fields already applied locally (e.g. while typing). @throws on failure */
  const saveBookFields = useCallback(
    (fields) => updateBook(bookId, userId, fields),
    [bookId, userId]
  )

  return { book, loading, saveDetails, updateBookLocally, saveBookFields }
}
