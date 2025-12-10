import { useState, useEffect, useCallback } from 'react'
import type { Article, ArticleHighlight } from '../types/reading'
import { readingDb } from '../lib/db'

export function useArticle(id: string | undefined) {
  const [data, setData] = useState<{ article: Article | null, highlights: ArticleHighlight[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchArticle = useCallback(async (articleId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. Try fetching from network if online
      if (navigator.onLine) {
        try {
          const response = await fetch(`/api/reading?id=${articleId}`)
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const result = await response.json()
          
          // API returns { article, highlights } directly or inside { success: true, ... }
          // Handle both formats to be safe
          const articleData = result.article || result
          const highlightsData = result.highlights || []

          if (articleData) {
            setData({
              article: articleData,
              highlights: highlightsData
            })
            setIsLoading(false)
            return
          }
        } catch (apiError) {
          console.warn('[useArticle] API fetch failed, falling back to cache:', apiError)
          // Fall through to offline cache
        }
      }

      // 2. Offline fallback: Fetch from IndexedDB
      console.log('[useArticle] Attempting to load from offline cache...')
      const cachedArticle = await readingDb.articles.get(articleId)
      
      if (cachedArticle) {
        // Fetch associated highlights
        const cachedHighlights = await readingDb.highlights
          .where('article_id')
          .equals(articleId)
          .toArray()

        setData({
          article: cachedArticle as Article,
          highlights: cachedHighlights as ArticleHighlight[]
        })
        console.log('[useArticle] Loaded from offline cache')
      } else {
        throw new Error('Article not found in cache or on server')
      }

    } catch (err) {
      console.error('[useArticle] Failed to load article:', err)
      setError(err instanceof Error ? err.message : 'Failed to load article')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (id) {
      fetchArticle(id)
    } else {
      setIsLoading(false)
    }
  }, [id, fetchArticle])

  return {
    data,
    isLoading,
    error,
    refetch: () => id && fetchArticle(id)
  }
}
