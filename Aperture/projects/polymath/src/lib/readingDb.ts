/**
 * Dexie.js Database for Offline Article Storage
 * Provides IndexedDB wrapper for caching articles and images locally
 */

import Dexie, { Table } from 'dexie'
import type { Article, ArticleHighlight } from '../types/reading'

// Extended Article interface for offline storage
export interface CachedArticle extends Article {
  // Track offline sync status
  offline_available: boolean
  images_cached: boolean
  last_synced: string
}

// Cached image blob
export interface CachedImage {
  id?: number
  article_id: string
  url: string
  blob: Blob
  content_type: string
  cached_at: string
}

// Reading progress tracking
export interface ReadingProgress {
  id?: number
  article_id: string
  scroll_position: number
  scroll_percentage: number
  last_position_text?: string // Text snippet at last position
  updated_at: string
}

export class ReadingDatabase extends Dexie {
  // Tables
  articles!: Table<CachedArticle, string>
  images!: Table<CachedImage, number>
  highlights!: Table<ArticleHighlight, string>
  progress!: Table<ReadingProgress, number>

  constructor() {
    super('PolymathReading')

    // Define database schema
    this.version(1).stores({
      articles: 'id, user_id, status, created_at, last_synced, offline_available',
      images: '++id, article_id, url, cached_at',
      highlights: 'id, article_id, created_at',
      progress: '++id, article_id, updated_at'
    })
  }

  /**
   * Cache an article for offline reading
   */
  async cacheArticle(article: Article): Promise<void> {
    const cachedArticle: CachedArticle = {
      ...article,
      offline_available: true,
      images_cached: false,
      last_synced: new Date().toISOString()
    }

    await this.articles.put(cachedArticle)
  }

  /**
   * Cache an image blob for offline access
   */
  async cacheImage(articleId: string, url: string, blob: Blob): Promise<void> {
    await this.images.add({
      article_id: articleId,
      url,
      blob,
      content_type: blob.type,
      cached_at: new Date().toISOString()
    })
  }

  /**
   * Get cached image for a URL
   */
  async getCachedImage(url: string): Promise<CachedImage | undefined> {
    return await this.images.where('url').equals(url).first()
  }

  /**
   * Get all cached images for an article
   */
  async getArticleImages(articleId: string): Promise<CachedImage[]> {
    return await this.images.where('article_id').equals(articleId).toArray()
  }

  /**
   * Mark article images as fully cached
   */
  async markImagesCached(articleId: string): Promise<void> {
    await this.articles.update(articleId, { images_cached: true })
  }

  /**
   * Save reading progress
   */
  async saveProgress(articleId: string, position: number, percentage: number, text?: string): Promise<void> {
    const existing = await this.progress.where('article_id').equals(articleId).first()

    const progressData: ReadingProgress = {
      article_id: articleId,
      scroll_position: position,
      scroll_percentage: percentage,
      last_position_text: text,
      updated_at: new Date().toISOString()
    }

    if (existing) {
      await this.progress.update(existing.id!, progressData)
    } else {
      await this.progress.add(progressData)
    }
  }

  /**
   * Get reading progress for an article
   */
  async getProgress(articleId: string): Promise<ReadingProgress | undefined> {
    return await this.progress.where('article_id').equals(articleId).first()
  }

  /**
   * Clear all cached data for an article
   */
  async clearArticleCache(articleId: string): Promise<void> {
    await this.articles.delete(articleId)
    await this.images.where('article_id').equals(articleId).delete()
    await this.highlights.where('article_id').equals(articleId).delete()
    const progress = await this.progress.where('article_id').equals(articleId).first()
    if (progress?.id) {
      await this.progress.delete(progress.id)
    }
  }

  /**
   * Get total cache size in bytes (approximate)
   */
  async getCacheSize(): Promise<number> {
    const images = await this.images.toArray()
    return images.reduce((total, img) => total + img.blob.size, 0)
  }

  /**
   * Clean up old cached data (keep last N days)
   */
  async cleanupOldCache(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffISO = cutoffDate.toISOString()

    // Delete old images
    const deletedImages = await this.images
      .where('cached_at')
      .below(cutoffISO)
      .delete()

    // Delete old articles that aren't saved/unread
    const deletedArticles = await this.articles
      .where('last_synced')
      .below(cutoffISO)
      .and(article => article.status === 'archived')
      .delete()

    return deletedImages + deletedArticles
  }
}

// Export singleton instance
export const readingDb = new ReadingDatabase()
