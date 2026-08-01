/**
 * Web Push subscriptions + the daily voice-note reminder schedule.
 *
 * GET  /api/push                 -> { publicKey } (VAPID public key for pushManager.subscribe)
 * POST /api/push                 -> upsert a push subscription for the signed-in user
 * POST /api/push?resource=settings -> upsert voice_reminder_settings (enabled/hour/minute/timezone)
 * DELETE /api/push               -> remove a subscription (body: { endpoint })
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) return res.status(503).json({ error: 'Push is not configured (missing VAPID keys)' })
    return res.status(200).json({ publicKey })
  }

  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })

  const supabase = getSupabaseClient()

  try {
    if (req.method === 'POST' && req.query.resource === 'settings') {
      const { enabled, hour, minute, timezone } = req.body || {}
      if (typeof enabled !== 'boolean' || typeof hour !== 'number' || typeof minute !== 'number') {
        return res.status(400).json({ error: 'enabled (boolean), hour and minute (numbers) are required' })
      }

      const { error } = await supabase
        .from('voice_reminder_settings')
        .upsert({
          user_id: userId,
          enabled,
          hour,
          minute,
          timezone: typeof timezone === 'string' && timezone ? timezone : 'UTC',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (req.method === 'POST') {
      const { endpoint, keys } = req.body || {}
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'endpoint and keys.{p256dh,auth} are required' })
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }, { onConflict: 'endpoint' })

      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (req.method === 'DELETE') {
      const { endpoint } = req.body || {}
      if (!endpoint) return res.status(400).json({ error: 'endpoint is required' })

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint)

      if (error) throw error
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('[api/push] Error:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
