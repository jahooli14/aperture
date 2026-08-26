import { createClient } from '@supabase/supabase-js'

/**
 * The dashboard shows several Supabase URLs and it is easy to copy the wrong
 * one. Anything but the bare project URL fails as "Invalid path specified in
 * request URL", which says nothing useful — so normalise it here instead.
 */
export function normaliseSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/(rest|auth|storage|realtime)\/v\d+$/, '')
}

declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string

const url = normaliseSupabaseUrl(import.meta.env?.VITE_SUPABASE_URL || __SUPABASE_URL__ || '')
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || __SUPABASE_ANON_KEY__

if (!url || !anonKey) {
  console.warn('[relay] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — sign-in will not work.')
}

export const supabase = createClient(url || '', anonKey || '', {
  db: { schema: 'relay' },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
