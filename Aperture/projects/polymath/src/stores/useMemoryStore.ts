import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Memory, Bridge, BridgeWithMemories } from '../types'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'

interface CreateMemoryInput {
  title: string
  body: string
  tags?: string[]
  memory_type?: 'foundational' | 'event' | 'insight' | 'quick-note'
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
      console.log('[MemoryStore] Using cached memories')
      return
    }

    // Only set loading if we're actually fetching
    set({ loading: true, error: null })

    try {
      // Single-user app - no user_id filtering needed in DB
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      set({ memories: data || [], loading: false, lastFetched: now })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch memories',
        loading: false,
      })
    }
  },

  setMemories: (memories: Memory[]) => {
    set({ memories, loading: false, error: null })
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
      entities: null,
      themes: null,
      emotional_tone: null,
      embedding: null,
      processed: false,
      processed_at: null,
      error: null,
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
        source_reference: null,
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

    // Online flow
    try {
      const { data, error } = await supabase
        .from('memories')
        .insert(newMemory)
        .select()
        .single()

      if (error) throw error

      // Add to local state and update cache timestamp
      set((state) => ({
        memories: [data, ...(Array.isArray(state.memories) ? state.memories : [])],
        lastFetched: Date.now(),
      }))

      // Trigger background processing
      try {
        await fetch('/api/memories?action=process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memory_id: data.id })
        })
      } catch (processError) {
        console.error('Failed to trigger processing:', processError)
        // Don't throw - memory was created successfully
      }

      return data
    } catch (error) {
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
        processed: false,
      }

      await queueOperation('update_memory', updateData)
      await useOfflineStore.getState().updateQueueSize()

      console.log('[MemoryStore] Memory update queued for offline sync')
      return memoryToUpdate!
    }

    // Online flow
    try {
      const updateData = {
        title: input.title,
        body: input.body,
        tags: input.tags || [],
        memory_type: input.memory_type || null,
        processed: false, // Trigger reprocessing
      }

      const { data, error } = await supabase
        .from('memories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Replace with server data
      set((state) => ({
        memories: Array.isArray(state.memories)
          ? state.memories.map((m) => (m.id === id ? data : m))
          : [data],
      }))

      // Trigger background processing
      try {
        await fetch('/api/memories?action=process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memory_id: data.id })
        })
      } catch (processError) {
        console.error('Failed to trigger processing:', processError)
        // Don't throw - memory was updated successfully
      }

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
      const { error } = await supabase.from('memories').delete().eq('id', id)

      if (error) throw error
    } catch (error) {
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
