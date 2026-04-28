import { create } from 'zustand'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'
import type { Memory, Bridge, BridgeWithMemories, SourceReference, ChecklistItem } from '../types'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'
import { CACHE_TTL } from '../lib/cacheConfig'

interface CreateMemoryInput {
  title?: string
  body?: string
  tags?: string[]
  memory_type?: 'foundational' | 'event' | 'insight' | 'quick-note'
  image_urls?: string[]
  source_reference?: SourceReference
  checklist_items?: ChecklistItem[]
}

interface MemoryStore {
  memories: Memory[]
  bridges: Bridge[]
  loading: boolean
  error: string | null
  lastFetched: number | null

  fetchMemories: (force?: boolean) => Promise<void>
  loadFromOfflineDB: () => Promise<boolean>
  setMemories: (memories: Memory[]) => void
  clearError: () => void
  clearCache: () => void
  fetchBridgesForMemory: (memoryId: string) => Promise<BridgeWithMemories[]>
  createMemory: (input: CreateMemoryInput) => Promise<Memory>
  updateMemory: (id: string, input: CreateMemoryInput) => Promise<Memory>
  updateChecklistItems: (id: string, items: ChecklistItem[]) => Promise<void>
  deleteMemory: (id: string) => Promise<void>
  addOptimisticMemory: (transcript: string) => string
  replaceOptimisticMemory: (tempId: string, realMemory: Memory) => void
  removeOptimisticMemory: (tempId: string) => void
  pinMemory: (id: string) => Promise<void>
  unpinMemory: (id: string) => Promise<void>
}

// Track active polling controllers so they can be aborted on navigation/unmount
const activePollingControllers = new Map<string, AbortController>()

/** Poll for processing completion to show extraction summary, then steer */
async function pollProcessing(memoryId: string) {
  // Abort any existing poll for this memory
  activePollingControllers.get(memoryId)?.abort()
  const controller = new AbortController()
  activePollingControllers.set(memoryId, controller)

  try {
    for (let i = 0; i < 6; i++) {
      if (controller.signal.aborted) return
      await new Promise(r => setTimeout(r, 3000)) // Check every 3s
      if (controller.signal.aborted) return
      try {
        const checkRes = await fetch(`/api/memories?id=${memoryId}`, {
          signal: controller.signal,
        })
        if (checkRes.ok) {
          const { memory: processed } = await checkRes.json()
          if (processed?.processed) {
            const entities = processed.entities || {}
            window.dispatchEvent(new CustomEvent('memory-extracted', {
              detail: {
                memoryId,
                topics: (entities.topics?.length || 0) + (entities.skills?.length || 0),
                people: entities.people?.length || 0,
                themes: processed.themes?.length || 0,
                tone: processed.emotional_tone || null,
                connections: 0,
                bridgeInsight: processed.triage?.bridge_insight || null,
              }
            }))

            // Fire steering after a short delay so ExtractionSummary shows first
            setTimeout(async () => {
              if (controller.signal.aborted) return
              try {
                const steerRes = await fetch('/api/memories?action=steer', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ memory_id: memoryId }),
                  signal: controller.signal,
                })
                if (steerRes.ok) {
                  const steering = await steerRes.json()
                  window.dispatchEvent(new CustomEvent('memory-steered', { detail: steering }))
                }
              } catch {
                // Non-critical, silently fail
              }
            }, 4500) // After ExtractionSummary auto-dismisses (4s)

            return
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Non-critical polling, silently fail
      }
    }
  } finally {
    activePollingControllers.delete(memoryId)
  }
}

