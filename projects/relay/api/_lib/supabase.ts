/**
 * Shared Supabase client, pinned to the `relay` schema.
 *
 * Relay shares a Supabase project with another Aperture app, so every query
 * here is scoped to its own schema. `relay` must be listed under
 * Settings -> API -> Exposed schemas or PostgREST won't see these tables.
 */
import { createClient } from '@supabase/supabase-js'

function create() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)')
  }

  return createClient(url, key, {
    db: { schema: 'relay' },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type RelayClient = ReturnType<typeof create>

let instance: RelayClient | null = null

export function getSupabaseClient(): RelayClient {
  if (!instance) instance = create()
  return instance
}
