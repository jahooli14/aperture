/**
 * Reading Queue Store
 * Manages state for saved articles and reading list
 */

import { create } from 'zustand'
import type { Article, ArticleStatus, SaveArticleRequest } from '../types/reading'

interface ReadingState {
  articles: Article[]
  loading: boolean
  error: string | null
  currentFilter: ArticleStatus | 'all'
  lastFetched: number | null

  pendingArticles: Article[]

  // Actions
  fetchArticles: (status?: ArticleStatus, force?: boolean) => Promise<void>
  saveArticle: (request: SaveArticleRequest) => Promise<Article>
  updateArticle: (id: string, updates: Partial<Pick<Article, 'title' | 'excerpt' | 'tags' | 'notes'>>) => Promise<void>
  updateArticleStatus: (id: string, status: ArticleStatus) => Promise<void>
  deleteArticle: (id: string) => Promise<void>
  setFilter: (filter: ArticleStatus | 'all') => void
  syncPendingArticles: () => Promise<void>
}

export const useReadingStore = create<ReadingState>((set, get) => {
  // Load pending articles from localStorage on init
  let initialPending: Article[] = []
  try {
    const stored = localStorage.getItem('pending-articles')
    if (stored) {
      initialPending = JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load pending articles:', e)
  }

  return {
    articles: [],
    pendingArticles: initialPending,
    loading: false,
    error: null,
    currentFilter: 'all',
    lastFetched: null,

    fetchArticles: async (status?: ArticleStatus, force = false) => {
      const state = get()
      const now = Date.now()
      const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

      // Skip if we have recent data and not forcing refresh
      if (!force && state.articles.length > 0 && state.lastFetched && (now - state.lastFetched < CACHE_DURATION)) {
        console.log('[ReadingStore] Using cached articles')
        return
      }

      // Only set loading if we're actually fetching
      set({ loading: true, error: null })

      try {
        const params = new URLSearchParams()
        if (status) params.append('status', status)

        const response = await fetch(`/api/reading?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch articles')
        }

        const { articles } = await response.json()

        // Skip update if data hasn't changed (prevent unnecessary re-renders)
        const currentArticles = get().articles
        if (currentArticles.length === articles.length && articles.length > 0) {
          // Create ID maps for efficient lookup
          const currentById = new Map(currentArticles.map((a: any) => [a.id, a]))

          // Check if same IDs exist
          const sameIds = articles.every((a: any) => currentById.has(a.id))

          if (sameIds) {
            // Check if status or title changed for any article
            const hasImportantChange = articles.some((a: any) => {
              const current = currentById.get(a.id)
              return current && (current.status !== a.status || current.title !== a.title)
            })

            if (!hasImportantChange) {
              console.log('[ReadingStore] Skipping state update - data unchanged')
              set({ loading: false }) // Still need to clear loading state
              return
            }
          }
        }

        set({ articles, loading: false, lastFetched: now })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        set({ error: errorMessage, loading: false })
      }
    },

    saveArticle: async (request: SaveArticleRequest) => {
      // Create optimistic article
      const tempId = `temp-${Date.now()}`
      const optimisticArticle: Article = {
        id: tempId,
        url: request.url,
        title: request.title || request.url,
        status: 'unread',
        created_at: new Date().toISOString(),
        tags: request.tags || [],
        user_id: 'current-user', // Placeholder
        processed: false,
        author: null,
        content: null,
        excerpt: null,
        published_date: null,
        read_time_minutes: null,
        thumbnail_url: null,
        favicon_url: null,
        source: null,
        read_at: null,
        archived_at: null,
        word_count: null,
        notes: null
      }

      // Add to pending articles immediately
      const currentPending = get().pendingArticles
      const newPending = [optimisticArticle, ...currentPending]

      set({
        pendingArticles: newPending,
        // Also add to main list for immediate UI feedback
        articles: [optimisticArticle, ...get().articles]
      })

      // Persist pending to localStorage
      try {
        localStorage.setItem('pending-articles', JSON.stringify(newPending))
      } catch (e) {
        console.error('Failed to save pending to localStorage:', e)
      }

      try {
        const response = await fetch('/api/reading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        if (!response.ok) {
          throw new Error('Failed to save to API')
        }

        const { article } = await response.json()

        // Success! Replace temp article with real one
        set((state) => {
          const filteredPending = state.pendingArticles.filter(a => a.id !== tempId)
          localStorage.setItem('pending-articles', JSON.stringify(filteredPending))

          return {
            pendingArticles: filteredPending,
            articles: state.articles.map(a => a.id === tempId ? article : a),
            lastFetched: Date.now(),
          }
        })

        return article
      } catch (error) {
        console.warn('[ReadingStore] Offline save - keeping in pending queue:', error)
        // Keep in pending, it's already there. 
        // We return the optimistic article so the UI can continue
        return optimisticArticle
      }
    },

    syncPendingArticles: async () => {
      const state = get()
      if (state.pendingArticles.length === 0) return

      console.log(`[ReadingStore] Syncing ${state.pendingArticles.length} pending articles...`)

      const remainingPending: Article[] = []
      let hasChanges = false

      for (const article of state.pendingArticles) {
        try {
          const response = await fetch('/api/reading', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: article.url,
              title: article.title && article.title !== article.url ? article.title : undefined,
              tags: article.tags
            }),
          })

          if (response.ok) {
            const { article: savedArticle } = await response.json()

            // Update the real article in the list
            set(s => ({
              articles: s.articles.map(a => a.id === article.id ? savedArticle : a)
            }))
            hasChanges = true
          } else {
            remainingPending.push(article)
          }
        } catch (e) {
          console.error(`[ReadingStore] Failed to sync article ${article.url}:`, e)
          remainingPending.push(article)
        }
      }

      if (hasChanges || remainingPending.length !== state.pendingArticles.length) {
        set({ pendingArticles: remainingPending })
        localStorage.setItem('pending-articles', JSON.stringify(remainingPending))

        // Refresh list if we synced everything
        if (remainingPending.length === 0) {
          get().fetchArticles(undefined, true)
        }
      }
    },

    updateArticle: async (id: string, updates: Partial<Pick<Article, 'title' | 'excerpt' | 'tags' | 'notes'>>) => {
      // Optimistic update
      const previousArticles = get().articles

      set((state) => ({
        articles: state.articles.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      }))

      try {
        const response = await fetch('/api/reading', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates }),
        })

        if (!response.ok) {
          throw new Error('Failed to update article')
        }

        const { article } = await response.json()

        // Replace with server data
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id ? article : a
          ),
        }))
      } catch (error) {
        // Rollback on error
        set({ articles: previousArticles })
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        set({ error: errorMessage })
        throw error
      }
    },

    updateArticleStatus: async (id: string, status: ArticleStatus) => {
      // Optimistic update - update UI immediately
      const previousArticles = get().articles
      const articleToUpdate = previousArticles.find((a) => a.id === id)

      if (articleToUpdate) {
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id ? { ...a, status } : a
          ),
        }))
      }

      try {
        const response = await fetch('/api/reading', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status }),
        })

        if (!response.ok) {
          throw new Error('Failed to update article')
        }

        const { article } = await response.json()

        // Replace with server data
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id ? article : a
          ),
        }))
      } catch (error) {
        // Rollback on error
        set({ articles: previousArticles })
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        set({ error: errorMessage })
        throw error
      }
    },

    deleteArticle: async (id: string) => {
      // Optimistic delete - remove from UI immediately
      const previousArticles = get().articles

      set((state) => ({
        articles: state.articles.filter((a) => a.id !== id),
      }))

      try {
        const response = await fetch(`/api/reading?id=${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error('Failed to delete article')
        }
      } catch (error) {
        // Rollback on error
        set({ articles: previousArticles })
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        set({ error: errorMessage })
        throw error
      }
    },

    setFilter: (filter: ArticleStatus | 'all') => {
      set({ currentFilter: filter })

      // Re-fetch with new filter
      if (filter === 'all') {
        get().fetchArticles()
      } else {
        get().fetchArticles(filter)
      }
    },
  }
})

// Setup auto-sync when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useReadingStore.getState().syncPendingArticles()
  })
}
