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

  // Actions
  fetchArticles: (status?: ArticleStatus, force?: boolean) => Promise<void>
  saveArticle: (request: SaveArticleRequest) => Promise<Article>
  updateArticle: (id: string, updates: Partial<Pick<Article, 'title' | 'excerpt' | 'tags' | 'notes'>>) => Promise<void>
  updateArticleStatus: (id: string, status: ArticleStatus) => Promise<void>
  deleteArticle: (id: string) => Promise<void>
  setFilter: (filter: ArticleStatus | 'all') => void
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  articles: [],
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
    set({ loading: true, error: null })

    try {
      const response = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        // Check if response is HTML (API not deployed)
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('text/html')) {
          throw new Error('API not available. Please check that serverless functions are deployed.')
        }

        try {
          const errorData = await response.json()
          throw new Error(errorData.details || errorData.error || 'Failed to save article')
        } catch (jsonError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }
      }

      const { article } = await response.json()

      // Add to articles list and update cache timestamp
      set((state) => ({
        articles: [article, ...state.articles],
        loading: false,
        lastFetched: Date.now(),
      }))

      return article
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage, loading: false })
      console.error('[useReadingStore] Save article error:', error)
      throw error
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
}))
