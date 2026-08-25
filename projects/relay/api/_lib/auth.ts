/**
 * Pulls the user id out of the Supabase JWT on the Authorization header.
 * Returns null when there isn't a valid one — callers return 401.
 */
import { getSupabaseClient } from './supabase.js'

export async function getUserId(req: {
  headers?: Record<string, string | string[] | undefined>
}): Promise<string | null> {
  const header = req.headers?.['authorization'] || req.headers?.['Authorization']
  const value = Array.isArray(header) ? header[0] : header
  if (!value?.startsWith('Bearer ')) return null

  try {
    const { data, error } = await getSupabaseClient().auth.getUser(value.slice(7))
    if (!error && data.user) return data.user.id
  } catch (e) {
    console.error('[auth] token verification failed:', e)
  }
  return null
}
