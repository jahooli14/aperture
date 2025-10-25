/**
 * Polymath Service Worker
 * Provides offline functionality via caching and background sync
 */

const CACHE_VERSION = 'polymath-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/brain.svg',
  '/manifest.json'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install event')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS)
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith('polymath-') && cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          })
      )
    })
  )
  // Take control immediately
  return self.clients.claim()
})

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  // API requests: network-first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Return offline response for failed API calls
            return new Response(
              JSON.stringify({ error: 'offline', message: 'No network connection' }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            )
          })
        })
    )
    return
  }

  // Static assets: cache-first, network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
    })
  )
})

// Background Sync - sync pending operations when back online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag)

  if (event.tag === 'sync-captures') {
    event.waitUntil(syncPendingCaptures())
  }
})

// Helper: Sync pending captures
async function syncPendingCaptures() {
  try {
    // Open IndexedDB to get pending captures
    const db = await openIndexedDB()
    const tx = db.transaction(['pending-captures'], 'readonly')
    const store = tx.objectStore('pending-captures')
    const pending = await getAllFromStore(store)

    console.log('[SW] Syncing', pending.length, 'pending captures')

    for (const capture of pending) {
      try {
        const response = await fetch('/api/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transcript: capture.transcript,
            created_at: capture.timestamp
          })
        })

        if (response.ok) {
          // Remove from pending queue
          const deleteTx = db.transaction(['pending-captures'], 'readwrite')
          const deleteStore = deleteTx.objectStore('pending-captures')
          await deleteFromStore(deleteStore, capture.id)
          console.log('[SW] Synced capture:', capture.id)
        }
      } catch (error) {
        console.error('[SW] Failed to sync capture:', capture.id, error)
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// IndexedDB helpers (Promise-based wrappers)
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('polymath', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function deleteFromStore(store, id) {
  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

console.log('[SW] Service worker loaded')
