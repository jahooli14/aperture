import { readingDb } from '../db'
import type { Article } from '../../types/reading'

export class OfflineContentManager {
  private static instance: OfflineContentManager

  private constructor() {}

  public static getInstance(): OfflineContentManager {
    if (!OfflineContentManager.instance) {
      OfflineContentManager.instance = new OfflineContentManager()
    }
    return OfflineContentManager.instance
  }

  /**
   * Check if article is fully cached (including images)
   */
  public async isFullyCached(articleId: string): Promise<boolean> {
    const cached = await readingDb.articles.get(articleId)
    return !!(cached?.offline_available && cached?.images_cached)
  }

  /**
   * Check if article content is cached (readable offline, even without all images)
   */
  public async isContentCached(articleId: string): Promise<boolean> {
    const cached = await readingDb.articles.get(articleId)
    return !!(cached?.offline_available && cached?.content)
  }

  /**
   * Download article and all its images for offline reading
   */
  public async downloadArticle(article: Article): Promise<void> {
    if (!article.content) {
      console.warn('[OfflineContentManager] Article has no content, skipping download:', article.title)
      // Cache metadata at least
      await readingDb.cacheArticle(article)
      return
    }

    try {
      console.log('[OfflineContentManager] Starting download for:', article.title)
      
      // 1. Cache the article text/metadata
      await readingDb.cacheArticle(article)

      // 2. Download and cache all images
      const allImagesCached = await this.downloadImages(article.id, article.content)

      // 3. Mark images as cached ONLY if all were successful
      if (allImagesCached) {
        await readingDb.markImagesCached(article.id)
        console.log('[OfflineContentManager] ✓ Successfully cached:', article.title)
      } else {
        // If not all images cached, we might still want to mark article content as available
        // but reflect partial image caching if a separate flag exists, or keep images_cached=false
        // For now, only mark fully cached if all images are present.
        await readingDb.articles.update(article.id, { images_cached: false })
        console.warn(`[OfflineContentManager] Article ${article.title} partially cached (some images failed).`)
      }
    } catch (error) {
      console.error('[OfflineContentManager] Failed to cache article:', error)
      throw error
    }
  }

  /**
   * Download all images in article content and cache them
   * Returns true if all images were successfully downloaded and cached, false otherwise.
   */
  private async downloadImages(articleId: string, content: string): Promise<boolean> {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const images = doc.querySelectorAll('img')
    
    const imageUrlsToDownload = new Set<string>()

    images.forEach(img => {
      // Get src
      const src = img.getAttribute('src')
      if (src) imageUrlsToDownload.add(src)

      // Get srcset
      const srcset = img.getAttribute('srcset')
      if (srcset) {
        // Parse srcset to extract all URLs
        // Regex to match URLs in srcset: (?:^|\s)(\S+?)(?:\s+\d+[wx])?(?:$|,)
        // This regex captures the URL, optionally followed by a descriptor (e.g., 100w, 2x)
        const matches = srcset.matchAll(/(?:^|\s)(\S+?)(?:\s+\d+[wx])?(?:$|,)/g)
        for (const match of matches) {
          const url = match[1]?.trim()
          if (url) imageUrlsToDownload.add(url)
        }
      }
    })

    const totalImages = imageUrlsToDownload.size

    if (totalImages === 0) return true // No images to download, consider it successful

    console.log(`[OfflineContentManager] Found ${totalImages} unique images to download for article ${articleId}`)

    const downloadPromises = Array.from(imageUrlsToDownload).map(async (url) => {
      // Make relative URLs absolute
      let absoluteUrl = url
      // This is a server-side component, so URL parsing might need base URL if `article.url` is available
      // For now, assume content has absolute URLs or they resolve correctly in fetch.
      // If we move this to client-side, browser handles relative URLs automatically.
      // Since this is client-side, fetch will resolve relative URLs automatically.

      try {
        // Check if already cached
        const cached = await readingDb.getCachedImage(absoluteUrl)
        if (cached) return true // Already cached, consider it success

        // Download image
        const response = await fetch(absoluteUrl)
        if (!response.ok) throw new Error(`Failed to fetch ${absoluteUrl}`)

        const blob = await response.blob()

        // Cache in IndexedDB
        await readingDb.cacheImage(articleId, absoluteUrl, blob)
        console.log(`[OfflineContentManager] ✓ Cached image: ${absoluteUrl.substring(0, 50)}...`)
        return true
      } catch (error) {
        console.warn(`[OfflineContentManager] ✗ Failed to cache image ${absoluteUrl}:`, error)
        return false // Indicate failure for this specific image
      }
    })

    const results = await Promise.allSettled(downloadPromises)
    const allSuccessful = results.every(result => result.status === 'fulfilled' && result.value === true)
    
    if (allSuccessful) {
      console.log(`[OfflineContentManager] ✓ All ${totalImages} images successfully cached for article ${articleId}.`)
    } else {
      const failedCount = results.filter(result => result.status === 'rejected' || result.value === false).length
      console.warn(`[OfflineContentManager] ✗ ${failedCount} images failed to cache for article ${articleId}.`)
    }
    return allSuccessful
  }

  /**
   * Get cached images as blob URLs for rendering
   */
  public async getCachedImageUrls(articleId: string): Promise<Map<string, string>> {
    const images = await readingDb.getArticleImages(articleId)
    const imageMap = new Map<string, string>()

    for (const img of images) {
      // Create blob URL for rendering
      const blobUrl = URL.createObjectURL(img.blob)
      imageMap.set(img.url, blobUrl)
    }

    return imageMap
  }
}

export const offlineContentManager = OfflineContentManager.getInstance()
