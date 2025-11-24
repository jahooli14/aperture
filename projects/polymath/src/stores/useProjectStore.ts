/**
 * Project Store (Zustand)
 * Manages projects state and API calls
 * 
 * OPTIMIZED FOR SPEED:
 * - Local-first filtering (fetches all, filters in memory)
 * - Optimistic updates (updates UI immediately, syncs in background)
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

  const statusPriority: Record<string, number> = {
    upcoming: 1,
    active: 2,
    'on-hold': 3,
    maintaining: 4,
    completed: 5,
    archived: 6,
    abandoned: 7,
  }

  return [...projects].sort((a, b) => {
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

// Helper to filter projects locally
function filterProjects(projects: Project[], filter: ProjectState['filter']): Project[] {
  if (filter === 'all') return projects
  return projects.filter(p => p.status === filter)
}

interface ProjectState {
  allProjects: Project[] // Source of truth
  projects: Project[] // Filtered view
  loading: boolean
  error: string | null
  filter: 'all' | 'upcoming' | 'active' | 'dormant' | 'completed'
  initialized: boolean

  // Actions
  fetchProjects: (retryCount?: number) => Promise<void>
  createProject: (data: Partial<Project>) => Promise<void>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setPriority: (id: string) => Promise<void>
  setFilter: (filter: ProjectState['filter']) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  allProjects: [],
  projects: [],
  loading: false,
  error: null,
  filter: 'all',
  initialized: false,

  fetchProjects: async (retryCount = 0) => {
    const MAX_RETRIES = 3
    const RETRY_DELAYS = [1000, 2000, 4000]

    // Only set loading on first fetch to avoid UI flicker
    if (!get().initialized) {
      set({ loading: true, error: null })
    }

    try {
      // Always fetch ALL projects
      const data = await api.get('projects')
      let fetchedProjects = Array.isArray(data) ? data : data.projects || []

      // Sort once
      fetchedProjects = smartSortProjects(fetchedProjects)

      set(state => ({
        allProjects: fetchedProjects,
        projects: filterProjects(fetchedProjects, state.filter),
        loading: false,
        initialized: true,
        error: null
      }))
    } catch (error) {
      logger.error('Failed to fetch projects:', error)

      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount]
        await new Promise(resolve => setTimeout(resolve, delay))
        return get().fetchProjects(retryCount + 1)
      }

      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      })
    }
  },

  createProject: async (data) => {
    const previousAllProjects = get().allProjects
    const tempId = `temp-${Date.now()}`

    // Optimistic Update
    const newProject = {
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      status: 'active',
      is_priority: false,
      ...data
    } as Project

    const newAllProjects = smartSortProjects([newProject, ...previousAllProjects])

    set(state => ({
      allProjects: newAllProjects,
      projects: filterProjects(newAllProjects, state.filter)
    }))

    try {
      const result = await api.post('projects', data)

      // Replace temp ID with real ID
      set(state => {
        const updatedAll = state.allProjects.map(p =>
          p.id === tempId ? { ...result, ...data } : p // Merge result to keep any local changes? Actually result should be authoritative
        )
        // Re-sort in case server data changes order (unlikely for new)
        const sorted = smartSortProjects(updatedAll)
        return {
          allProjects: sorted,
          projects: filterProjects(sorted, state.filter)
        }
      })
    } catch (error) {
      console.error('[ProjectStore] Failed to create project:', error)
      // Rollback
      set(state => ({
        allProjects: previousAllProjects,
        projects: filterProjects(previousAllProjects, state.filter),
        error: error instanceof Error ? error.message : 'Failed to create project'
      }))
      throw error
    }
  },

  updateProject: async (id, data) => {
    const previousAllProjects = get().allProjects
    const { isOnline } = useOfflineStore.getState()

    // Optimistic Update
    const updatedAllProjects = previousAllProjects.map(p =>
      p.id === id ? { ...p, ...data, updated_at: new Date().toISOString() } : p
    )

    // Re-sort if status or priority changed
    const sortedAllProjects = smartSortProjects(updatedAllProjects)

    set(state => ({
      allProjects: sortedAllProjects,
      projects: filterProjects(sortedAllProjects, state.filter)
    }))

    // If offline, queue operation
    if (!isOnline) {
      await queueOperation('update_project', { id, ...data })
      await useOfflineStore.getState().updateQueueSize()
      return
    }

    // Online flow
    try {
      const updateData = {
        ...data,
        last_active: new Date().toISOString()
      }
      await api.patch(`projects/${id}`, updateData)
      // No need to re-fetch or update from result if we trust our optimistic update.
      // But strictly we should update with server response to get generated fields.
      // For speed, we'll skip re-fetching the whole list.
    } catch (error) {
      logger.error('Failed to update project:', error)
      // Rollback
      set(state => ({
        allProjects: previousAllProjects,
        projects: filterProjects(previousAllProjects, state.filter),
        error: error instanceof Error ? error.message : 'Failed to update project'
      }))
      throw error
    }
  },

  deleteProject: async (id) => {
    const previousAllProjects = get().allProjects

    // Optimistic Delete
    const newAllProjects = previousAllProjects.filter(p => p.id !== id)

    set(state => ({
      allProjects: newAllProjects,
      projects: filterProjects(newAllProjects, state.filter)
    }))

    const { isOnline } = useOfflineStore.getState()

    if (!isOnline) {
      await queueOperation('delete_project', { id })
      await useOfflineStore.getState().updateQueueSize()
      return
    }

    try {
      await api.delete(`projects/${id}`)
    } catch (error) {
      logger.error('Failed to delete project:', error)
      // Rollback
      set(state => ({
        allProjects: previousAllProjects,
        projects: filterProjects(previousAllProjects, state.filter),
        error: error instanceof Error ? error.message : 'Failed to delete project'
      }))
      throw error
    }
  },

  setPriority: async (id) => {
    const previousAllProjects = get().allProjects
    const targetProject = previousAllProjects.find(p => p.id === id)

    if (!targetProject) return

    // 1. If already priority -> Toggle OFF
    if (targetProject.is_priority) {
      const updatedAllProjects = previousAllProjects.map(p =>
        p.id === id ? { ...p, is_priority: false } : p
      )
      const sorted = smartSortProjects(updatedAllProjects)

      set(state => ({
        allProjects: sorted,
        projects: filterProjects(sorted, state.filter)
      }))

      try {
        await api.patch(`projects/${id}`, { is_priority: false })
      } catch (error) {
        logger.error('Failed to unset priority:', error)
        // Rollback
        set(state => ({
          allProjects: previousAllProjects,
          projects: filterProjects(previousAllProjects, state.filter),
          error: error instanceof Error ? error.message : 'Failed to unset priority'
        }))
        throw error
      }
    } else {
      // 2. If NOT priority -> Set as ONLY priority
      const updatedAllProjects = previousAllProjects.map(p =>
        p.id === id ? { ...p, is_priority: true } : { ...p, is_priority: false }
      )
      const sorted = smartSortProjects(updatedAllProjects)

      set(state => ({
        allProjects: sorted,
        projects: filterProjects(sorted, state.filter)
      }))

      try {
        // Use atomic set-priority endpoint
        await api.post('projects?resource=set-priority', { project_id: id })
      } catch (error) {
        logger.error('Failed to set priority:', error)
        // Rollback
        set(state => ({
          allProjects: previousAllProjects,
          projects: filterProjects(previousAllProjects, state.filter),
          error: error instanceof Error ? error.message : 'Failed to set priority'
        }))
        throw error
      }
    }
  },

  setFilter: (filter) => {
    set(state => ({
      filter,
      projects: filterProjects(state.allProjects, filter)
    }))
  }
}))