/** Abort all active polling (call on unmount/navigation) */
export function abortAllPolling() {
  activePollingControllers.forEach(c => c.abort())
  activePollingControllers.clear()
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  bridges: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchMemories: async (force = false) => {
    const state = get()
    const now = Date.now()

    // Skip if we have recent data and not forcing refresh
    if (!force && state.memories.length > 0 && state.lastFetched && (now - state.lastFetched < CACHE_TTL)) {
      logger.debug('[MemoryStore] Using cached memories (Zustand)')
      return
    }

    // Check offline status first
    const { isOnline } = useOfflineStore.getState()
    if (!isOnline) {
      await get().loadFromOfflineDB()
      return
    }

    // Only show loading skeleton if we have no data at all  prevents flash
    // when navigating back to a page that already has cached data
    if (state.memories.length === 0) {
      set({ loading: true, error: null })
    }

    try {
      // Use API endpoint to ensure consistency with search and avoiding RLS issues with client-side auth
      const response = await fetch('/api/memories')

      if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.statusText}`)
      }

      const { memories: data } = await response.json()

      // Cache the fetched data for offline use - MUST await to ensure cache is populated
      if (data && data.length > 0) {
        try {
          const { readingDb } = await import('../lib/db')
          const memoriesToCache = data.map((m: Memory) => ({
            id: m.id,
            title: m.title || 'Untitled',
            body: m.body || '',
            tags: m.tags || [],
            themes: m.themes || [],
            image_urls: m.image_urls || undefined,
            created_at: m.audiopen_created_at || new Date().toISOString()
          }))
          await readingDb.bulkCacheMemories(memoriesToCache)
          logger.debug(`[MemoryStore] Cached ${memoriesToCache.length} memories for offline use`)
        } catch (cacheError) {
          logger.warn('[MemoryStore] Failed to cache memories:', cacheError)
        }
      }

      // Proactively fetch local pending items to ensure they don't "disappear" while online
      // but not yet synced to the server.
      const { db } = await import('../lib/db')
      const { getPendingOperations } = await import('../lib/offlineQueue')
      const pendingCaptures = await db.getPendingCaptures()
      const pendingOps = await getPendingOperations()

      const queuedMemories: Memory[] = pendingOps
        .filter(op => op.type === 'create_memory')
        .map(op => ({
          id: `offline_op_${op.timestamp}`,
          title: op.data.title || 'Saving thought...',
          body: op.data.body || '',
          tags: op.data.tags || [],
          created_at: new Date(op.timestamp).toISOString(),
          audiopen_created_at: new Date(op.timestamp).toISOString(),
          processed: false,
          memory_type: op.data.memory_type || null,
          image_urls: op.data.image_urls || null,
          review_count: 0
        } as any))

      const queuedCaptures: Memory[] = pendingCaptures.map(pc => ({
        id: `offline_cap_${pc.timestamp}`,
        title: 'Processing Voice (Offline)',
        body: pc.transcript || 'Audio note captured while offline.',
        tags: ['offline-pending'],
        created_at: new Date(pc.timestamp).toISOString(),
        audiopen_created_at: new Date(pc.timestamp).toISOString(),
        processed: false,
        memory_type: null,
        review_count: 0
      } as any))

      // Preserve optimistic memories from current session
      const currentMemories = get().memories
      const sessionOptimistic = currentMemories.filter(m =>
        m.id.startsWith('temp_') &&
        !queuedMemories.some(q => q.body === m.body) &&
        !queuedCaptures.some(q => q.body === m.body)
      )

      const mergedMemories = [
        ...sessionOptimistic,
        ...queuedMemories,
        ...queuedCaptures,
        ...(data || [])
      ].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // Use smart update logic to prevent flickering from polling
      // Skip update if data hasn't changed (prevent unnecessary re-renders during polling)
      if (currentMemories.length === mergedMemories.length && mergedMemories.length > 0) {
        const currentById = new Map(currentMemories.map(m => [m.id, m]))
        const sameIds = mergedMemories.every(m => currentById.has(m.id))

        if (sameIds) {
          // Check if processed status changed for any memory
          const hasProcessedChange = mergedMemories.some(m => {
            const current = currentById.get(m.id)
            return current && current.processed !== m.processed
          })

          if (!hasProcessedChange) {
            logger.debug('[MemoryStore] Skipping fetchMemories state update - data unchanged')
            set({ loading: false, lastFetched: now })
            return
          }
        }
      }

      set({ memories: mergedMemories, loading: false, lastFetched: now })
    } catch (error) {
      logger.error('[MemoryStore] Fetch failed, attempting offline fallback:', error)

      const loadedOffline = await get().loadFromOfflineDB()
      if (!loadedOffline) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch memories',
          loading: false,
        })
      }
    }
  },

  setMemories: (memories: Memory[]) => {
    const currentMemories = get().memories

    // Preserve optimistic memories from current state
    const optimisticMemories = currentMemories.filter(m =>
      m.id.startsWith('temp_') || m.id.startsWith('offline_')
    )

    // Filter out any optimistic memories from the incoming list to avoid duplicates if they were somehow passed in
    const incomingRealMemories = memories.filter(m =>
      !m.id.startsWith('temp_') && !m.id.startsWith('offline_')
    )

    const mergedMemories = [...optimisticMemories, ...incomingRealMemories].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    // Skip update if data hasn't changed (prevent unnecessary re-renders)
    if (currentMemories.length === mergedMemories.length && mergedMemories.length > 0) {
      // Create ID maps for efficient lookup
      const currentById = new Map(currentMemories.map(m => [m.id, m]))

      // Check if same IDs exist
      const sameIds = mergedMemories.every(m => currentById.has(m.id))

      if (sameIds) {
        // Check if processed status changed for any memory
        const hasProcessedChange = mergedMemories.some(m => {
          const current = currentById.get(m.id)
          return current && current.processed !== m.processed
        })

        if (!hasProcessedChange) {
          logger.debug('[MemoryStore] Skipping state update - data unchanged')
          return
        }
      }
    }

    set({ memories: mergedMemories, loading: false, error: null, lastFetched: Date.now() })
  },

  clearError: () => {
    set({ error: null })
  },

  clearCache: () => {
    set({ memories: [], bridges: [], lastFetched: null, error: null })
  },

  fetchBridgesForMemory: async (memoryId: string) => {
    // Skip fetching for temporary/optimistic memory IDs
    if (memoryId.startsWith('temp_')) {
      return []
    }

    try {
      const { data, error } = await supabase
        .from('bridges')
        .select(`
          *,
          memory_a:memories!bridges_memory_a_fkey(*),
          memory_b:memories!bridges_memory_b_fkey(*)
        `)
        .or(`memory_a.eq.${memoryId},memory_b.eq.${memoryId}`)
        .order('strength', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      logger.error('[store] Failed to fetch bridges:', error)
      return []
    }
  },

  createMemory: async (input: CreateMemoryInput) => {
    const now = new Date().toISOString()

    // Generate a soft fallback title from the body so empty titles don't look broken.
    // Server-side Gemini will overwrite this with a real summary on capture / sync.
    const fallbackTitle = input.title?.trim()
      || (input.checklist_items?.length ? 'Checklist' : null)
      || (input.body?.trim().split(/\s+/).slice(0, 8).join(' ') || 'New thought')

    const newMemory = {
      audiopen_id: `manual_${Date.now()}`, // Generate unique ID for manual entries
      title: input.title || fallbackTitle,
      body: input.body,
      orig_transcript: null, // Manual entries don't have transcripts
      tags: input.tags || [],
      audiopen_created_at: now,
      memory_type: input.memory_type || null,
      image_urls: input.image_urls || null,
      checklist_items: input.checklist_items || null,
      entities: null,
      themes: null,
      emotional_tone: null,
      embedding: null,
      processed: false,
      processed_at: null,
      error: null,
      source_reference: input.source_reference || null,
    }

    const { isOnline } = useOfflineStore.getState()

    // If offline, queue operation and show optimistically
    if (!isOnline) {
      const tempId = `offline_${Date.now()}`
      const optimisticMemory = {
        id: tempId,
        created_at: now,
        ...newMemory,
        last_reviewed_at: null,
        review_count: 0,
        source_reference: input.source_reference || null,
        triage: null
      } as Memory

      // Add to UI immediately
      set((state) => ({
        memories: [optimisticMemory, ...(Array.isArray(state.memories) ? state.memories : [])],
      }))

      // Queue for sync when back online — strip the fallback title so the
      // server can generate a proper Gemini summary once we're online again.
      await queueOperation('create_memory', { ...newMemory, title: input.title || null })
      await useOfflineStore.getState().updateQueueSize()

      logger.debug('[MemoryStore] Memory queued for offline sync')
      return optimisticMemory
    }

    // Online flow — show the memory IMMEDIATELY (optimistic), then reconcile
    // with the server response. This is what makes capture feel instant.
    const tempId = `temp_${Date.now()}`
    const optimisticMemory = {
      id: tempId,
      created_at: now,
      ...newMemory,
      last_reviewed_at: null,
      review_count: 0,
      source_reference: input.source_reference || null,
      triage: null,
    } as Memory

    set((state) => ({
      memories: [optimisticMemory, ...(Array.isArray(state.memories) ? state.memories : [])],
      lastFetched: Date.now(),
    }))

    try {
      logger.debug('[MemoryStore] Creating memory via API...')
      const response = await fetch('/api/memories?capture=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: input.body,
          title: input.title,
          tags: input.tags,
          memory_type: input.memory_type,
          image_urls: input.image_urls,
          source_reference: input.source_reference,
          checklist_items: input.checklist_items,
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        logger.error('[MemoryStore] API error:', errorData)
        throw new Error(errorData.details || errorData.error || `Failed to create memory (${response.status})`)
      }

      const { memory: data } = await response.json()

      // Replace optimistic memory with the server one (preserve the position)
      set((state) => ({
        memories: Array.isArray(state.memories)
          ? state.memories.map((m) => (m.id === tempId ? data : m))
          : [data],
        lastFetched: Date.now(),
      }))

      logger.debug('[MemoryStore] Memory created successfully:', data.id)

      // Non-blocking: poll for extraction summary
      pollProcessing(data.id).catch(() => {})

      // Check for new connections after processing (delayed to allow backend processing)
      setTimeout(async () => {
        try {
          const connResponse = await fetch(`/api/connections?action=suggestions&id=${data.id}&type=thought`)
          if (connResponse.ok) {
            const { suggestions } = await connResponse.json()
            if (suggestions && suggestions.length > 0) {
              // Dispatch custom event for toast display
              window.dispatchEvent(new CustomEvent('memory-connections-found', {
                detail: { memoryId: data.id, count: suggestions.length, connections: suggestions }
              }))
            }
          }
        } catch (e) {
          // Non-critical, silently fail
        }
      }, 5000) // Wait 5s for backend processing to complete

      return data
    } catch (error) {
      logger.error('[MemoryStore] Create memory failed:', error)
      // Roll back the optimistic memory so the user knows it failed
      set((state) => ({
        memories: Array.isArray(state.memories)
          ? state.memories.filter((m) => m.id !== tempId)
          : state.memories,
      }))
      throw error instanceof Error ? error : new Error('Failed to create memory')
    }
  },

  updateMemory: async (id: string, input: CreateMemoryInput): Promise<Memory> => {
    // Optimistic update - update UI immediately
    const previousMemories: Memory[] = get().memories
    const memoryToUpdate: Memory | undefined = previousMemories.find((m: Memory) => m.id === id)

    if (memoryToUpdate) {
      set((state) => ({
        memories: Array.isArray(state.memories)
          ? state.memories.map((m): Memory =>
            m.id === id
              ? {
                ...m,
                title: input.title ?? m.title,
                body: input.body ?? m.body,
                tags: input.tags || [],
                memory_type: input.memory_type || null,
                image_urls: input.image_urls || m.image_urls,
                processed: false,
              }
              : m
          )
          : [],
      }))
    }

    const { isOnline } = useOfflineStore.getState()

    // If offline, queue operation
    if (!isOnline) {
      const updateData = {
        id,
        title: input.title,
        body: input.body,
        tags: input.tags || [],
        memory_type: input.memory_type || null,
        image_urls: input.image_urls,
        processed: false,
      }

      await queueOperation('update_memory', updateData)
      await useOfflineStore.getState().updateQueueSize()

      logger.debug('[MemoryStore] Memory update queued for offline sync')
      return memoryToUpdate!
    }

    // Online flow
    try {
      const response = await fetch(`/api/memories?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          tags: input.tags || [],
          memory_type: input.memory_type || null,
          image_urls: input.image_urls,
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to update memory (${response.status})`)
      }

      const { memory: data } = await response.json()

      // Replace with server data
      set((state) => ({
        memories: Array.isArray(state.memories)
          ? state.memories.map((m) => (m.id === id ? data : m))
          : [data],
      }))

      return data
    } catch (error) {
      // Rollback on error
      set({ memories: previousMemories })
      throw error instanceof Error ? error : new Error('Failed to update memory')
    }
  },

  updateChecklistItems: async (id: string, items: ChecklistItem[]) => {
    // Optimistic update
    set((state) => ({
      memories: Array.isArray(state.memories)
        ? state.memories.map((m) => m.id === id ? { ...m, checklist_items: items } : m)
        : state.memories,
    }))

    try {
      const response = await fetch(`/api/memories?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist_items: items })
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to update checklist (${response.status})`)
      }
    } catch (error) {
      logger.error('[MemoryStore] updateChecklistItems failed:', error)
      // Silently fail — optimistic state is good enough for checklists
    }
  },

  // Helper to load from offline DB
  loadFromOfflineDB: async () => {
    logger.debug('[MemoryStore] Loading memories from offline DB...')
    try {
      const { db } = await import('../lib/db')
      const { getPendingOperations } = await import('../lib/offlineQueue')

      const cached = await db.getCachedMemories()
      const pendingOps = await getPendingOperations()
      const pendingCaptures = await db.getPendingCaptures()

      // Map cached memories (Dexie) to Memory type (Supabase)
      const mappedMemories: Memory[] = cached.map(c => ({
        id: c.id,
        title: c.title,
        body: c.body,
        tags: c.tags,
        themes: c.themes,
        created_at: c.created_at,
        audiopen_created_at: c.created_at,
        audiopen_id: c.id,
        orig_transcript: c.body,
        processed: true,
        memory_type: null,
        image_urls: c.image_urls || null,
        entities: null,
        emotional_tone: null,
        embedding: null,
        processed_at: null,
        error: null,
        last_reviewed_at: null,
        review_count: 0,
        source_reference: null,
        triage: null
      }))

      // Map pending operations (create_memory)
      const queuedMemories: Memory[] = pendingOps
        .filter(op => op.type === 'create_memory')
        .map(op => ({
          id: `offline_op_${op.timestamp}`,
          title: op.data.title || 'Saving thought...',
          body: op.data.body || '',
          tags: op.data.tags || [],
          created_at: new Date(op.timestamp).toISOString(),
          audiopen_created_at: new Date(op.timestamp).toISOString(),
          processed: false,
          memory_type: op.data.memory_type || null,
          image_urls: op.data.image_urls || null,
          review_count: 0,
          id_in_queue: op.id
        } as any))

      // Map pending voice captures
      const queuedCaptures: Memory[] = pendingCaptures.map(pc => ({
        id: `offline_cap_${pc.timestamp}`,
        title: 'Processing Voice (Offline)',
        body: pc.transcript || 'Audio note captured while offline.',
        tags: ['offline-pending'],
        created_at: new Date(pc.timestamp).toISOString(),
        audiopen_created_at: new Date(pc.timestamp).toISOString(),
        processed: false,
        memory_type: null,
        review_count: 0,
        id_in_queue: pc.id
      } as any))

      // Preserve optimistic memories from current session (if any)
      const currentMemories = get().memories
      const sessionOptimistic = currentMemories.filter(m =>
        m.id.startsWith('temp_') && !queuedMemories.some(q => q.body === m.body) && !queuedCaptures.some(q => q.body === m.body)
      )

      const allMemories = [...sessionOptimistic, ...queuedMemories, ...queuedCaptures, ...mappedMemories]

      const sorted = allMemories.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      set({
        memories: sorted,
        loading: false,
        lastFetched: Date.now(),
        error: null
      })
      return true
    } catch (err) {
      logger.error('[MemoryStore] Failed to load offline memories:', err)
      return false
    }
  },

  deleteMemory: async (id: string) => {
    // Optimistic delete - remove from UI immediately
    const previousMemories = useMemoryStore.getState().memories

    set((state) => ({
      memories: Array.isArray(state.memories)
        ? state.memories.filter((m) => m.id !== id)
        : [],
    }))

    // If it's a local/offline ID, we must remove it from the local queue as well
    // otherwise it will reappear in the UI on the next refresh/sync
    try {
      if (id.startsWith('offline_cap_')) {
        const { db } = await import('../lib/db')
        const timestamp = parseInt(id.replace('offline_cap_', ''))
        const pending = await db.getPendingCaptures()
        const match = pending.find(p => p.timestamp === timestamp)
        if (match?.id) {
          await db.deletePendingCapture(match.id)
          logger.debug('[MemoryStore] Removed voice capture from local DB')
        }
      } else if (id.startsWith('offline_op_')) {
        const { removeOperation, getPendingOperations } = await import('../lib/offlineQueue')
        const timestamp = parseInt(id.replace('offline_op_', ''))
        const pending = await getPendingOperations()
        const match = pending.find(p => p.timestamp === timestamp)
        if (match?.id) {
          await removeOperation(match.id)
          logger.debug('[MemoryStore] Removed operation from local queue')
        }
      }
    } catch (localError) {
      logger.warn('[MemoryStore] Failed to cleanup local queue during delete:', localError)
    }

    const { isOnline } = useOfflineStore.getState()

    // If offline or it's a completely local ID, we're done (optimistic UI already updated)
    if (!isOnline || id.startsWith('offline_') || id.startsWith('temp_')) {
      if (!isOnline && !id.startsWith('temp_')) {
        await queueOperation('delete_memory', { id })
        await useOfflineStore.getState().updateQueueSize()
        logger.debug('[MemoryStore] Memory deletion queued for offline sync')
      }
      return
    }

    // Online flow
    try {
      logger.debug('[MemoryStore] Deleting memory via API:', id)

      const response = await fetch(`/api/memories?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to delete memory (${response.status})`)
      }

      logger.debug('[MemoryStore] Memory deleted successfully via API')

    } catch (error) {
      logger.error('[MemoryStore] Delete failed:', error)
      // Rollback on error
      set({ memories: previousMemories })
      throw error instanceof Error ? error : new Error('Failed to delete memory')
    }
  },

  addOptimisticMemory: (transcript: string) => {
    const tempId = `temp_${Date.now()}`
    const now = new Date().toISOString()

    const optimisticMemory = {
      id: tempId,
      created_at: now,
      audiopen_id: tempId,
      title: 'Processing...',
      body: transcript,
      orig_transcript: transcript,
      tags: [],
      audiopen_created_at: now,
      memory_type: null,
      image_urls: null,
      entities: null,
      themes: null,
      emotional_tone: null,
      embedding: null,
      processed: false,
      processed_at: null,
      error: null,
      last_reviewed_at: null,
      review_count: 0,
      source_reference: null,
      triage: null
    } as Memory

    // Add to top of list immediately and update cache timestamp
    set((state) => ({
      memories: [optimisticMemory, ...(Array.isArray(state.memories) ? state.memories : [])],
      lastFetched: Date.now(),
    }))

    return tempId
  },

  replaceOptimisticMemory: (tempId: string, realMemory: Memory) => {
    set((state) => ({
      memories: Array.isArray(state.memories)
        ? state.memories.map((m) => (m.id === tempId ? realMemory : m))
        : [realMemory],
      lastFetched: Date.now(),
    }))
  },

  removeOptimisticMemory: (tempId: string) => {
    set((state) => ({
      memories: Array.isArray(state.memories)
        ? state.memories.filter((m) => m.id !== tempId)
        : [],
    }))
  },

  pinMemory: async (id: string) => {
    // Optimistic update
    set((state) => ({
      memories: state.memories.map((m) =>
        m.id === id ? { ...m, is_pinned: true } : m
      ),
    }))

    try {
      await fetch(`/api/memories?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_pinned: true }),
      })
    } catch (error) {
      // Revert on failure
      set((state) => ({
        memories: state.memories.map((m) =>
          m.id === id ? { ...m, is_pinned: false } : m
        ),
      }))
      logger.error('[MemoryStore] Pin failed:', error)
    }
  },

  unpinMemory: async (id: string) => {
    // Optimistic update
    set((state) => ({
      memories: state.memories.map((m) =>
        m.id === id ? { ...m, is_pinned: false } : m
      ),
    }))

    try {
      await fetch(`/api/memories?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_pinned: false }),
      })
    } catch (error) {
      // Revert on failure
      set((state) => ({
        memories: state.memories.map((m) =>
          m.id === id ? { ...m, is_pinned: true } : m
        ),
      }))
      logger.error('[MemoryStore] Unpin failed:', error)
    }
  },
}))
