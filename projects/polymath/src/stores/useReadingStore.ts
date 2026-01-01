/**
 * Reading Queue Store
 * Manages state for saved articles and reading list
 */

import { create } from 'zustand'
import type { Article, ArticleStatus, SaveArticleRequest } from '../types/reading'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'

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
  updateArticle: (id: string, updates: Partial<Article>) => Promise<void>
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
        } catch (cacheError) {
          console.warn('[ReadingStore] Failed to auto-cache articles:', cacheError)
        }

        // INTELLIGENT DEDUPLICATION & PENDING CLEANUP
        // 1. Identify which pending articles are now in the server response
        const serverUrls = new Set(articles.map((a: any) => a.url))
        const serverTitles = new Set(articles.map((a: any) => a.title))

        const currentPending = get().pendingArticles
        const remainingPending = currentPending.filter(pending => {
          // If server has this URL, it's saved. Remove from pending.
          if (serverUrls.has(pending.url)) return false
          // If server has this Title (and it's not a generic URL title), it's saved.
          if (pending.title && pending.title !== pending.url && serverTitles.has(pending.title)) return false

          return true
        })

        // 2. Update local storage if pending list changed
        if (remainingPending.length !== currentPending.length) {
          console.log(`[ReadingStore] cleaned up ${currentPending.length - remainingPending.length} pending articles`)
          localStorage.setItem('pending-articles', JSON.stringify(remainingPending))
          set({ pendingArticles: remainingPending })
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

        // 5. Trigger offline sync in background
        const { syncAllArticlesForOffline } = await import('../lib/offlineSync')
        syncAllArticlesForOffline(articles).catch(console.error)

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
        processed: !!(request.content),
        author: null,
        content: request.content || null,
        excerpt: request.excerpt || null,
        published_date: null,
        read_time_minutes: request.content ? Math.ceil(request.content.length / 1000) : null,
        thumbnail_url: null,
        favicon_url: null,
        source: null,
        read_at: null,
        archived_at: null,
        word_count: request.content ? request.content.split(/\s+/).length : null,
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

        // CRITICAL: Cache optimistic article in valid DB format immediately
        // This allows useArticle() to find it on the ReaderPage instantly
        const { readingDb } = await import('../lib/db')
        await readingDb.articles.put({
          ...optimisticArticle,
          offline_available: true,
          images_cached: false,
          last_synced: new Date().toISOString()
        })
        console.log('[ReadingStore] Optimistic article cached:', optimisticArticle.id)
      } catch (e) {
        console.error('Failed to save pending/optimistic:', e)
      }

      try {
        const response = await fetch('/api/reading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: request.url,
            title: request.title,
            tags: request.tags,
            content: request.content,
            excerpt: request.excerpt
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to save to API')
        }

        const { article: rawArticle } = await response.json()

        // HYDRATION FIX: If running locally against old PROD API, the returned article might have null content.
        // We MUST inject our local optimistic content into the "real" article before caching/returning it.
        const article = {
          ...rawArticle,
          content: rawArticle.content || request.content || null,
          excerpt: rawArticle.excerpt || request.excerpt || null,
          processed: !!(rawArticle.content || request.content) // Treat as processed if we have content
        }

        // Cache the REAL article (replacing optimistic one)
        try {
          const { readingDb } = await import('../lib/db')

          // Remove optimistic version first if IDs differ
          if (article.id !== tempId) {
            await readingDb.articles.delete(tempId)
          }

          await readingDb.articles.put({
            ...article,
            offline_available: true,
            images_cached: false,
            last_synced: new Date().toISOString()
          })
        } catch (cacheError) {
          console.warn('[ReadingStore] Failed to cache real article:', cacheError)
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

        // Synchronize for offline immediately
        const { syncArticleForOffline } = await import('../lib/offlineSync')
        syncArticleForOffline(article).catch(console.error)

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

    updateArticle: async (id: string, updates: Partial<Article>) => {
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

      // If offline, queue operation and return (optimistic update already done)
      const { isOnline } = useOfflineStore.getState()
      if (!isOnline) {
        await queueOperation('update_article', { id, status })
        await useOfflineStore.getState().updateQueueSize()
        console.log('[ReadingStore] Article status update queued for offline sync')
        return
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

      // If it's a temporary item (optimistic), just remove from pending
      if (id.startsWith('temp-')) {
        set((state) => {
          const newPending = state.pendingArticles.filter((a) => a.id !== id)
          localStorage.setItem('pending-articles', JSON.stringify(newPending))
          return { pendingArticles: newPending }
        })
        return
      }

      // If offline, queue operation and return (optimistic update already done)
      const { isOnline } = useOfflineStore.getState()
      if (!isOnline) {
        await queueOperation('delete_article', { id })
        await useOfflineStore.getState().updateQueueSize()
        console.log('[ReadingStore] Article deletion queued for offline sync')
        return
      }

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
