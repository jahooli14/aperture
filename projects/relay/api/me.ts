/**
 * GET   /api/me -> your profile
 * PATCH /api/me -> change your display name
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { cleanText, fail, handleErrors } from './_lib/http.js'
import { ensureProfile } from './_lib/stories.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return fail(res, 401, 'Sign in first')

  const supabase = getSupabaseClient()

  return handleErrors(res, async () => {
    if (req.method === 'GET') {
      const profile = await ensureProfile(supabase, userId)
      return res.status(200).json({ profile })
    }

    if (req.method === 'PATCH') {
      const displayName = cleanText(req.body?.display_name, 40)
      if (!displayName) return fail(res, 400, 'Names are 1 to 40 characters')

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          { user_id: userId, display_name: displayName, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .select('user_id, display_name')
        .single()
      if (error) throw error

      return res.status(200).json({ profile: data })
    }

    return fail(res, 405, 'Method not allowed')
  })
}
