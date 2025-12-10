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
      await this.downloadImages(article.id, article.content)

      // 3. Mark images as cached
      await readingDb.markImagesCached(article.id)

      console.log('[OfflineContentManager] ✓ Successfully cached:', article.title)
    } catch (error) {
      console.error('[OfflineContentManager] Failed to cache article:', error)
      throw error
    }
  }

  /**
   * Download all images in article content and cache them
   */
  private async downloadImages(articleId: string, content: string): Promise<void> {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const images = doc.querySelectorAll('img')
    const totalImages = images.length

    if (totalImages === 0) return

    console.log(`[OfflineContentManager] Found ${totalImages} images to download`)

    const downloadPromises = Array.from(images).map(async (img) => {
      const src = img.getAttribute('src')
      if (!src) return

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
      } catch (error) {
        console.warn(`[OfflineContentManager] Failed to cache image ${src}:`, error)
        // Continue with other images even if one fails
      }
    })

    await Promise.allSettled(downloadPromises)
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
