import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.')
}

// Use globalThis to persist instance across hot module reloads in development
const globalKey = '__SUPABASE_CLIENT__'

const getSupabaseClient = () => {
  // Check if we already have an instance in the global scope (survives HMR)
  if (typeof globalThis !== 'undefined' && globalThis[globalKey]) {
    return globalThis[globalKey]
  }

  // Create new instance
  const supabaseInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Use localStorage for better persistence during hot reloads
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })

  // Store in global scope to survive hot reloads
  if (typeof globalThis !== 'undefined') {
    globalThis[globalKey] = supabaseInstance
  }

  return supabaseInstance
}

const supabase = getSupabaseClient()

export default supabase
