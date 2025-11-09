/**
 * Connection Suggestions Store
 * Manages real-time connection suggestions and caches connections
 */

import { create } from 'zustand'
import type { ItemConnection } from '../types'

export interface ConnectionSuggestion {
  targetId: string
  targetType: 'memory' | 'project' | 'article'
  targetTitle: string
  reason: string
  confidence: number
  snippet?: string
}

interface ConnectionCache {
  connections: ItemConnection[]
  timestamp: number
}

interface ConnectionState {
  suggestions: ConnectionSuggestion[]
  sourceId: string | null
  sourceType: 'memory' | 'article' | null
  loading: boolean

  // Connection cache by "type-id" key
  connectionsCache: Map<string, ConnectionCache>

  // Actions
  fetchSuggestions: (sourceType: 'memory' | 'article', sourceId: string, content: string, title?: string) => Promise<void>
  clearSuggestions: () => void
  getConnections: (itemType: string, itemId: string) => ItemConnection[] | null
  setConnections: (itemType: string, itemId: string, connections: ItemConnection[]) => void
  invalidateConnections: (itemType: string, itemId: string) => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  suggestions: [],
  sourceId: null,
  sourceType: null,
  loading: false,
  connectionsCache: new Map(),

  fetchSuggestions: async (sourceType, sourceId, content, title) => {
    set({ loading: true })

    try {
      const response = await fetch('/api/connections?action=suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: sourceType,
          contentId: sourceId,
          contentText: content,
          contentTitle: title
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch connection suggestions')
      }

      const { suggestions } = await response.json()

      set({
        suggestions,
        sourceId,
        sourceType,
        loading: false
      })
    } catch (error) {
      console.error('[ConnectionStore] Error fetching suggestions:', error)
      set({ loading: false })
    }
  },

  clearSuggestions: () => {
    set({
      suggestions: [],
      sourceId: null,
      sourceType: null
    })
  },

  getConnections: (itemType: string, itemId: string) => {
    const cache = get().connectionsCache
    const key = `${itemType}-${itemId}`
    const cached = cache.get(key)

    // Cache valid for 5 minutes
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.connections
    }

    return null
  },

  setConnections: (itemType: string, itemId: string, connections: ItemConnection[]) => {
    const cache = new Map(get().connectionsCache)
    const key = `${itemType}-${itemId}`
    cache.set(key, {
      connections,
      timestamp: Date.now()
    })
    set({ connectionsCache: cache })
  },

  invalidateConnections: (itemType: string, itemId: string) => {
    const cache = new Map(get().connectionsCache)
    const key = `${itemType}-${itemId}`
    cache.delete(key)
    set({ connectionsCache: cache })
  }
}))
