import { createContext, useEffect, useState, useRef } from 'react'
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
  const sessionRef = useRef(null)
  const subscriptionRef = useRef(null)
  const lastRefreshTimeRef = useRef(0)
  const refreshInProgressRef = useRef(false)
  const tokenRefreshDebounceRef = useRef(null)

  useEffect(() => {
    let active = true
    const abortController = new AbortController()

    const initializeAuth = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (!active || abortController.signal.aborted) return
      await loadSession()
    }

    const loadSession = async () => {
      if (refreshInProgressRef.current) {
        return
      }

      try {
        refreshInProgressRef.current = true

        const getSessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession() timeout')), 10000)
        )

        let result
        try {
          result = await Promise.race([getSessionPromise, timeoutPromise])
        } catch (timeoutError) {
          if (timeoutError.message.includes('timeout')) {
            refreshInProgressRef.current = false
            if (active && !abortController.signal.aborted) {
              setSession(sessionRef.current)
              setLoading(false)
            }
            return
          }
          throw timeoutError
        }

        refreshInProgressRef.current = false

        if (!active || abortController.signal.aborted) return

        const {
          data: { session: currentSession },
          error,
        } = result

        if (!active) return

        if (error) {
          const isInvalidSession =
            error.message?.includes('session_not_found') ||
            error.message?.includes('Invalid refresh token') ||
            error.message?.includes('refresh_token')

          if (isInvalidSession) {
            sessionRef.current = null
            setSession(null)
          } else {
            setSession(sessionRef.current)
          }
        } else {
          if (currentSession) {
            sessionRef.current = currentSession
            setSession(currentSession)
          } else {
            sessionRef.current = null
            setSession(null)
          }
        }
        setLoading(false)
      } catch (err) {
        refreshInProgressRef.current = false
        if (active) {
          setSession(sessionRef.current)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return

      // Debounce rapid TOKEN_REFRESHED events to prevent 429 errors
      if (event === 'TOKEN_REFRESHED') {
        const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current

        if (timeSinceLastRefresh < 5000 && tokenRefreshDebounceRef.current) {
          return
        }

        if (tokenRefreshDebounceRef.current) {
          clearTimeout(tokenRefreshDebounceRef.current)
        }

        tokenRefreshDebounceRef.current = setTimeout(() => {
          tokenRefreshDebounceRef.current = null
        }, 5000)
      }

      if (event === 'SIGNED_OUT') {
        sessionRef.current = null
        setSession(null)
      } else if (event === 'TOKEN_REFRESHED') {
        if (newSession) {
          sessionRef.current = newSession
          setSession(newSession)
          lastRefreshTimeRef.current = Date.now()
        } else {
          setSession(sessionRef.current)
        }
      } else {
        sessionRef.current = newSession
        setSession(newSession)
      }

      setLoading(false)
    })

    subscriptionRef.current = data

    return () => {
      active = false
      abortController.abort()
      refreshInProgressRef.current = false
      if (tokenRefreshDebounceRef.current) {
        clearTimeout(tokenRefreshDebounceRef.current)
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.subscription.unsubscribe()
      }
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
