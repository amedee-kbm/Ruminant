import { useCallback, useEffect, useState } from 'react'
import { fetchBook, updateBook } from '../lib/booksApi'
import { getSampleBook, isSampleId, updateSampleBook } from '../lib/sampleBooks'

// Sample books need no account and are only changed in memory
const loadBook = async (bookId, userId) =>
  isSampleId(bookId) ? getSampleBook(bookId) : fetchBook(bookId, userId)

const storeBook = async (bookId, userId, fields) =>
  isSampleId(bookId) ? updateSampleBook(bookId, fields) : updateBook(bookId, userId, fields)

/** Loads a book record and saves changes to its details */
export const useBook = (bookId, userId) => {
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bookId || (!userId && !isSampleId(bookId))) return
    let active = true

    setLoading(true)
    loadBook(bookId, userId)
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
      await storeBook(bookId, userId, fields)
      setBook((prev) => ({ ...prev, ...fields }))
    },
    [bookId, userId]
  )

  const updateBookLocally = useCallback((fields) => {
    setBook((prev) => ({ ...prev, ...fields }))
  }, [])

  /** Saves fields already applied locally (e.g. while typing). @throws on failure */
  const saveBookFields = useCallback(
    (fields) => storeBook(bookId, userId, fields),
    [bookId, userId]
  )

  return { book, loading, saveDetails, updateBookLocally, saveBookFields }
}
