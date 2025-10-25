/**
 * IndexedDB wrapper for offline storage
 * Stores pending captures and cached memories
 */

const DB_NAME = 'polymath'
const DB_VERSION = 1

export interface PendingCapture {
  id?: number
  transcript: string
  timestamp: number
  synced: boolean
  retries?: number
}

export interface CachedMemory {
  id: string
  title: string
  body: string
  tags: string[]
  themes: string[]
  created_at: string
  cached_at: number
}

class PolymathDB {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('IndexedDB error:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('IndexedDB initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Pending captures store
        if (!db.objectStoreNames.contains('pending-captures')) {
          const capturesStore = db.createObjectStore('pending-captures', {
            keyPath: 'id',
            autoIncrement: true
          })
          capturesStore.createIndex('timestamp', 'timestamp', { unique: false })
          capturesStore.createIndex('synced', 'synced', { unique: false })
        }

        // Cached memories store
        if (!db.objectStoreNames.contains('memories')) {
          const memoriesStore = db.createObjectStore('memories', {
            keyPath: 'id'
          })
          memoriesStore.createIndex('cached_at', 'cached_at', { unique: false })
        }

        console.log('IndexedDB schema created')
      }
    })
  }

  // Pending Captures
  async addPendingCapture(transcript: string): Promise<number> {
    await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pending-captures'], 'readwrite')
      const store = tx.objectStore('pending-captures')

      const capture: PendingCapture = {
        transcript,
        timestamp: Date.now(),
        synced: false,
        retries: 0
      }

      const request = store.add(capture)
      request.onsuccess = () => resolve(request.result as number)
      request.onerror = () => reject(request.error)
    })
  }

  async getPendingCaptures(): Promise<PendingCapture[]> {
    await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pending-captures'], 'readonly')
      const store = tx.objectStore('pending-captures')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async deletePendingCapture(id: number): Promise<void> {
    await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pending-captures'], 'readwrite')
      const store = tx.objectStore('pending-captures')
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getPendingCaptureCount(): Promise<number> {
    await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pending-captures'], 'readonly')
      const store = tx.objectStore('pending-captures')
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Cached Memories
  async cacheMemory(memory: Omit<CachedMemory, 'cached_at'>): Promise<void> {
    await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['memories'], 'readwrite')
      const store = tx.objectStore('memories')

      const cachedMemory: CachedMemory = {
        ...memory,
        cached_at: Date.now()
      }

      const request = store.put(cachedMemory)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getCachedMemories(): Promise<CachedMemory[]> {
    await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['memories'], 'readonly')
      const store = tx.objectStore('memories')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async clearOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.init()
    const cutoff = Date.now() - maxAge

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['memories'], 'readwrite')
      const store = tx.objectStore('memories')
      const index = store.index('cached_at')
      const request = index.openCursor()

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          if (cursor.value.cached_at < cutoff) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => reject(request.error)
    })
  }
}

// Singleton instance
export const db = new PolymathDB()
