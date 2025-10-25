/**
 * Project Store (Zustand)
 * Manages projects state and API calls
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

interface Project {
  id: string
  user_id: string
  title: string
  description: string
  type: 'personal' | 'technical' | 'meta' // Updated to match actual DB constraint
  status: 'active' | 'on-hold' | 'maintaining' | 'completed' | 'archived'
  last_active: string
  created_at: string
  metadata?: any
  source_suggestion_id?: string
}

interface ProjectState {
  projects: Project[]
  loading: boolean
  error: string | null
  filter: 'all' | 'active' | 'on-hold' | 'maintaining' | 'completed'

  // Actions
  fetchProjects: () => Promise<void>
  createProject: (data: Partial<Project>) => Promise<void>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setFilter: (filter: ProjectState['filter']) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  filter: 'all',

  fetchProjects: async () => {
    set({ loading: true, error: null })

    try {
      const { filter } = get()
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      set({ projects: data || [], loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      })
    }
  },

  createProject: async (data) => {
    try {
      // Single-user app - use hardcoded user ID from env
      const userId = import.meta.env.VITE_USER_ID || 'default-user'

      const { error } = await supabase
        .from('projects')
        .insert([{ ...data, user_id: userId }])

      if (error) throw error

      // Refresh projects after creating
      await get().fetchProjects()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage })
      throw error // Re-throw so the dialog can catch it
    }
  },

  updateProject: async (id, data) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update(data)
        .eq('id', id)

      if (error) throw error

      // Refresh projects after updating
      await get().fetchProjects()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  deleteProject: async (id) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Refresh projects after deleting
      await get().fetchProjects()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  setFilter: (filter) => {
    set({ filter })
    get().fetchProjects()
  }
}))
