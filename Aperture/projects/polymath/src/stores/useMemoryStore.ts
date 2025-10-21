import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Memory, Bridge } from '../types'

interface MemoryStore {
  memories: Memory[]
  bridges: Bridge[]
  loading: boolean
  error: string | null

  fetchMemories: () => Promise<void>
  fetchBridgesForMemory: (memoryId: string) => Promise<Bridge[]>
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
}))
