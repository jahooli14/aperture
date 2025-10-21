/**
 * Project Store (Zustand)
 * Manages projects state and API calls
 */

import { create } from 'zustand'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

interface Project {
  id: string
  user_id: string
  title: string
  description: string
  type: 'personal' | 'technical' | 'meta'
  status: 'active' | 'dormant' | 'completed' | 'archived'
  last_active: string
  created_at: string
  metadata?: any
  source_suggestion_id?: string
}

interface ProjectState {
  projects: Project[]
  loading: boolean
  error: string | null
  filter: 'all' | 'active' | 'dormant' | 'completed'

  // Actions
  fetchProjects: () => Promise<void>
  createProject: (data: Partial<Project>) => Promise<void>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
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
      const params = new URLSearchParams()

      if (filter !== 'all') {
        params.append('status', filter)
      }

      const response = await fetch(`${API_BASE}/projects?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }

      const data = await response.json()
      set({ projects: data.projects || [], loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      })
    }
  },

  createProject: async (data) => {
    try {
      const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error('Failed to create project')
      }

      // Refresh projects after creating
      await get().fetchProjects()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  updateProject: async (id, data) => {
    try {
      const response = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error('Failed to update project')
      }

      // Refresh projects after updating
      await get().fetchProjects()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  setFilter: (filter) => {
    set({ filter })
    get().fetchProjects()
  }
}))
