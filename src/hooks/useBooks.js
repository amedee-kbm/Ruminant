import { useCallback, useEffect, useState } from 'react'
import { fetchBooks } from '../lib/booksApi'

/** The signed-in user's books, newest first */
export const useBooks = (userId) => {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!userId) return
    setError(null)
    try {
      setBooks(await fetchBooks(userId))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { books, loading, error, refetch }
}
