/**
 * Web Push. This is the part of Relay that has to beat WhatsApp — if the
 * "your turn" notification doesn't land, nothing else in the app matters.
 *
 * Uses VAPID directly (same approach as the other Aperture apps) rather than
 * a push vendor: no SDK, no extra account, works in any browser with the
 * Push API. On iOS the PWA must be installed to the home screen first.
 */
import webpush from 'web-push'
import type { RelayClient } from './supabase.js'

let configured = false

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

function configure() {
  if (configured || !pushConfigured()) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:relay@example.com',
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  )
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

/**
 * Notifies every member of a story except `exceptUserId` (the person who just
 * acted — nobody needs telling about their own line).
 *
 * Failures never bubble up: a dead subscription must not fail the write that
 * triggered it. Endpoints the push service has retired (404/410) are deleted
 * so they stop being retried forever.
 */
export async function notifyStory(
  supabase: RelayClient,
  opts: {
    storyId: string
    exceptUserId?: string
    /** A function so each person can be told what it means for them — the
     *  one whose turn it now is gets different words from everyone else. */
    payload: PushPayload | ((userId: string) => PushPayload)
  }
): Promise<{ sent: number; removed: number }> {
  if (!pushConfigured()) return { sent: 0, removed: 0 }
  configure()

  const { data: members } = await supabase
    .from('story_members')
    .select('user_id')
    .eq('story_id', opts.storyId)
    .eq('notify', true)

  const recipients = (members ?? [])
    .map((m) => m.user_id as string)
    .filter((id) => id !== opts.exceptUserId)

  if (recipients.length === 0) return { sent: 0, removed: 0 }

  return sendToUsers(supabase, recipients, opts.payload)
}

/** Sends to one person, on every device they've turned notifications on for. */
export async function notifyUser(
  supabase: RelayClient,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; removed: number }> {
  if (!pushConfigured()) return { sent: 0, removed: 0 }
  configure()
  return sendToUsers(supabase, [userId], payload)
}

async function sendToUsers(
  supabase: RelayClient,
  userIds: string[],
  payload: PushPayload | ((userId: string) => PushPayload)
): Promise<{ sent: number; removed: number }> {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', userIds)

  const resolve = typeof payload === 'function' ? payload : () => payload
  const dead: string[] = []
  let sent = 0

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(resolve(sub.user_id)),
          // A "your turn" push is worth waking the phone for, and worth the
          // push service holding briefly if the device is offline.
          { urgency: 'high', TTL: 60 * 60 * 12 }
        )
        sent += 1
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // The push service has retired this endpoint — stop retrying it
        // forever, and let the client notice and re-subscribe.
        if (status === 404 || status === 410) dead.push(sub.endpoint)
        else console.error('[relay/push] send failed:', status, e)
      }
    })
  )

  if (dead.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', dead)
  }

  return { sent, removed: dead.length }
}
