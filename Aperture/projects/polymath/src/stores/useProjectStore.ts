/**
 * Project Store (Zustand)
 * Manages projects state and API calls
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Project } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

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
      // Use API endpoint which handles user_id server-side
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to create project')
      }

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
