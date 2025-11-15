/**
 * Service Worker for Polymath PWA
 * Enables offline support and background sync
 */

// Update this version when you want to trigger a new service worker
const VERSION = '1.0.5-bulletproof-share'
const CACHE_NAME = `polymath-v${VERSION}`
const RUNTIME_CACHE = `polymath-runtime-v${VERSION}`

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name))
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Log POST requests and share-target for debugging
  if (request.method === 'POST' || url.pathname.includes('share')) {
    console.log('[ServiceWorker] Fetch:', request.method, url.pathname, url.href)
  }

  // Handle share target POST requests with robust multi-strategy approach
  if (url.pathname === '/share-target' && request.method === 'POST') {
    console.log('[ServiceWorker] ✓✓✓ INTERCEPTING SHARE TARGET POST REQUEST ✓✓✓')
    console.log('[ServiceWorker] Request URL:', request.url)
    console.log('[ServiceWorker] Request method:', request.method)
    console.log('[ServiceWorker] Timestamp:', new Date().toISOString())
    event.respondWith(
      (async () => {
        try {
          const formData = await request.formData()

          // Extract shared data - Android puts URL in 'text', spec-compliant in 'url'
          const textParam = formData.get('text') || ''
          const urlParam = formData.get('url') || ''
          const titleParam = formData.get('title') || ''

          console.log('[ServiceWorker] FormData - text:', textParam)
          console.log('[ServiceWorker] FormData - url:', urlParam)
          console.log('[ServiceWorker] FormData - title:', titleParam)

          // Determine shared URL (prioritize URL param first, then text for Android compatibility)
          let shared = urlParam ? urlParam.toString().trim() : textParam.toString().trim()

          // If we got a title but no URL/text, check if title is actually a URL
          if (!shared && titleParam) {
            const titleStr = titleParam.toString().trim()
            if (titleStr.startsWith('http://') || titleStr.startsWith('https://')) {
              shared = titleStr
            }
          }

          console.log('[ServiceWorker] Final shared content:', shared)

          // Make sure we have something and it looks like a URL
          if (!shared) {
            console.warn('[ServiceWorker] No content shared')
            return new Response('<html><body><h1>Error</h1><p>No URL was shared</p></body></html>', {
              headers: { 'Content-Type': 'text/html' }
            })
          }

          // Validate it's a URL
          try {
            new URL(shared)
          } catch (e) {
            console.error('[ServiceWorker] Invalid URL:', shared)
            return new Response(`<html><body><h1>Error</h1><p>Invalid URL: ${shared}</p></body></html>`, {
              headers: { 'Content-Type': 'text/html' }
            })
          }

          // Strategy 1: Try to find an existing window client and message it
          const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          console.log('[ServiceWorker] Found', allClients.length, 'window clients')

          if (allClients && allClients.length > 0) {
            // Prefer focused client, fallback to first available
            const targetClient = allClients.find(c => c.focused) || allClients[0]
            console.log('[ServiceWorker] Attempting to message existing client:', targetClient.url)

            try {
              // Send message to existing client
              targetClient.postMessage({ type: 'web-share-target', shared })
              console.log('[ServiceWorker] Message sent to existing client')

              // Try to focus the client
              await targetClient.focus()
              console.log('[ServiceWorker] Client focused')

              // Return a simple response to close the share UI
              return new Response('<html><body><script>window.close?.()</script></body></html>', {
                headers: { 'Content-Type': 'text/html' }
              })
            } catch (messageError) {
              console.warn('[ServiceWorker] Failed to message client:', messageError)

              // Strategy 2: Try to navigate the client
              try {
                const navUrl = `/reading?shared=${encodeURIComponent(shared)}`
                console.log('[ServiceWorker] Attempting to navigate client to:', navUrl)
                await targetClient.navigate(navUrl)
                await targetClient.focus()
                console.log('[ServiceWorker] Client navigated successfully')

                return new Response('<html><body><script>window.close?.()</script></body></html>', {
                  headers: { 'Content-Type': 'text/html' }
                })
              } catch (navError) {
                console.warn('[ServiceWorker] Failed to navigate client:', navError)
                // Fall through to openWindow strategy
              }
            }
          }

          // Strategy 3: Try to open a new window
          try {
            const openUrl = `/reading?shared=${encodeURIComponent(shared)}`
            console.log('[ServiceWorker] Attempting to open new window:', openUrl)
            const opened = await self.clients.openWindow(openUrl)
            if (opened) {
              console.log('[ServiceWorker] New window opened successfully')
              return new Response('<html><body><script>/* opened */</script></body></html>', {
                headers: { 'Content-Type': 'text/html' }
              })
            }
          } catch (openError) {
            console.warn('[ServiceWorker] Failed to open window:', openError)
            // Fall through to HTML redirect
          }

          // Strategy 4: Fallback to HTML/JS redirect (most reliable for Android)
          const redirectUrl = `/reading?shared=${encodeURIComponent(shared)}`
          console.log('[ServiceWorker] Using HTML redirect fallback to:', redirectUrl)

          return new Response(`
            <html>
              <head>
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <script>location.replace('${redirectUrl}');</script>
              </head>
              <body></body>
            </html>`,
            {
              status: 200,
              headers: { "Content-Type": "text/html" }
            }
          )
        } catch (error) {
          console.error('[ServiceWorker] Error processing share target:', error)
          // Fallback to reading page on error with JS redirect
          return new Response(`
            <html>
              <head>
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <script>location.replace('/reading');</script>
              </head>
              <body></body>
            </html>`,
            {
              status: 200,
              headers: { "Content-Type": "text/html" }
            }
          )
        }
      })()
    )
    return
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API calls from caching (always go to network)
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // Network first strategy for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE)
            .then((cache) => cache.put(request, responseClone))
        }
        return response
      })
      .catch(() => {
        // Fall back to cache on network failure
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/')
            }
            return new Response('Offline', { status: 503 })
          })
      })
  )
})

// Background sync for offline voice notes
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-voice-notes') {
    event.waitUntil(syncVoiceNotes())
  }
})

async function syncVoiceNotes() {
  // Get pending voice notes from IndexedDB
  const db = await openDB()
  const pendingNotes = await db.getAll('pending-notes')

  for (const note of pendingNotes) {
    try {
      await fetch('/api/memories?capture=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note)
      })
      // Remove from pending queue on success
      await db.delete('pending-notes', note.id)
    } catch (error) {
      console.error('Failed to sync note:', error)
      // Keep in queue for next sync
    }
  }
}

// Helper: Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('polymath-offline', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('pending-notes')) {
        db.createObjectStore('pending-notes', { keyPath: 'id' })
      }
    }
  })
}
