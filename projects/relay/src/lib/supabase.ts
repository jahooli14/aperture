import { createClient } from '@supabase/supabase-js'

declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string

const url = import.meta.env?.VITE_SUPABASE_URL || __SUPABASE_URL__
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || __SUPABASE_ANON_KEY__

if (!url || !anonKey) {
  console.warn('[relay] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — sign-in will not work.')
}

export const supabase = createClient(url || '', anonKey || '', {
  db: { schema: 'relay' },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
