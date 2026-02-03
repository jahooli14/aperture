/**
 * Safe storage utilities that handle browser compatibility issues
 * Includes fallbacks for private browsing mode and quota exceeded errors
 */

/**
 * Check if IndexedDB is available in the current browser context
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.indexedDB
  } catch (e) {
    console.warn('[Storage] IndexedDB availability check failed:', e)
    return false
  }
}

/**
 * Check if localStorage is available and writeable
 */
export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false
    }
    // Test write access
    const testKey = '__storage_test__'
    window.localStorage.setItem(testKey, 'test')
    window.localStorage.removeItem(testKey)
    return true
  } catch (e) {
    console.warn('[Storage] localStorage not available:', e)
    return false
  }
}

/**
 * Safe localStorage wrapper with error handling
 * Falls back to in-memory storage in private browsing mode
 */
export class SafeStorage {
  private memoryStorage = new Map<string, string>()
  private useMemory = false

  constructor() {
    this.useMemory = !isLocalStorageAvailable()
    if (this.useMemory) {
      console.warn(
        '[SafeStorage] localStorage unavailable, using in-memory fallback (data will not persist)'
      )
    }
  }

  setItem(key: string, value: string): boolean {
    if (this.useMemory) {
      this.memoryStorage.set(key, value)
      return true
    }

    try {
      localStorage.setItem(key, value)
      return true
    } catch (e: any) {
      console.error('[SafeStorage] Failed to set item:', key, e)

      // Handle quota exceeded error
      if (e.name === 'QuotaExceededError') {
        console.warn('[SafeStorage] Quota exceeded, attempting to clear old data')
        this.clearOldData()

        // Try again after clearing
        try {
          localStorage.setItem(key, value)
          return true
        } catch (retryError) {
          console.error('[SafeStorage] Still failed after clearing:', retryError)
        }
      }

      // Fall back to memory storage
      this.useMemory = true
      this.memoryStorage.set(key, value)
      return false
    }
  }

  getItem(key: string): string | null {
    if (this.useMemory) {
      return this.memoryStorage.get(key) || null
    }

    try {
      return localStorage.getItem(key)
    } catch (e) {
      console.error('[SafeStorage] Failed to get item:', key, e)
      return this.memoryStorage.get(key) || null
    }
  }

  removeItem(key: string): void {
    if (this.useMemory) {
      this.memoryStorage.delete(key)
      return
    }

    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.error('[SafeStorage] Failed to remove item:', key, e)
      this.memoryStorage.delete(key)
    }
  }

  clear(): void {
    if (this.useMemory) {
      this.memoryStorage.clear()
      return
    }

    try {
      localStorage.clear()
    } catch (e) {
      console.error('[SafeStorage] Failed to clear storage:', e)
      this.memoryStorage.clear()
    }
  }

  /**
   * Clear old data to free up space
   * Removes items older than 30 days or items with specific prefixes
   */
  private clearOldData(): void {
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // Remove old error logs
        if (key.startsWith('error_log_')) {
          const item = localStorage.getItem(key)
          if (item) {
            try {
              const parsed = JSON.parse(item)
              if (parsed.timestamp && parsed.timestamp < thirtyDaysAgo) {
                keysToRemove.push(key)
              }
            } catch (e) {
              // Invalid JSON, remove it
              keysToRemove.push(key)
            }
          }
        }

        // Remove old cache entries
        if (key.includes('cache_') || key.includes('temp_')) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key)
        } catch (e) {
          console.error('[SafeStorage] Failed to remove old key:', key)
        }
      })

      console.log(`[SafeStorage] Cleared ${keysToRemove.length} old items`)
    } catch (e) {
      console.error('[SafeStorage] Failed to clear old data:', e)
    }
  }

  /**
   * Get storage usage info
   */
  async getStorageInfo(): Promise<{
    quota?: number
    usage?: number
    available?: number
    percentUsed?: number
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate()
        const quota = estimate.quota || 0
        const usage = estimate.usage || 0
        const available = quota - usage
        const percentUsed = quota > 0 ? (usage / quota) * 100 : 0

        return { quota, usage, available, percentUsed }
      } catch (e) {
        console.error('[SafeStorage] Failed to estimate storage:', e)
      }
    }
    return {}
  }
}

// Export singleton instance
export const safeStorage = new SafeStorage()

/**
 * Test IndexedDB by attempting to open a test database
 */
export async function testIndexedDB(): Promise<boolean> {
  if (!isIndexedDBAvailable()) {
    return false
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('__test_db__', 1)

      request.onsuccess = () => {
        try {
          request.result.close()
          indexedDB.deleteDatabase('__test_db__')
          resolve(true)
        } catch (e) {
          resolve(false)
        }
      }

      request.onerror = () => {
        resolve(false)
      }

      request.onblocked = () => {
        resolve(false)
      }
    } catch (e) {
      resolve(false)
    }
  })
}
