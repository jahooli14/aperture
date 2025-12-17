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
  offlineMode: boolean

  pendingArticles: Article[]

  // Actions
  fetchArticles: (status?: ArticleStatus, force?: boolean) => Promise<void>
  saveArticle: (request: SaveArticleRequest) => Promise<Article>
  updateArticle: (id: string, updates: Partial<Pick<Article, 'title' | 'excerpt' | 'tags' | 'notes'>>) => Promise<void>
  updateArticleStatus: (id: string, status: ArticleStatus) => Promise<void>
  deleteArticle: (id: string) => Promise<void>
  setFilter: (filter: ArticleStatus | 'all') => void
  syncPendingArticles: () => Promise<void>
  // React Query Sync Actions
  setArticles: (articles: Article[]) => void
  setLoading: (loading: boolean) => void
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
    offlineMode: false,

    fetchArticles: async (status?: ArticleStatus, force = false) => {
      const state = get()
      const now = Date.now()
      const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

      // 1. In-memory cache check (fastest)
      if (!force && state.articles.length > 0 && state.lastFetched && (now - state.lastFetched < CACHE_DURATION)) {
        console.log('[ReadingStore] Using in-memory cache')
        return
      }

      set({ loading: true, error: null })

      const { readingDb } = await import('../lib/db')

      // 2. Local DB check (Stale-While-Revalidate)
      try {
        const cachedArticles = await readingDb.articles.toArray()
        const filtered = status
          ? cachedArticles.filter(a => a.status === status)
          : cachedArticles

        if (filtered.length > 0) {
          console.log(`[ReadingStore] Loaded ${filtered.length} articles from local DB (SWR)`)
          set({
            articles: filtered,
            loading: false, // Show data immediately
            error: null
          })
        }
      } catch (dbError) {
        console.warn('[ReadingStore] Failed to load from DB:', dbError)
      }

      // 3. Network Fetch (Background Sync)
      if (!navigator.onLine) {
        set({ offlineMode: true, loading: false }) // Stop loading if we are offline
        return
      }

      try {
        const params = new URLSearchParams()
        if (status) params.append('status', status)

        const response = await fetch(`/api/reading?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch articles')
        }

        const { articles } = await response.json()

        // 4. Update Cache & State
        try {
          // Map to CachedArticle type
          const cachedArticles = articles.map((a: any) => ({
            ...a,
            offline_available: true,
            images_cached: false,
            last_synced: new Date().toISOString()
          }))

          await readingDb.articles.bulkPut(cachedArticles)
          // Optional: Prune deleted items if needed, but bulkPut updates existing
        } catch (cacheError) {
          console.warn('[ReadingStore] Failed to auto-cache articles:', cacheError)
        }

        // Check against current state to avoid unnecessary renders
        const currentArticles = get().articles

        // Simple length check + id check optimization
        const hasChanges =
          articles.length !== currentArticles.length ||
          !articles.every((a: any, i: number) => a.id === currentArticles[i]?.id)

        if (hasChanges || force || currentArticles.length === 0) {
          set({ articles, loading: false, lastFetched: now, offlineMode: false })
        } else {
          set({ loading: false, lastFetched: now, offlineMode: false })
        }

      } catch (error) {
        console.error('[ReadingStore] Network fetch failed:', error)
        // We might already have data from DB, so don't wipe it with an error screen
        // Just set the error flag lightly or toast
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Only set global error if we have NO data
        if (get().articles.length === 0) {
          set({ error: errorMessage, loading: false })
        } else {
          // We have stale data, just stop loading
          set({ loading: false })
        }
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

        // Cache the new article
        try {
          const { readingDb } = await import('../lib/db')
          await readingDb.articles.put({
            ...article,
            offline_available: true,
            images_cached: false,
            last_synced: new Date().toISOString()
          })
        } catch (cacheError) {
          console.warn('[ReadingStore] Failed to cache new article:', cacheError)
        }

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

            // Cache synced article
            try {
              const { readingDb } = await import('../lib/db')
              await readingDb.articles.put({
                ...savedArticle,
                offline_available: true,
                images_cached: false,
                last_synced: new Date().toISOString()
              })
            } catch (cacheError) {
              console.warn('[ReadingStore] Failed to cache synced article:', cacheError)
            }

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
      const updatedArticle = previousArticles.find(a => a.id === id)

      if (updatedArticle) {
        const newArticle = { ...updatedArticle, ...updates }
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id ? newArticle : a
          ),
        }))

        // Update cache optimistically
        try {
          const { readingDb } = await import('../lib/db')
          const cached = await readingDb.articles.get(id)
          if (cached) {
            await readingDb.articles.put({ ...cached, ...updates })
          }
        } catch (cacheError) {
          console.warn('[ReadingStore] Failed to update cached article:', cacheError)
        }
      }

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

        // Update cache with server response
        try {
          const { readingDb } = await import('../lib/db')
          const cached = await readingDb.articles.get(id)
          if (cached) {
            await readingDb.articles.put({ ...cached, ...article })
          }
        } catch (cacheError) {
          console.warn('[ReadingStore] Failed to update cached article from server:', cacheError)
        }

        // Replace with server data
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id ? article : a
          ),
        }))
      } catch (error) {
        // Rollback on error
        set({ articles: previousArticles })
        // Revert cache if possible (complex, maybe skip for now or re-fetch)
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

        // Update cache optimistically
        try {
          const { readingDb } = await import('../lib/db')
          const cached = await readingDb.articles.get(id)
          if (cached) {
            await readingDb.articles.put({ ...cached, status })
          }
        } catch (cacheError) {
          console.warn('[ReadingStore] Failed to update cached article status:', cacheError)
        }
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

        // Update cache with server response
        try {
          const { readingDb } = await import('../lib/db')
          const cached = await readingDb.articles.get(id)
          if (cached) {
            await readingDb.articles.put({ ...cached, ...article })
          }
        } catch (cacheError) {
          console.warn('[ReadingStore] Failed to update cached article status from server:', cacheError)
        }

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

      // Remove from cache optimistically
      try {
        const { readingDb } = await import('../lib/db')
        await readingDb.articles.delete(id)
      } catch (cacheError) {
        console.warn('[ReadingStore] Failed to delete cached article:', cacheError)
      }

      try {
        // If it's a temporary item (optimistic), don't hit the API
        if (id.startsWith('temp-')) {
          set((state) => {
            const newPending = state.pendingArticles.filter((a) => a.id !== id)
            localStorage.setItem('pending-articles', JSON.stringify(newPending))
            return { pendingArticles: newPending }
          })
          return
        }

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
    setArticles: (articles) => set({ articles }),
    setLoading: (loading) => set({ loading })
  }
})

// Setup auto-sync when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useReadingStore.getState().syncPendingArticles()
  })
}
