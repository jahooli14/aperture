import { create } from 'zustand'
import type { TestRepair, SelfHealingConfig } from '../types'
import { getRepairs, approveRepair, rejectRepair } from '../lib/supabase-repairs'

interface RepairsStore {
  repairs: TestRepair[]
  loading: boolean
  error: string | null
  fetchRepairs: (config: SelfHealingConfig, status?: 'pending' | 'approved' | 'rejected') => Promise<void>
  approveRepair: (id: string, config: SelfHealingConfig) => Promise<void>
  rejectRepair: (id: string, config: SelfHealingConfig) => Promise<void>
}

export const useRepairs = create<RepairsStore>((set) => ({
  repairs: [],
  loading: false,
  error: null,

  fetchRepairs: async (config, status) => {
    set({ loading: true, error: null })
    try {
      const repairs = await getRepairs(config, status)
      set({ repairs, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  },

  approveRepair: async (id, config) => {
    try {
      await approveRepair(id, config)
      set((state) => ({
        repairs: state.repairs.map((r) =>
          r.id === id ? { ...r, status: 'approved' } : r
        ),
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  rejectRepair: async (id, config) => {
    try {
      await rejectRepair(id, config)
      set((state) => ({
        repairs: state.repairs.map((r) =>
          r.id === id ? { ...r, status: 'rejected' } : r
        ),
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
}))
