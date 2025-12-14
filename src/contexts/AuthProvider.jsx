import { createContext, useEffect, useState } from 'react'
import supabase from '../supabaseClient'

export const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
})

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      if (active) {
        setSession(currentSession)
        setLoading(false)
      }
    }

    loadSession()

    const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (active) {
        setSession(newSession)
        setLoading(false)
      }
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'global' })
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
