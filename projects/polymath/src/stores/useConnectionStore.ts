/**
 * Connection Cache Store
 * Caches fetched connections by item so ConnectionsList avoids redundant fetches.
 */

import { create } from 'zustand'
import type { ItemConnection } from '../types'
import { CACHE_TTL } from '../lib/cacheConfig'

interface ConnectionCache {
  connections: ItemConnection[]
  timestamp: number
}

interface ConnectionState {
  connectionsCache: Map<string, ConnectionCache>
  getConnections: (itemType: string, itemId: string) => ItemConnection[] | null
  setConnections: (itemType: string, itemId: string, connections: ItemConnection[]) => void
  invalidateConnections: (itemType: string, itemId: string) => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connectionsCache: new Map(),

  getConnections: (itemType: string, itemId: string) => {
    const cache = get().connectionsCache
    const key = `${itemType}-${itemId}`
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.connections
    }
    return null
  },

  setConnections: (itemType: string, itemId: string, connections: ItemConnection[]) => {
    const cache = new Map(get().connectionsCache)
    cache.set(`${itemType}-${itemId}`, { connections, timestamp: Date.now() })
    set({ connectionsCache: cache })
  },

  invalidateConnections: (itemType: string, itemId: string) => {
    const cache = new Map(get().connectionsCache)
    cache.delete(`${itemType}-${itemId}`)
    set({ connectionsCache: cache })
  }
}))
