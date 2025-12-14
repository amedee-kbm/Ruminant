import { useEffect, useState } from 'react'

import supabase from '../supabaseClient'

export const useFetchData = (tableName) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.from(tableName).select('*')

      if (error) {
        setError(error.message)
        setData(null)
      } else {
        setData(data)
      }

      setLoading(false)
    }

    fetchData()
  }, [tableName])

  return { data, loading, error }
}
