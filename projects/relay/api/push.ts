/**
 * Push subscriptions.
 *
 * GET    /api/push -> the VAPID public key the browser needs to subscribe
 * POST   /api/push -> save this browser's subscription
 * DELETE /api/push -> forget it again
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { fail, handleErrors } from './_lib/http.js'
import { pushConfigured } from './_lib/notify.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
    if (!publicKey || !pushConfigured()) {
      return fail(res, 503, 'Notifications are not set up on the server yet')
    }
    return res.status(200).json({ publicKey })
  }

  const userId = await getUserId(req)
  if (!userId) return fail(res, 401, 'Sign in first')

  const supabase = getSupabaseClient()

  return handleErrors(res, async () => {
    if (req.method === 'POST') {
      const { endpoint, keys } = req.body ?? {}
      if (typeof endpoint !== 'string' || !keys?.p256dh || !keys?.auth) {
        return fail(res, 400, 'endpoint and keys.{p256dh,auth} are required')
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          { endpoint, user_id: userId, p256dh: keys.p256dh, auth: keys.auth },
          { onConflict: 'endpoint' }
        )
      if (error) throw error

      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const endpoint = req.body?.endpoint
      if (typeof endpoint !== 'string') return fail(res, 400, 'endpoint is required')

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', userId)
      if (error) throw error

      return res.status(200).json({ ok: true })
    }

    return fail(res, 405, 'Method not allowed')
  })
}
