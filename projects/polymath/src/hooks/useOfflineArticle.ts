/**
 * Hook for offline article caching and image downloading
 * Handles storing articles locally for offline reading
 */

import { useState, useCallback } from 'react'
import { readingDb } from '../lib/db'
import type { Article } from '../types/reading'

interface UseOfflineArticleResult {
  caching: boolean
  downloadForOffline: (article: Article) => Promise<void>
  isCached: (articleId: string) => Promise<boolean>
  getCachedImages: (articleId: string) => Promise<Map<string, string>>
  clearCache: (articleId: string) => Promise<void>
}

export function useOfflineArticle(): UseOfflineArticleResult {
  const [caching, setCaching] = useState(false)

  /**
   * Download all images in article content and cache them
   */
  const downloadImages = useCallback(async (articleId: string, content: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const images = doc.querySelectorAll('img')

    const downloadPromises = Array.from(images).map(async (img) => {
      const src = img.getAttribute('src')
      if (!src) return

      // Skip blob URLs - they're browser-specific and already in memory
      if (src.startsWith('blob:')) {
        console.log(`[Offline] Skipping blob URL: ${src}`)
        return
      }

      try {
        // Check if already cached
        const cached = await readingDb.getCachedImage(src)
        if (cached) return

        // Download image
        const response = await fetch(src)
        if (!response.ok) throw new Error(`Failed to fetch ${src}`)

        const blob = await response.blob()

        // Cache in IndexedDB
        await readingDb.cacheImage(articleId, src, blob)

        console.log(`[Offline] Cached image: ${src.substring(0, 50)}...`)
      } catch (error) {
        console.error(`[Offline] Failed to cache image ${src}:`, error)
        // Continue with other images even if one fails
      }
    })

    await Promise.allSettled(downloadPromises)
  }, [])

  /**
   * Download article and all its images for offline reading
   */
  const downloadForOffline = useCallback(async (article: Article) => {
    if (!article.content) {
      console.warn('[Offline] Article has no content')
      return
    }

    setCaching(true)

    try {
      // Cache the article
      await readingDb.cacheArticle(article)
      console.log('[Offline] Article cached:', article.title)

      // Download and cache all images
      await downloadImages(article.id, article.content)

      // Mark images as cached
      await readingDb.markImagesCached(article.id)

      console.log('[Offline] All images cached for:', article.title)
    } catch (error) {
      console.error('[Offline] Failed to cache article:', error)
      throw error
    } finally {
      setCaching(false)
    }
  }, [downloadImages])

  /**
   * Check if article is cached for offline reading
   * Returns true if article content is available (even if images aren't fully cached)
   */
  const isCached = useCallback(async (articleId: string): Promise<boolean> => {
    const cached = await readingDb.articles.get(articleId)
    // Article is readable offline if we have the content, even without images
    return !!(cached?.offline_available && cached?.content)
  }, [])

  /**
   * Get cached images as blob URLs for rendering
   */
  const getCachedImages = useCallback(async (articleId: string): Promise<Map<string, string>> => {
    const images = await readingDb.getArticleImages(articleId)
    const imageMap = new Map<string, string>()

    for (const img of images) {
      // Create blob URL for rendering
      const blobUrl = URL.createObjectURL(img.blob)
      imageMap.set(img.url, blobUrl)
    }

    return imageMap
  }, [])

  /**
   * Clear all cached data for an article
   */
  const clearCache = useCallback(async (articleId: string) => {
    await readingDb.clearArticleCache(articleId)
    console.log('[Offline] Cache cleared for article:', articleId)
  }, [])

  return {
    caching,
    downloadForOffline,
    isCached,
    getCachedImages,
    clearCache
  }
}
