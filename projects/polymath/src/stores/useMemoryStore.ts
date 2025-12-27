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

    // Helper to load from offline DB
    const loadFromOfflineDB = async () => {
      console.log('[MemoryStore] Loading memories from offline DB...')
      try {
        const { readingDb } = await import('../lib/db')
        const cached = await readingDb.getCachedMemories()

        // Map cached memories (Dexie) to Memory type (Supabase)
        // Note: CachedMemory has 'created_at' which maps to 'audiopen_created_at'
        const mappedMemories: Memory[] = cached.map(c => ({
          id: c.id,
          title: c.title,
          body: c.body,
          tags: c.tags,
          themes: c.themes,
          created_at: c.created_at, // Required by Memory type
          audiopen_created_at: c.created_at, // Mapping back
          audiopen_id: c.id,
          orig_transcript: c.body,
          processed: true, // Assume processed if cached
          // Default optional fields
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

        // Sort by date desc
        const sorted = mappedMemories.sort((a, b) =>
          new Date(b.audiopen_created_at).getTime() - new Date(a.audiopen_created_at).getTime()
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
    }

    // Check offline status first
    const { isOnline } = useOfflineStore.getState()
    if (!isOnline) {
      await loadFromOfflineDB()
      return
    }

    try {
      // Use API endpoint to ensure consistency with search and avoiding RLS issues with client-side auth
      const response = await fetch('/api/memories')

      if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.statusText}`)
      }

      const { memories: data } = await response.json()

      // Cache the fetched data for offline use
      if (data && data.length > 0) {
        import('../lib/db').then(({ readingDb }) => {
          const memoriesToCache = data.map((m: Memory) => ({
            id: m.id,
            title: m.title || 'Untitled',
            body: m.body || '',
            tags: m.tags || [],
            themes: m.themes || [],
            image_urls: m.image_urls || undefined,
            created_at: m.audiopen_created_at || new Date().toISOString()
          }))
          readingDb.bulkCacheMemories(memoriesToCache)
            .catch(e => console.warn('[MemoryStore] Failed to cache memories:', e))
        })
      }

      // Preserve optimistic memories
      const currentMemories = get().memories
      const optimisticMemories = currentMemories.filter(m =>
        m.id.startsWith('temp_') || m.id.startsWith('offline_')
      )

      const newMemories = [...optimisticMemories, ...(data || [])].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      set({ memories: newMemories, loading: false, lastFetched: now })
    } catch (error) {
      console.error('[MemoryStore] Fetch failed, attempting offline fallback:', error)

      const loadedOffline = await loadFromOfflineDB()
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

  deleteMemory: async (id: string) => {
    // Optimistic delete - remove from UI immediately
    const previousMemories = useMemoryStore.getState().memories

    set((state) => ({
      memories: Array.isArray(state.memories)
        ? state.memories.filter((m) => m.id !== id)
        : [],
    }))

    const { isOnline } = useOfflineStore.getState()

    // If offline, queue operation
    if (!isOnline) {
      await queueOperation('delete_memory', { id })
      await useOfflineStore.getState().updateQueueSize()

      console.log('[MemoryStore] Memory deletion queued for offline sync')
      return
    }

    // Online flow
    try {
      console.log('[MemoryStore] Deleting memory:', id)

      // 1. Manually cascade delete to bridges
      const { error: bridgeError } = await supabase
        .from('bridges')
        .delete()
        .or(`memory_a.eq.${id},memory_b.eq.${id}`)

      if (bridgeError) console.warn('[MemoryStore] Bridge delete warning:', bridgeError)

      // 2. Clear references in user_prompt_status (if this memory was a prompt response)
      // We don't know the user_id here easily, but RLS should handle it or we just update by response_id
      const { error: promptError } = await supabase
        .from('user_prompt_status')
        .update({ response_id: null, status: 'pending' }) // Reset prompt to pending? Or just clear link?
        .eq('response_id', id)

      if (promptError) console.warn('[MemoryStore] Prompt status update warning:', promptError)

      // 3. Delete the memory
      const { error, count } = await supabase
        .from('memories')
        .delete({ count: 'exact' })
        .eq('id', id)

      if (error) throw error

      if (count === 0) {
        console.warn('[MemoryStore] Memory not found in DB (already deleted?), keeping UI consistent')
        // Do NOT throw error here. If it's not in the DB, we want it gone from UI too.
        // The optimistic update at the start of this function already removed it.
      } else {
        console.log('[MemoryStore] Memory deleted successfully')
      }

    } catch (error) {
      console.error('[MemoryStore] Delete failed:', error)

      // Only rollback if it's a genuine API error, not a "not found" (count 0) situation
      // Since we removed the count check above, this catch block handles network/permission errors
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
