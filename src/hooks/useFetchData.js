import { useCallback, useEffect, useState } from 'react'

import supabase from '../supabaseClient'

export const useFetchData = (tableName, options = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase.from(tableName).select('*')

    // Apply ordering if provided
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending !== false })
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
      setData(null)
    } else {
      setData(data)
    }

    setLoading(false)
  }, [tableName, options.orderBy, options.ascending])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
