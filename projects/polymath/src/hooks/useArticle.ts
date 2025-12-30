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
      // 1. ALWAYS try cache first for instant loading (stale-while-revalidate)
      const cachedArticle = await readingDb.articles.get(articleId)

      if (cachedArticle && cachedArticle.content) {
        // Show cached content immediately
        const cachedHighlights = await readingDb.highlights
          .where('article_id')
          .equals(articleId)
          .toArray()

        setData({
          article: cachedArticle as Article,
          highlights: cachedHighlights as ArticleHighlight[]
        })
        console.log('[useArticle] Loaded from cache (instant)')
        setIsLoading(false)

        // If offline, we're done
        if (!navigator.onLine) {
          console.log('[useArticle] Offline - using cached version')
          return
        }

        // If online, revalidate in background (don't await)
        fetch(`/api/reading?id=${articleId}`)
          .then(async (response) => {
            if (response.ok) {
              const result = await response.json()
              const articleData = result.article || result
              const highlightsData = result.highlights || []

              // Intelligent Merge: Don't overwrite content if network returns null but we have it locally
              const mergedArticle = {
                ...articleData,
                content: articleData.content || cachedArticle.content,
                excerpt: articleData.excerpt || cachedArticle.excerpt,
                processed: articleData.processed || (!!cachedArticle.content && !articleData.content)
              }

              setData({
                article: mergedArticle,
                highlights: highlightsData
              })
              // Update cache silently
              readingDb.cacheArticle(mergedArticle).catch(console.warn)
            }
          })
          .catch((err) => console.warn('[useArticle] Background refresh failed:', err))

        return
      }

      // 2. No cache - must fetch from network
      if (!navigator.onLine) {
        throw new Error('Article not available offline')
      }

      console.log('[useArticle] No cache found, fetching from network...')
      const response = await fetch(`/api/reading?id=${articleId}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Vercel serverless bug: Sometimes API routes return HTML error pages (500/404)
      // We must safely check content type before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API returned non-JSON response (likely an error page)')
      }

      const result = await response.json()
      const articleData = result.article || result
      const highlightsData = result.highlights || []

      if (articleData) {
        setData({
          article: articleData,
          highlights: highlightsData
        })

        // Cache for offline
        readingDb.cacheArticle(articleData).catch(console.warn)
      } else {
        throw new Error('Article not found')
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
