import { createClient } from '@supabase/supabase-js'

// Prioritize Vite env vars, fallback to build-time defined constants (Vercel/Process env)
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || __SUPABASE_URL__
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || __SUPABASE_ANON_KEY__

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing environment variables:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'SET' : 'MISSING',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'SET' : 'MISSING'
  })
  // Don't throw, just warn to prevent app crash if one env is missing in dev
  console.warn(`Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`)
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
