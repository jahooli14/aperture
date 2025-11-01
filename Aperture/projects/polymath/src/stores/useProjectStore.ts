/**
 * Project Store (Zustand)
 * Manages projects state and API calls
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Project } from '../types'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

/**
 * Smart project sorting with resurfacing algorithm
 *
 * Sorting priority:
 * 1. Status priority (upcoming > active > on-hold > maintaining > completed > archived)
 * 2. Resurfacing boost for dormant projects (not touched in 7+ days)
 * 3. Most recently touched
 */
function smartSortProjects(projects: Project[]): Project[] {
  // Safety check
  if (!Array.isArray(projects)) {
    console.warn('[smartSortProjects] Invalid projects array:', projects)
    return []
  }

  const now = new Date()

  // Status priority order
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
    // 1. Compare status priority
    const statusDiff = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
    if (statusDiff !== 0) return statusDiff

    // 2. Calculate days since last active
    const aDaysAgo = (now.getTime() - new Date(a.last_active).getTime()) / (1000 * 60 * 60 * 24)
    const bDaysAgo = (now.getTime() - new Date(b.last_active).getTime()) / (1000 * 60 * 60 * 24)

    // 3. Resurfacing boost for dormant projects (7-30 days)
    // Projects untouched for 7-30 days get periodically boosted to the top
    const aIsDormant = aDaysAgo >= 7 && aDaysAgo <= 30
    const bIsDormant = bDaysAgo >= 7 && bDaysAgo <= 30

    if (aIsDormant !== bIsDormant) {
      // Calculate resurfacing score (higher for projects around 14-21 days)
      const getResurfaceScore = (daysAgo: number) => {
        if (daysAgo < 7) return 0
        if (daysAgo > 30) return 0
        // Peak at 14-21 days, gradual on both sides
        return Math.sin(((daysAgo - 7) / 23) * Math.PI) * 100
      }

      const aResurfaceScore = aIsDormant ? getResurfaceScore(aDaysAgo) : 0
      const bResurfaceScore = bIsDormant ? getResurfaceScore(bDaysAgo) : 0

      // Use deterministic resurfacing based on day of week
      const dayOfWeek = now.getDay()
      const aResurfaceDay = Math.floor(aDaysAgo) % 7
      const bResurfaceDay = Math.floor(bDaysAgo) % 7

      // Resurface different projects on different days
      if (aResurfaceDay === dayOfWeek && bResurfaceDay !== dayOfWeek) return -1
      if (bResurfaceDay === dayOfWeek && aResurfaceDay !== dayOfWeek) return 1

      // Otherwise use resurfacing score
      if (aResurfaceScore !== bResurfaceScore) return bResurfaceScore - aResurfaceScore
    }

    // 4. Most recently touched first
    return bDaysAgo - aDaysAgo
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

      console.log('[FETCH] Starting fetch with filter:', filter)

      // Force fresh data by adding a unique parameter (cache busting)
      let query = supabase
        .from('projects')
        .select('*')

      // Apply filters
      if (filter === 'upcoming') {
        query = query.eq('status', 'upcoming')
      } else if (filter === 'active') {
        query = query.eq('status', 'active')
      } else if (filter === 'dormant') {
        query = query.in('status', ['active', 'on-hold'])
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed')
      }

      const { data, error } = await query

      console.log('[FETCH] Raw data from Supabase:', data?.map(p => ({
        title: p.title,
        status: p.status,
        id: p.id.substring(0, 8),
        tasks: (p.metadata?.tasks || []).map((t: any) => ({ text: t.text, done: t.done, order: t.order }))
      })))

      if (error) throw error

      let projects = data || []

      // For 'dormant' filter, further filter by last_active date client-side
      if (filter === 'dormant') {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        projects = projects.filter(p => new Date(p.last_active) < sevenDaysAgo)
      }

      // Smart sorting
      projects = smartSortProjects(projects)

      console.log('[FETCH] After sorting:', projects.map(p => ({
        title: p.title,
        status: p.status
      })))

      set({ projects, loading: false })

      console.log('[FETCH] Final projects in store:', get().projects.map(p => ({
        title: p.title,
        status: p.status
      })))
    } catch (error) {
      console.error('[FETCH] Error:', error)
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
    const previousProjects = get().projects

    const { isOnline } = useOfflineStore.getState()

    // If offline, queue operation
    if (!isOnline) {
      await queueOperation('update_project', { id, ...data })
      await useOfflineStore.getState().updateQueueSize()
      return
    }

    // Online flow - NO optimistic update, just write and refresh
    try {
      const updateData = {
        ...data,
        last_active: new Date().toISOString()
      }

      console.log('[ProjectStore.updateProject] Updating project:', id.substring(0, 8))
      console.log('[ProjectStore.updateProject] Update data:', JSON.stringify(updateData, null, 2))

      const { data: updatedData, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()

      if (error) {
        console.error('[ProjectStore.updateProject] Supabase error:', error)
        throw error
      }

      console.log('[ProjectStore.updateProject] Update successful, response:', updatedData)

      // Refresh from database
      console.log('[ProjectStore.updateProject] Refreshing projects from database...')
      await get().fetchProjects()
      console.log('[ProjectStore.updateProject] Refresh complete')
    } catch (error) {
      console.error('[ProjectStore.updateProject] Failed:', error)
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

      console.log('[ProjectStore] Project deletion queued for offline sync')
      return
    }

    // Online flow
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      // Rollback on error
      set({ projects: previousProjects })
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
