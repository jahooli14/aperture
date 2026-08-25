/// <reference lib="webworker" />
/**
 * Relay's service worker.
 *
 * Its real job is the push notification — that's the thing that has to be as
 * good as WhatsApp's or nobody comes back. Caching is a bonus.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Serve the shell for navigations so an installed Relay opens offline.
// /api/ is excluded — a stale story is worse than an honest error.
registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      const cached = await caches.match('/index.html')
      return cached ?? fetch(request)
    },
    { denylist: [/^\/api\//] }
  )
)

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Relay', {
      body: payload.body || '',
      icon: '/notification-icon.png',
      badge: '/notification-badge.png',
      // One story collapses to one notification rather than stacking up a
      // fortnight of them while you're away.
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { url: payload.url || '/' },
    } as NotificationOptions)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string })?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url.includes(target))
      if (open) return open.focus()
      const any = clients[0]
      if (any) {
        void any.navigate(target)
        return any.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})
