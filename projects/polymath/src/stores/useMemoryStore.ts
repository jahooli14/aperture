import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Memory, Bridge, BridgeWithMemories, SourceReference } from '../types'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'

interface CreateMemoryInput {
  title: string
  body: string
  tags?: string[]
  memory_type?: 'foundational' | 'event' | 'insight' | 'quick-note'
  image_urls?: string[]
  source_reference?: SourceReference
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
  fetchBridgesForMemory: (memoryId: string) => Promise<BridgeWithMemories[]>
  createMemory: (input: CreateMemoryInput) => Promise<Memory>
  updateMemory: (id: string, input: CreateMemoryInput) => Promise<Memory>
  deleteMemory: (id: string) => Promise<void>
  addOptimisticMemory: (transcript: string) => string
  replaceOptimisticMemory: (tempId: string, realMemory: Memory) => void
  removeOptimisticMemory: (tempId: string) => void
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
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

    // Skip if we have recent data and not forcing refresh
    if (!force && state.memories.length > 0 && state.lastFetched && (now - state.lastFetched < CACHE_DURATION)) {
      console.log('[MemoryStore] Using cached memories (Zustand)')
      return
    }

    set({ loading: true, error: null })

    // Check offline status first
    const { isOnline } = useOfflineStore.getState()
    if (!isOnline) {
      await get().loadFromOfflineDB()
      return
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
          console.log(`[MemoryStore] Cached ${memoriesToCache.length} memories for offline use`)
        } catch (cacheError) {
          console.warn('[MemoryStore] Failed to cache memories:', cacheError)
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
          title: op.data.title || '⏳ Saving thought...',
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
        title: '⏳ Processing Voice (Offline)',
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
            console.log('[MemoryStore] Skipping fetchMemories state update - data unchanged')
            set({ loading: false, lastFetched: now })
            return
          }
        }
      }

      set({ memories: mergedMemories, loading: false, lastFetched: now })
    } catch (error) {
      console.error('[MemoryStore] Fetch failed, attempting offline fallback:', error)

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
          console.log('[MemoryStore] Skipping state update - data unchanged')
          return
        }
      }
    }

    set({ memories: mergedMemories, loading: false, error: null, lastFetched: Date.now() })
  },

  clearError: () => {
    set({ error: null })
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
      console.error('[store] Failed to fetch bridges:', error)
      return []
    }
  },

  createMemory: async (input: CreateMemoryInput) => {
    const now = new Date().toISOString()

    const newMemory = {
      audiopen_id: `manual_${Date.now()}`, // Generate unique ID for manual entries
      title: input.title,
      body: input.body,
      orig_transcript: null, // Manual entries don't have transcripts
      tags: input.tags || [],
      audiopen_created_at: now,
      memory_type: input.memory_type || null,
      image_urls: input.image_urls || null,
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

      // Queue for sync when back online
      await queueOperation('create_memory', newMemory)
      await useOfflineStore.getState().updateQueueSize()

      console.log('[MemoryStore] Memory queued for offline sync')
      return optimisticMemory
    }

    // Online flow - use API endpoint which handles auth and user_id properly
    try {
      console.log('[MemoryStore] Creating memory via API...')
      const response = await fetch('/api/memories?capture=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: input.body,
          title: input.title,
          tags: input.tags,
          memory_type: input.memory_type,
          image_urls: input.image_urls,
          source_reference: input.source_reference
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[MemoryStore] API error:', errorData)
        throw new Error(errorData.details || errorData.error || `Failed to create memory (${response.status})`)
      }

      const { memory: data } = await response.json()

      // Add to local state and update cache timestamp
      set((state) => ({
        memories: [data, ...(Array.isArray(state.memories) ? state.memories : [])],
        lastFetched: Date.now(),
      }))

      console.log('[MemoryStore] Memory created successfully:', data.id)
      return data
    } catch (error) {
      console.error('[MemoryStore] Create memory failed:', error)
      throw error instanceof Error ? error : new Error('Failed to create memory')
    }
  },

  updateMemory: async (id: string, input: CreateMemoryInput) => {
    // Optimistic update - update UI immediately
    const previousMemories = useMemoryStore.getState().memories
    const memoryToUpdate = previousMemories.find((m) => m.id === id)

    if (memoryToUpdate) {
      set((state) => ({
        memories: Array.isArray(state.memories)
          ? state.memories.map((m) =>
            m.id === id
              ? {
                ...m,
                title: input.title,
                body: input.body,
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

      console.log('[MemoryStore] Memory update queued for offline sync')
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

  // Helper to load from offline DB
  loadFromOfflineDB: async () => {
    console.log('[MemoryStore] Loading memories from offline DB...')
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
          title: op.data.title || '⏳ Saving thought...',
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
        title: '⏳ Processing Voice (Offline)',
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
      console.error('[MemoryStore] Failed to load offline memories:', err)
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
          console.log('[MemoryStore] Removed voice capture from local DB')
        }
      } else if (id.startsWith('offline_op_')) {
        const { removeOperation, getPendingOperations } = await import('../lib/offlineQueue')
        const timestamp = parseInt(id.replace('offline_op_', ''))
        const pending = await getPendingOperations()
        const match = pending.find(p => p.timestamp === timestamp)
        if (match?.id) {
          await removeOperation(match.id)
          console.log('[MemoryStore] Removed operation from local queue')
        }
      }
    } catch (localError) {
      console.warn('[MemoryStore] Failed to cleanup local queue during delete:', localError)
    }

    const { isOnline } = useOfflineStore.getState()

    // If offline or it's a completely local ID, we're done (optimistic UI already updated)
    if (!isOnline || id.startsWith('offline_') || id.startsWith('temp_')) {
      if (!isOnline && !id.startsWith('temp_')) {
        await queueOperation('delete_memory', { id })
        await useOfflineStore.getState().updateQueueSize()
        console.log('[MemoryStore] Memory deletion queued for offline sync')
      }
      return
    }

    // Online flow
    try {
      console.log('[MemoryStore] Deleting memory via API:', id)

      const response = await fetch(`/api/memories?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to delete memory (${response.status})`)
      }

      console.log('[MemoryStore] Memory deleted successfully via API')

    } catch (error) {
      console.error('[MemoryStore] Delete failed:', error)
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
      title: '⏳ Processing...',
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
}))
