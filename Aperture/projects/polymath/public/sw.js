/**
 * Service Worker for Polymath PWA
 * Enables offline support and background sync
 */

// Update this version when you want to trigger a new service worker
const VERSION = '1.0.1'
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
