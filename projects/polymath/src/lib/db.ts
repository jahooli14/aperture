/**
 * Unified Dexie.js Database for Offline Storage
 * Combines reading list, pending captures, and memory cache
 */

import Dexie, { Table } from 'dexie'
import type { Article, ArticleHighlight } from '../types/reading'

// --- Interfaces from ReadingDatabase ---

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

// --- Interfaces from ClandestinedDB ---

export interface PendingCapture {
  id?: number
  transcript: string
  timestamp: number
  synced: boolean
  retries?: number
}

export interface CachedMemory {
  id: string
  title: string
  body: string
  tags: string[]
  themes: string[]
  created_at: string
  cached_at: number
}

// Cached Project interface
export interface CachedProject {
  id: string
  user_id: string
  title: string
  description: string | null
  status: string
  last_active: string
  created_at: string
  updated_at?: string
  is_priority?: boolean
  metadata?: any
  cached_at: string
}

export class RosetteDatabase extends Dexie {
  // Reading Tables
  articles!: Table<CachedArticle, string>
  images!: Table<CachedImage, number>
  highlights!: Table<ArticleHighlight, string>
  progress!: Table<ReadingProgress, number>

  // Project Tables
  projects!: Table<CachedProject, string>

  // Capture & Memory Tables
  pendingCaptures!: Table<PendingCapture, number>
  memories!: Table<CachedMemory, string>
  
  // New Tables for Connections and Dashboard
  connections!: Table<any, string>
  dashboard!: Table<any, string>

  constructor() {
    super('RosetteDB') // New DB name to ensure clean migration

    // Define database schema
    this.version(1).stores({
      // Reading
      articles: 'id, user_id, status, created_at, last_synced, offline_available',
      images: '++id, article_id, url, cached_at',
      highlights: 'id, article_id, created_at',
      progress: '++id, article_id, updated_at',

      // Projects
      projects: 'id, status, is_priority, updated_at, last_active',

      // Captures
      pendingCaptures: '++id, timestamp, synced',

      // Memories Cache
      memories: 'id, cached_at',
      
      // Connections & Dashboard
      connections: 'id, source_id, target_id, type',
      dashboard: 'id, updated_at'
    })
  }

  // --- Reading Methods ---

  async cacheArticle(article: Article): Promise<void> {
    const cachedArticle: CachedArticle = {
      ...article,
      offline_available: true,
      images_cached: false,
      last_synced: new Date().toISOString()
    }
    await this.articles.put(cachedArticle)
  }

  async cacheImage(articleId: string, url: string, blob: Blob): Promise<void> {
    await this.images.add({
      article_id: articleId,
      url,
      blob,
      content_type: blob.type,
      cached_at: new Date().toISOString()
    })
  }

  async getCachedImage(url: string): Promise<CachedImage | undefined> {
    return await this.images.where('url').equals(url).first()
  }

  async getArticleImages(articleId: string): Promise<CachedImage[]> {
    return await this.images.where('article_id').equals(articleId).toArray()
  }

  async markImagesCached(articleId: string): Promise<void> {
    await this.articles.update(articleId, { images_cached: true })
  }

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

  async getProgress(articleId: string): Promise<ReadingProgress | undefined> {
    return await this.progress.where('article_id').equals(articleId).first()
  }

  async clearArticleCache(articleId: string): Promise<void> {
    await this.articles.delete(articleId)
    await this.images.where('article_id').equals(articleId).delete()
    await this.highlights.where('article_id').equals(articleId).delete()
    const progress = await this.progress.where('article_id').equals(articleId).first()
    if (progress?.id) {
      await this.progress.delete(progress.id)
    }
  }

  async getCacheSize(): Promise<number> {
    const images = await this.images.toArray()
    return images.reduce((total, img) => total + img.blob.size, 0)
  }

  async cleanupOldCache(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffISO = cutoffDate.toISOString()

    const deletedImages = await this.images.where('cached_at').below(cutoffISO).delete()
    const deletedArticles = await this.articles
      .where('last_synced').below(cutoffISO)
      .and(article => article.status === 'archived')
      .delete()

    return deletedImages + deletedArticles
  }

  // --- Pending Capture Methods ---

  async addPendingCapture(transcript: string): Promise<number> {
    return await this.pendingCaptures.add({
      transcript,
      timestamp: Date.now(),
      synced: false,
      retries: 0
    })
  }

  async getPendingCaptures(): Promise<PendingCapture[]> {
    return await this.pendingCaptures.toArray()
  }

  async deletePendingCapture(id: number): Promise<void> {
    await this.pendingCaptures.delete(id)
  }

  async getPendingCaptureCount(): Promise<number> {
    return await this.pendingCaptures.count()
  }

  async clearAllPendingCaptures(): Promise<void> {
    await this.pendingCaptures.clear()
  }

  // --- Memory Cache Methods ---

  async cacheMemory(memory: Omit<CachedMemory, 'cached_at'>): Promise<void> {
    await this.memories.put({
      ...memory,
      cached_at: Date.now()
    })
  }

  async bulkCacheMemories(memories: Omit<CachedMemory, 'cached_at'>[]): Promise<void> {
    const timestamp = Date.now()
    const cachedMemories = memories.map(m => ({
      ...m,
      cached_at: timestamp
    }))
    await this.memories.bulkPut(cachedMemories)
  }

  async getCachedMemories(): Promise<CachedMemory[]> {
    return await this.memories.toArray()
  }

  async clearOldMemoryCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge
    await this.memories.where('cached_at').below(cutoff).delete()
  }

  // --- Project Cache Methods ---

  async cacheProjects(projects: any[]): Promise<void> {
    const cachedProjects: CachedProject[] = projects.map(p => ({
      ...p,
      cached_at: new Date().toISOString()
    }))
    await this.projects.bulkPut(cachedProjects)
  }

  async getCachedProjects(): Promise<CachedProject[]> {
    return await this.projects.toArray()
  }
  
  // --- Connections & Dashboard Methods ---
  
  async cacheConnections(connections: any[]): Promise<void> {
    await this.connections.bulkPut(connections)
  }
  
  async getConnectionsFor(id: string): Promise<any[]> {
    // Dexie or queries: manually filter for now as OR queries are complex without multi-entry index
    // Ideally: this.connections.where('source_id').equals(id).or('target_id').equals(id).toArray()
    const source = await this.connections.where('source_id').equals(id).toArray()
    const target = await this.connections.where('target_id').equals(id).toArray()
    
    // De-dupe by ID
    const map = new Map()
    source.forEach(c => map.set(c.id, c))
    target.forEach(c => map.set(c.id, c))
    
    return Array.from(map.values())
  }
  
  async cacheDashboard(key: string, data: any): Promise<void> {
    await this.dashboard.put({
      id: key,
      data,
      updated_at: new Date().toISOString()
    })
  }
  
  async getDashboard(key: string): Promise<any | null> {
    const entry = await this.dashboard.get(key)
    return entry ? entry.data : null
  }
}

// Export singleton instance
export const db = new RosetteDatabase()

// Export alias for backward compatibility during migration (optional, but helpful)
export const readingDb = db