/**
 * Web Push for the "your turn" notification.
 *
 * On iOS this only works once the PWA is installed to the home screen, so the
 * UI has to say that plainly rather than silently failing.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalised)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** True on an iOS/iPadOS browser tab, where push needs home-screen install first. */
export function needsHomeScreenInstall(): boolean {
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const installed = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  return iOS && !installed
}

export function permissionState(): NotificationPermission | 'unsupported' {
  return isPushSupported() ? Notification.permission : 'unsupported'
}

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.ready
  return Boolean(await registration.pushManager.getSubscription())
}

export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error('This browser cannot do notifications')
  if (needsHomeScreenInstall()) {
    throw new Error('On iPhone, add Relay to your home screen first — then turn notifications on')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked in your browser settings')

  const keyResponse = await fetch('/api/push')
  if (!keyResponse.ok) throw new Error('Notifications are not set up on the server yet')
  const { publicKey } = await keyResponse.json()

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }))

  const json = subscription.toJSON()
  const saved = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })
  if (!saved.ok) throw new Error('Could not save your notification settings')
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const { endpoint } = subscription
  await subscription.unsubscribe().catch(() => {})
  await fetch('/api/push', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {})
}
