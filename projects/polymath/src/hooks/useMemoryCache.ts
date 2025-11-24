/**
 * Hook to cache memories for offline reading
 * Automatically caches fetched memories and serves cached data when offline
 */

import { useEffect, useState } from 'react'
import { db, type CachedMemory } from '../lib/db'
import { useOnlineStatus } from './useOnlineStatus'
import type { Memory } from '../types'

export function useMemoryCache() {
  const { isOnline } = useOnlineStatus()
  const [cachedMemories, setCachedMemories] = useState<CachedMemory[]>([])
  const [isLoadingCache, setIsLoadingCache] = useState(false)

  // Load cached memories on mount
  useEffect(() => {
    loadCachedMemories()
  }, [])

  async function loadCachedMemories() {
    try {
      const cached = await db.getCachedMemories()
      setCachedMemories(cached)
    } catch (error) {
      console.error('Failed to load cached memories:', error)
    }
  }

  /**
   * Cache memories for offline access
   */
  async function cacheMemories(memories: Memory[]) {
    try {
      for (const memory of memories) {
        await db.cacheMemory({
          id: memory.id,
          title: memory.title,
          body: memory.body,
          tags: memory.tags || [],
          themes: memory.themes || [],
          created_at: memory.audiopen_created_at
        })
      }
      await loadCachedMemories()
      console.log(`✓ Cached ${memories.length} memories for offline access`)
    } catch (error) {
      console.error('Failed to cache memories:', error)
    }
  }

  /**
   * Fetch memories with automatic caching
   * Returns cached data if offline
   */
  async function fetchWithCache(url: string): Promise<{ memories: Memory[], fromCache: boolean }> {
    setIsLoadingCache(true)
    try {
      if (!isOnline) {
        // Offline: return cached data
        console.log('📱 Offline - serving cached memories')
        const cached = await db.getCachedMemories()
        return {
          memories: cached.map(c => ({
            id: c.id,
            title: c.title,
            body: c.body,
            tags: c.tags,
            themes: c.themes,
            audiopen_created_at: c.created_at,
            audiopen_id: c.id,
            orig_transcript: c.body,
            processed: true
          } as Memory)),
          fromCache: true
        }
      }

      // Online: fetch fresh data
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const memories = data.memories || []

      // Debug: log processing status
      const unprocessedCount = memories.filter((m: Memory) => !m.processed).length
      if (unprocessedCount > 0) {
        console.log(`⚠️ API returned ${unprocessedCount} unprocessed memories`)
        console.log('Sample unprocessed:', memories.find((m: Memory) => !m.processed))
      }

      // Cache the fetched memories
      if (memories.length > 0) {
        await cacheMemories(memories)
      }

      return { memories, fromCache: false }
    } catch (error) {
      console.error('Fetch failed, falling back to cache:', error)

      // Network error: try cache as fallback
      const cached = await db.getCachedMemories()
      return {
        memories: cached.map(c => ({
          id: c.id,
          title: c.title,
          body: c.body,
          tags: c.tags,
          themes: c.themes,
          audiopen_created_at: c.created_at,
          audiopen_id: c.id,
          orig_transcript: c.body,
          processed: true
        } as Memory)),
        fromCache: true
      }
    } finally {
      setIsLoadingCache(false)
    }
  }

  /**
   * Clear old cached memories (7 days)
   */
  async function cleanCache() {
    try {
      await db.clearOldMemoryCache()
      await loadCachedMemories()
      console.log('✓ Cache cleaned')
    } catch (error) {
      console.error('Failed to clean cache:', error)
    }
  }

  return {
    cachedMemories,
    isLoadingCache,
    cacheMemories,
    fetchWithCache,
    cleanCache
  }
}
