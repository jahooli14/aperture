/**
 * RSS Feed Store
 * Manages state for RSS feed subscriptions
 */

import { create } from 'zustand'
import type { RSSFeed, SaveFeedRequest, UpdateFeedRequest } from '../types/rss'
import { readingDb } from '../lib/db'

interface RSSState {
  feeds: RSSFeed[]
  loading: boolean
  syncing: boolean
  error: string | null

  // Actions
  fetchFeeds: () => Promise<void>
  subscribeFeed: (request: SaveFeedRequest) => Promise<RSSFeed>
  updateFeed: (request: UpdateFeedRequest) => Promise<void>
  unsubscribeFeed: (id: string) => Promise<void>
  syncFeeds: () => Promise<{ feedsSynced: number; articlesAdded: number }>
  discoverFeeds: (query: string) => Promise<any[]>
}

export const useRSSStore = create<RSSState>((set, get) => ({
  feeds: [],
  loading: false,
  syncing: false,
  error: null,

  fetchFeeds: async () => {
    set({ loading: true, error: null })

    try {
      // 1. Load from cache first (instant)
      const cached = await readingDb.getDashboard('rss-feeds')
      if (cached && Array.isArray(cached)) {
        set({ feeds: cached, loading: false })
      }

      // 2. If offline, stop here
      if (!navigator.onLine) {
        if (!cached) set({ loading: false })
        return
      }

      // 3. Fetch fresh data from network
      const response = await fetch('/api/reading?resource=rss')

      if (!response.ok) {
        throw new Error('Failed to fetch feeds')
      }

      const data = await response.json()
      const feeds = Array.isArray(data.feeds) ? data.feeds : []

      set({ feeds, loading: false })

      // 4. Cache for offline use
      await readingDb.cacheDashboard('rss-feeds', feeds)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      // Only show error if we don't have cached data
      if (get().feeds.length === 0) {
        set({ error: errorMessage, loading: false })
      } else {
        set({ loading: false })
      }
      console.error('[useRSSStore] Fetch feeds error:', error)
    }
  },

  subscribeFeed: async (request: SaveFeedRequest) => {
    set({ loading: true, error: null })

    try {
      const response = await fetch('/api/reading?resource=rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('text/html')) {
          throw new Error('API not available. Please check that serverless functions are deployed.')
        }

        try {
          const errorData = await response.json()
          throw new Error(errorData.details || errorData.error || 'Failed to subscribe to feed')
        } catch (jsonError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }
      }

      const { feed } = await response.json()

      // Add to feeds list
      const updatedFeeds = [feed, ...(Array.isArray(get().feeds) ? get().feeds : [])]
      set({ feeds: updatedFeeds, loading: false })

      // Update cache
      await readingDb.cacheDashboard('rss-feeds', updatedFeeds)

      return feed
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage, loading: false })
      console.error('[useRSSStore] Subscribe feed error:', error)
      throw error
    }
  },

  updateFeed: async (request: UpdateFeedRequest) => {
    try {
      const response = await fetch('/api/reading?resource=rss', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error('Failed to update feed')
      }

      const { feed } = await response.json()

      // Update in local state
      const updatedFeeds = Array.isArray(get().feeds)
        ? get().feeds.map((f) => (f.id === request.id ? feed : f))
        : [feed]
      set({ feeds: updatedFeeds })

      // Update cache
      await readingDb.cacheDashboard('rss-feeds', updatedFeeds)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage })
      throw error
    }
  },

  unsubscribeFeed: async (id: string) => {
    try {
      const response = await fetch(`/api/reading?resource=rss&id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to unsubscribe from feed')
      }

      // Remove from local state
      const updatedFeeds = Array.isArray(get().feeds)
        ? get().feeds.filter((f) => f.id !== id)
        : []
      set({ feeds: updatedFeeds })

      // Update cache
      await readingDb.cacheDashboard('rss-feeds', updatedFeeds)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage })
      throw error
    }
  },

  syncFeeds: async () => {
    set({ syncing: true, error: null })

    try {
      const response = await fetch('/api/reading?resource=rss&action=sync', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to sync feeds')
      }

      const data = await response.json()

      set({ syncing: false })

      return {
        feedsSynced: data.feedsSynced || 0,
        articlesAdded: data.articlesAdded || 0
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage, syncing: false })
      throw error
    }
  },

  discoverFeeds: async (query: string) => {
    try {
      const response = await fetch(`/api/reading?resource=rss&action=discover&query=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.error('[RSS Store] Discover failed:', error)
      return []
    }
  },

  // Auto-sync feeds in background (throttled)
  autoSyncFeeds: async () => {
    const SYNC_INTERVAL = 2 * 60 * 60 * 1000 // 2 hours
    const lastSync = localStorage.getItem('rss_last_sync')
    const now = Date.now()

    // Check if we synced recently
    if (lastSync && now - parseInt(lastSync) < SYNC_INTERVAL) {
      console.log('[RSS] Skipping sync - last synced', Math.floor((now - parseInt(lastSync)) / 60000), 'minutes ago')
      return { feedsSynced: 0, articlesAdded: 0 }
    }

    // Don't show loading spinner for background sync
    try {
      const response = await fetch('/api/reading?resource=rss&action=sync', {
        method: 'POST',
      })

      if (!response.ok) {
        console.warn('[RSS] Background sync failed:', response.status)
        return { feedsSynced: 0, articlesAdded: 0 }
      }

      const data = await response.json()
      localStorage.setItem('rss_last_sync', now.toString())

      console.log('[RSS] Background sync complete:', data.articlesAdded, 'new articles')

      return {
        feedsSynced: data.feedsSynced || 0,
        articlesAdded: data.articlesAdded || 0
      }
    } catch (error) {
      console.warn('[RSS] Background sync error:', error)
      return { feedsSynced: 0, articlesAdded: 0 }
    }
  },
}))

// Export helper to add to interface
export type RSSStoreWithAutoSync = RSSState & {
  autoSyncFeeds: () => Promise<{ feedsSynced: number; articlesAdded: number }>
}
