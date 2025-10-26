/**
 * Polymath Service Worker
 * Provides offline functionality via caching and background sync
 * Enhanced with intelligent caching strategies and performance optimizations
 */

const CACHE_VERSION = 'polymath-v3'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const IMAGE_CACHE = `${CACHE_VERSION}-images`
const API_CACHE = `${CACHE_VERSION}-api`

// Cache expiration times
const CACHE_EXPIRATION = {
  images: 30 * 24 * 60 * 60 * 1000, // 30 days
  api: 24 * 60 * 60 * 1000,          // 24 hours
  runtime: 7 * 24 * 60 * 60 * 1000,  // 7 days
}

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// API endpoints that are safe to cache
const CACHEABLE_API_PATTERNS = [
  '/api/reading',
  '/api/memories',
  '/api/projects',
  '/api/analytics',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install event')
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      console.log('[SW] Caching static assets')
      // Cache assets one by one, ignoring failures
      const cachePromises = STATIC_ASSETS.map(async (url) => {
        try {
          const response = await fetch(url)
          if (response.ok) {
            await cache.put(url, response)
            console.log('[SW] Cached:', url)
          } else {
            console.warn('[SW] Failed to cache (not found):', url)
          }
        } catch (error) {
          console.warn('[SW] Failed to cache:', url, error)
        }
      })
      await Promise.all(cachePromises)
      console.log('[SW] Static assets cached')
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event')
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('polymath-') &&
                     cacheName !== STATIC_CACHE &&
                     cacheName !== RUNTIME_CACHE &&
                     cacheName !== IMAGE_CACHE &&
                     cacheName !== API_CACHE
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      }),
      // Clean expired entries
      cleanExpiredCaches()
    ])
  )
  // Take control immediately
  return self.clients.claim()
})

// Clean expired cache entries
async function cleanExpiredCaches() {
  const now = Date.now()

  // Clean image cache
  const imageCache = await caches.open(IMAGE_CACHE)
  const imageKeys = await imageCache.keys()
  for (const request of imageKeys) {
    const response = await imageCache.match(request)
    const cachedTime = new Date(response.headers.get('date')).getTime()
    if (now - cachedTime > CACHE_EXPIRATION.images) {
      await imageCache.delete(request)
      console.log('[SW] Deleted expired image:', request.url)
    }
  }

  // Clean API cache
  const apiCache = await caches.open(API_CACHE)
  const apiKeys = await apiCache.keys()
  for (const request of apiKeys) {
    const response = await apiCache.match(request)
    const cachedTime = new Date(response.headers.get('date')).getTime()
    if (now - cachedTime > CACHE_EXPIRATION.api) {
      await apiCache.delete(request)
      console.log('[SW] Deleted expired API response:', request.url)
    }
  }
}

// Fetch event - intelligent caching strategies
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

  // Images: Cache-first with stale-while-revalidate
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, networkResponse.clone())
            })
          }
          return networkResponse
        })
        // Return cached immediately, update in background
        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // API requests: Network-first with intelligent caching
  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API_PATTERNS.some(pattern =>
      url.pathname.startsWith(pattern)
    )

    event.respondWith(
      fetch(request, {
        credentials: 'same-origin',
        headers: {
          ...request.headers,
          'Cache-Control': 'no-cache'
        }
      })
        .then((response) => {
          // Cache successful GET responses for cacheable endpoints
          if (response.ok && isCacheable) {
            const responseClone = response.clone()
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Fallback to cache for cacheable endpoints
          if (isCacheable) {
            return caches.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                // Add stale indicator header
                const headers = new Headers(cachedResponse.headers)
                headers.set('X-Cache-Status', 'stale')
                return new Response(cachedResponse.body, {
                  status: cachedResponse.status,
                  statusText: cachedResponse.statusText,
                  headers
                })
              }
              return offlineResponse()
            })
          }
          return offlineResponse()
        })
    )
    return
  }

  // JavaScript/CSS: Cache-first with network fallback and update
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, networkResponse.clone())
            })
          }
          return networkResponse
        }).catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // HTML pages: Network-first with cache fallback
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html')
          })
        })
    )
    return
  }

  // Other assets: cache-first, network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((response) => {
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

// Helper: Offline response
function offlineResponse() {
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'No network connection',
      cached: false
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

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
