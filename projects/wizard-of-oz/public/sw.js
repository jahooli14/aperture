/**
 * Service Worker for offline support
 * Caches static assets and photo images for offline viewing
 */

const CACHE_VERSION = 2;
const STATIC_CACHE = `wizard-of-oz-static-v${CACHE_VERSION}`;
const IMAGE_CACHE = `wizard-of-oz-images-v${CACHE_VERSION}`;
const MAX_IMAGE_CACHE_SIZE = 100; // Maximum number of images to cache

const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Patterns for Supabase storage URLs (both signed and public)
const SUPABASE_STORAGE_PATTERNS = [
  /supabase\.co\/storage\/v1\/object/,
  /supabase\.co\/storage\/v1\/s3/,
];

function isImageRequest(request) {
  const url = request.url;
  // Check if it's a Supabase storage URL
  return SUPABASE_STORAGE_PATTERNS.some(pattern => pattern.test(url));
}

// Trim cache to maximum size (remove oldest entries)
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    // Remove oldest entries (first in = oldest)
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete caches from old versions
          if (cacheName.startsWith('wizard-of-oz-') &&
              cacheName !== STATIC_CACHE &&
              cacheName !== IMAGE_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch event - different strategies for different content types
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // For image requests (Supabase storage), use cache-first strategy
  // This ensures photos load quickly and work offline
  if (isImageRequest(request)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        // Try to get from cache first
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
          // Return cached version immediately
          // Also fetch fresh version in background (stale-while-revalidate)
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              cache.put(request, networkResponse.clone());
              // Trim cache to prevent unlimited growth
              trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
            }
          }).catch(() => {
            // Network failed, that's ok - we already returned cached version
          });
          return cachedResponse;
        }

        // Not in cache, fetch from network
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            // Cache the response for future use
            cache.put(request, networkResponse.clone());
            trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
          }
          return networkResponse;
        } catch (error) {
          // Network failed and not in cache - return offline placeholder or error
          console.log('[SW] Image fetch failed:', request.url);
          return new Response('', { status: 503, statusText: 'Image unavailable offline' });
        }
      })
    );
    return;
  }

  // For static assets and other requests, use network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses for same-origin requests
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request);
      })
  );
});
