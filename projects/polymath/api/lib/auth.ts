/**
 * Authentication Helper
 * Returns user ID for API requests
 */

import type { VercelRequest } from '@vercel/node'
import { getSupabaseClient } from './supabase.js'

export async function getUserId(req?: VercelRequest): Promise<string> {
  // 1. Try Authorization header
  const token = req?.headers.authorization?.replace('Bearer ', '')
  
  if (token) {
    const supabase = getSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (user && !error) {
      return user.id
    }
  }

  // Fallback (Hardcoded)
  return 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'
}
