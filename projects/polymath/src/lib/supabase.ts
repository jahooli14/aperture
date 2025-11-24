import { createClient } from '@supabase/supabase-js'

// Prioritize Vite env vars, fallback to process.env for broader compatibility
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing environment variables:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'SET' : 'MISSING',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'SET' : 'MISSING'
  })
  // Don't throw, just warn to prevent app crash if one env is missing in dev
  console.warn(`Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`)
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
