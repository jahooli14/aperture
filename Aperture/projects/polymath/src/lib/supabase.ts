import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing environment variables:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'SET' : 'MISSING',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'SET' : 'MISSING'
  })
  throw new Error(`Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel environment variables.`)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
