/**
 * Cache Manager with Stale-While-Revalidate Strategy
 * Provides instant loading by serving cached data immediately while fetching fresh data in background
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CacheConfig {
  ttl?: number // Time to live in milliseconds (default: 30 seconds)
  staleWhileRevalidate?: number // Serve stale data for this long while revalidating (default: 5 minutes)
}

const DEFAULT_TTL = 30 * 1000 // 30 seconds
const DEFAULT_SWR = 5 * 60 * 1000 // 5 minutes

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private pendingRequests: Map<string, Promise<any>> = new Map()
  private revalidating: Set<string> = new Set()

  /**
   * Get data from cache or fetch if not available
   * Uses stale-while-revalidate pattern for instant loading
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig = {}
  ): Promise<T> {
    const ttl = config.ttl || DEFAULT_TTL
    const swr = config.staleWhileRevalidate || DEFAULT_SWR
    const now = Date.now()

    // Check cache
    const cached = this.cache.get(key)

    // Fresh data available - return immediately
    if (cached && now < cached.expiresAt) {
      console.log(`[Cache] HIT (fresh): ${key}`)
      return cached.data
    }

    // Stale data available - return it and revalidate in background
    if (cached && now < cached.timestamp + swr) {
      console.log(`[Cache] HIT (stale): ${key}, revalidating...`)

      // Return stale data immediately
      const staleData = cached.data

      // Revalidate in background (only once)
      if (!this.revalidating.has(key)) {
        this.revalidateInBackground(key, fetcher, ttl)
      }

      return staleData
    }

    // No cache or expired - must fetch
    console.log(`[Cache] MISS: ${key}`)
    return this.fetchAndCache(key, fetcher, ttl)
  }

  /**
   * Fetch data and cache it (with request deduplication)
   */
  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // Deduplicate concurrent requests
    if (this.pendingRequests.has(key)) {
      console.log(`[Cache] Deduplicating request: ${key}`)
      return this.pendingRequests.get(key)!
    }

    const promise = fetcher()
    this.pendingRequests.set(key, promise)

    try {
      const data = await promise
      const now = Date.now()

      this.cache.set(key, {
        data,
        timestamp: now,
        expiresAt: now + ttl
      })

      console.log(`[Cache] Cached: ${key} (TTL: ${ttl}ms)`)
      return data
    } finally {
      this.pendingRequests.delete(key)
    }
  }

  /**
   * Revalidate data in background without blocking
   */
  private revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): void {
    this.revalidating.add(key)

    // Fire and forget - don't await
    fetcher()
      .then(data => {
        const now = Date.now()
        this.cache.set(key, {
          data,
          timestamp: now,
          expiresAt: now + ttl
        })
        console.log(`[Cache] Revalidated: ${key}`)
      })
      .catch(err => {
        console.error(`[Cache] Revalidation failed for ${key}:`, err)
      })
      .finally(() => {
        this.revalidating.delete(key)
      })
  }

  /**
   * Manually set cache entry
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    })
    console.log(`[Cache] Manually set: ${key}`)
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
    console.log(`[Cache] Invalidated: ${key}`)
  }

  /**
   * Invalidate all entries matching pattern
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        console.log(`[Cache] Invalidated: ${key}`)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    console.log('[Cache] Cleared all')
  }

  /**
   * Prefetch data for instant future access
   */
  async prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig = {}
  ): Promise<void> {
    // Only prefetch if not already cached or expired
    const cached = this.cache.get(key)
    const now = Date.now()

    if (!cached || now >= cached.expiresAt) {
      console.log(`[Cache] Prefetching: ${key}`)
      await this.fetchAndCache(key, fetcher, config.ttl || DEFAULT_TTL)
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      pending: this.pendingRequests.size,
      revalidating: this.revalidating.size,
      entries: Array.from(this.cache.keys())
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager()

/**
 * Helper to create cache keys
 */
export function createCacheKey(base: string, params?: Record<string, any>): string {
  if (!params) return base
  const paramStr = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return `${base}?${paramStr}`
}

/**
 * Cache configuration presets
 */
export const CACHE_PRESETS = {
  // Very fast changing data - 10s fresh, 1min stale
  realtime: { ttl: 10 * 1000, staleWhileRevalidate: 60 * 1000 },

  // Normal data - 30s fresh, 5min stale
  normal: { ttl: 30 * 1000, staleWhileRevalidate: 5 * 60 * 1000 },

  // Slow changing data - 5min fresh, 30min stale
  slow: { ttl: 5 * 60 * 1000, staleWhileRevalidate: 30 * 60 * 1000 },

  // Static data - 1hr fresh, 24hr stale
  static: { ttl: 60 * 60 * 1000, staleWhileRevalidate: 24 * 60 * 60 * 1000 }
}
