/**
 * Web Push subscription for the daily "record a voice note" reminder.
 * Relies on window.fetch already being patched by setupAuthFetch() to
 * attach the Supabase bearer token to /api/ requests.
 */

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const array = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) array[i] = rawData.charCodeAt(i)
  return array.buffer
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function getSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

/**
 * Requests notification permission, subscribes this browser to push, and
 * saves the subscription + schedule server-side. Throws if permission is
 * denied or push isn't supported — callers should catch and surface it.
 */
export async function subscribeToVoiceReminder(schedule: {
  hour: number
  minute: number
}): Promise<void> {
  if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted')

  const keyRes = await fetch('/api/push')
  if (!keyRes.ok) throw new Error('Push is not configured on the server')
  const { publicKey } = await keyRes.json()

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = subscription.toJSON()
  const subRes = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })
  if (!subRes.ok) throw new Error('Failed to save push subscription')

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const settingsRes = await fetch('/api/push?resource=settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, hour: schedule.hour, minute: schedule.minute, timezone }),
  })
  if (!settingsRes.ok) throw new Error('Failed to save reminder schedule')
}

/** Updates hour/minute/enabled without re-requesting permission or re-subscribing. */
export async function updateVoiceReminderSchedule(schedule: {
  enabled: boolean
  hour: number
  minute: number
}): Promise<void> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const res = await fetch('/api/push?resource=settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...schedule, timezone }),
  })
  if (!res.ok) throw new Error('Failed to update reminder schedule')
}

/**
 * Turns the reminder off: marks it disabled server-side (hour/minute passed
 * through unchanged so re-enabling later remembers the user's time) and
 * removes the browser's push subscription so it stops accepting pushes.
 */
export async function unsubscribeFromVoiceReminder(schedule: { hour: number; minute: number }): Promise<void> {
  await updateVoiceReminderSchedule({ enabled: false, hour: schedule.hour, minute: schedule.minute }).catch(() => {})

  if (!isPushSupported()) return
  const subscription = await getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe().catch(() => {})

  await fetch('/api/push', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {})
}
