/**
 * RSS Feed Store
 * Manages state for RSS feed subscriptions
 */

import { create } from 'zustand'
import type { RSSFeed, SaveFeedRequest, UpdateFeedRequest } from '../types/rss'

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
}

export const useRSSStore = create<RSSState>((set, get) => ({
  feeds: [],
  loading: false,
  syncing: false,
  error: null,

  fetchFeeds: async () => {
    set({ loading: true, error: null })

    try {
      const response = await fetch('/api/reading?resource=rss')

      if (!response.ok) {
        throw new Error('Failed to fetch feeds')
      }

      const data = await response.json()
      const feeds = Array.isArray(data.feeds) ? data.feeds : []

      set({ feeds, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage, loading: false, feeds: [] })
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
      set((state) => ({
        feeds: [feed, ...(Array.isArray(state.feeds) ? state.feeds : [])],
        loading: false,
      }))

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
      set((state) => ({
        feeds: Array.isArray(state.feeds)
          ? state.feeds.map((f) => (f.id === request.id ? feed : f))
          : [feed],
      }))
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
      set((state) => ({
        feeds: Array.isArray(state.feeds)
          ? state.feeds.filter((f) => f.id !== id)
          : [],
      }))
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
