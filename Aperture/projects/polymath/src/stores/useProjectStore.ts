/**
 * Project Store (Zustand)
 * Manages projects state and API calls
 */

import { create } from 'zustand'
import type { Project } from '../types'
import { api } from '../lib/apiClient'
import { logger } from '../lib/logger'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'

/**
 * Smart project sorting with resurfacing algorithm
 *
 * Sorting priority:
 * 1. Priority projects first
 * 2. Status priority (upcoming > active > on-hold > maintaining > completed > archived)
 * 3. Most recently touched
 */
function smartSortProjects(projects: Project[]): Project[] {
  if (!Array.isArray(projects)) {
    logger.warn('Invalid projects array:', projects)
    return []
  }

  const now = new Date()

  const statusPriority: Record<string, number> = {
    upcoming: 1,
    active: 2,
    'on-hold': 3,
    maintaining: 4,
    completed: 5,
    archived: 6,
    abandoned: 7,
  }

  return projects.sort((a, b) => {
    // 0. Priority projects first
    if (a.is_priority && !b.is_priority) return -1
    if (!a.is_priority && b.is_priority) return 1

    // 1. Compare status priority
    const statusDiff = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
    if (statusDiff !== 0) return statusDiff

    // 2. Most recently touched first (using updated_at if available, else last_active)
    const aTime = new Date(a.updated_at || a.last_active).getTime()
    const bTime = new Date(b.updated_at || b.last_active).getTime()
    return bTime - aTime
  })
}

interface ProjectState {
  projects: Project[]
  loading: boolean
  error: string | null
  filter: 'all' | 'upcoming' | 'active' | 'dormant' | 'completed'

  // Actions
  fetchProjects: () => Promise<void>
  createProject: (data: Partial<Project>) => Promise<void>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setPriority: (id: string) => Promise<void>
  setFilter: (filter: ProjectState['filter']) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  filter: 'all',

  fetchProjects: async () => {
    // Preserve existing projects during loading to prevent flicker
    set((state) => ({ ...state, loading: true, error: null }))

    try {
      const { filter } = get()

      // Build query string
      let endpoint = 'projects'
      if (filter !== 'all') {
        endpoint += `?filter=${filter}`
      }

      const data = await api.get(endpoint)
      let projects = Array.isArray(data) ? data : data.projects || []

      // For 'dormant' filter, further filter by last_active date client-side
      if (filter === 'dormant') {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        projects = projects.filter((p: Project) => new Date(p.last_active) < sevenDaysAgo)
      }

      // Smart sorting
      projects = smartSortProjects(projects)

      set({ projects, loading: false })
    } catch (error) {
      logger.error('Failed to fetch projects:', error)
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      })
    }
  },

  createProject: async (data) => {
    try {
      await api.post('projects', data)

      // Refresh projects after creating
      await get().fetchProjects()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage })
      throw error
    }
  },

  updateProject: async (id, data) => {
    const previousProjects = get().projects

    const { isOnline } = useOfflineStore.getState()

    // If offline, queue operation
    if (!isOnline) {
      await queueOperation('update_project', { id, ...data })
      await useOfflineStore.getState().updateQueueSize()
      return
    }

    // Online flow - use API and update with response
    try {
      const updateData = {
        ...data,
        last_active: new Date().toISOString()
      }

      // Call API endpoint (will return updated project)
      const updated = await api.patch(`projects/${id}`, updateData)

      // Update local state with server response (single source of truth)
      const updatedProjects = get().projects.map(p =>
        p.id === id ? updated : p
      )
      set({ projects: updatedProjects })
    } catch (error) {
      logger.error('Failed to update project:', error)
      // Rollback on error
      set({ projects: previousProjects })
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  deleteProject: async (id) => {
    // Optimistic delete - remove from UI immediately
    const previousProjects = get().projects

    set((state) => ({
      projects: Array.isArray(state.projects)
        ? state.projects.filter((p) => p.id !== id)
        : [],
    }))

    const { isOnline } = useOfflineStore.getState()

    // If offline, queue operation
    if (!isOnline) {
      await queueOperation('delete_project', { id })
      await useOfflineStore.getState().updateQueueSize()
      return
    }

    // Online flow
    try {
      await api.delete(`projects/${id}`)
    } catch (error) {
      logger.error('Failed to delete project:', error)
      // Rollback on error
      set({ projects: previousProjects })
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  setPriority: async (id) => {
    try {
      // Call priority endpoint
      await api.patch(`projects/${id}/priority`)

      // Refresh projects to get updated priority state
      await get().fetchProjects()
    } catch (error) {
      logger.error('Failed to set priority:', error)
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
