import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Memory, Bridge } from '../types'

interface CreateMemoryInput {
  title: string
  body: string
  tags?: string[]
  memory_type?: 'foundational' | 'event' | 'insight'
}

interface MemoryStore {
  memories: Memory[]
  bridges: Bridge[]
  loading: boolean
  error: string | null

  fetchMemories: () => Promise<void>
  fetchBridgesForMemory: (memoryId: string) => Promise<Bridge[]>
  createMemory: (input: CreateMemoryInput) => Promise<Memory>
}

export const useMemoryStore = create<MemoryStore>((set) => ({
  memories: [],
  bridges: [],
  loading: false,
  error: null,

  fetchMemories: async () => {
    set({ loading: true, error: null })

    try {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      set({ memories: data || [], loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch memories',
        loading: false,
      })
    }
  },

  fetchBridgesForMemory: async (memoryId: string) => {
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
    try {
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

      const { data, error } = await supabase
        .from('memories')
        .insert(newMemory)
        .select()
        .single()

      if (error) throw error

      // Add to local state
      set((state) => ({
        memories: [data, ...state.memories],
      }))

      return data
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to create memory')
    }
  },
}))
