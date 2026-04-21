/**
 * Retired service worker.
 *
 * This used to be a bespoke SW with a 7-day API cache, which could cache 401
 * responses and trap users in auth loops until they redownloaded the PWA.
 * The app now uses vite-plugin-pwa's /sw.js as its single service worker.
 *
 * Existing installs still have this file registered from before the cutover.
 * On their next update check, they load this stub, which:
 *   1. Takes control of all open clients.
 *   2. Deletes every cache it can see (including the old aperture-v1-* ones).
 *   3. Unregisters itself.
 *
 * After that the /sw.js registration from main.tsx is the only controller.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    } catch (err) {
      console.warn('[retired-sw] cache cleanup failed:', err)
    }
    try {
      await self.registration.unregister()
    } catch (err) {
      console.warn('[retired-sw] unregister failed:', err)
    }
    try {
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((client) => {
        if ('navigate' in client) client.navigate(client.url)
      })
    } catch (err) {
      console.warn('[retired-sw] client reload failed:', err)
    }
  })())
})

// Pass fetches straight through. Do not cache anything — ever.
self.addEventListener('fetch', () => {})
