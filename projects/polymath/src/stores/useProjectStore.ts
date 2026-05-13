/**
 * Project Store (Zustand)
 * Manages projects state and API calls
 * 
 * OPTIMIZED FOR SPEED:
 * - Local-first filtering (fetches all, filters in memory)
 * - Optimistic updates (updates UI immediately, syncs in background)
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { persist } from 'zustand/middleware'
import type { Project } from '../types'
import { api } from '../lib/apiClient'
import { logger } from '../lib/logger'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'
import { scheduleAIEnrichment } from '../lib/aiEnrichmentManager'

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

    // 2. Most recently touched first (safe date parsing)
    const getTime = (dateStr?: string) => {
      if (!dateStr) return 0
      const ms = new Date(dateStr).getTime()
      return isNaN(ms) ? 0 : ms
    }

    const aTime = getTime(a.updated_at || a.last_active)
    const bTime = getTime(b.updated_at || b.last_active)

    return bTime - aTime
  })
}

// Helper to filter projects locally
function filterProjects(projects: Project[], filter: ProjectState['filter']): Project[] {
  if (filter === 'all') return projects
  if (filter === 'dormant') return projects.filter(p => ['dormant', 'on-hold', 'maintaining'].includes(p.status))
  return projects.filter(p => p.status === filter)
}

interface ProjectState {
  allProjects: Project[] // Source of truth
  projects: Project[] // Filtered view
  loading: boolean
  error: string | null
  filter: 'all' | 'upcoming' | 'active' | 'dormant' | 'completed' | 'graveyard'
  initialized: boolean
  offlineMode: boolean

  // Actions
  fetchProjects: (retryCount?: number) => Promise<void>
  createProject: (data: Partial<Project>) => Promise<void>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setPriority: (id: string) => Promise<void>
  setUpNext: (id: string) => Promise<void>
  replaceUpNext: (newId: string, replaceId: string) => Promise<void>
  reorderUpNext: (orderedIds: string[]) => Promise<void>
  setFilter: (filter: ProjectState['filter']) => void
  clearCache: () => void
  // React Query Sync Actions
  setProjects: (projects: Project[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  syncProject: (project: Project) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      allProjects: [],
      projects: [],
      loading: false,
      error: null,
      filter: 'all',
      initialized: false,
      offlineMode: false,

      fetchProjects: async (retryCount = 0) => {
        const MAX_RETRIES = 3
        const RETRY_DELAYS = [1000, 2000, 4000]

        // Silently update if we already have data
        const isStale = get().allProjects.length === 0
        if (isStale) {
          set({ loading: true, error: null })
        }

        // Helper to merge pending operations
        const mergePending = async (baseProjects: Project[]) => {
          const { getPendingOperations } = await import('../lib/offlineQueue')
          const pendingOps = await getPendingOperations()

          return baseProjects.map(p => {
            const updates = pendingOps
              .filter(op => op.type === 'update_project' && op.data.id === p.id)
              .reduce((acc, op) => ({ ...acc, ...op.data }), {})

            return Object.keys(updates).length > 0 ? { ...p, ...updates } : p
          })
        }

        // Check online status
        if (!navigator.onLine) {
          logger.debug('[ProjectStore] Offline mode detected - fetching from local DB')
          try {
            const { readingDb } = await import('../lib/db')
            const cachedProjects = await readingDb.getCachedProjects()
            let projects = cachedProjects as unknown as Project[]

            // Merge pending local changes even when offline (they should already be there but for safety)
            projects = await mergePending(projects)
            const sorted = smartSortProjects(projects)

            set(state => ({
              allProjects: sorted,
              projects: filterProjects(sorted, state.filter),
              loading: false,
              initialized: true,
              offlineMode: true,
              error: null
            }))
            return
          } catch (e) {
            logger.error('[ProjectStore] Failed to load offline projects:', e)
            set({ error: 'Failed to load offline projects', loading: false, offlineMode: true })
            return
          }
        }

        try {
          // Always fetch ALL projects
          const data = await api.get('projects')
          let fetchedProjects = Array.isArray(data) ? data : data?.projects || []

          // Cache projects for offline use (IndexedDB)
          try {
            const { readingDb } = await import('../lib/db')
            await readingDb.cacheProjects(fetchedProjects)
          } catch (cacheError) {
            logger.warn('[ProjectStore] Failed to cache projects:', cacheError)
          }

          // Merge pending local changes to avoid clobbering optimistic updates
          fetchedProjects = await mergePending(fetchedProjects)

          // Sort once
          fetchedProjects = smartSortProjects(fetchedProjects)

          // Smart update: Skip if data hasn't changed to prevent flickering during background sync
          const currentProjects = get().allProjects
          if (currentProjects.length === fetchedProjects.length && fetchedProjects.length > 0) {
            // Quick check: compare IDs and updated_at timestamps
            const hasChanged = fetchedProjects.some((newP: Project, idx: number) => {
              const oldP = currentProjects[idx]
              return !oldP ||
                     newP.id !== oldP.id ||
                     newP.updated_at !== oldP.updated_at ||
                     newP.status !== oldP.status ||
                     newP.is_priority !== oldP.is_priority
            })

            if (!hasChanged) {
              logger.debug('[ProjectStore] Skipping state update - data unchanged')
              set({ loading: false, initialized: true, offlineMode: false, error: null })
              return
            }
          }

          set(state => ({
            allProjects: fetchedProjects,
            projects: filterProjects(fetchedProjects, state.filter),
            loading: false,
            initialized: true,
            offlineMode: false,
            error: null
          }))
        } catch (error) {
          logger.error('Failed to fetch projects:', error)

          // Fallback to offline DB on error
          logger.debug('[ProjectStore] Fetch failed, falling back to offline DB')
          try {
            const { readingDb } = await import('../lib/db')
            const cachedProjects = await readingDb.getCachedProjects()
            const projects = cachedProjects as unknown as Project[]
            const sorted = smartSortProjects(projects)

            set(state => ({
              allProjects: sorted,
              projects: filterProjects(sorted, state.filter),
              loading: false,
              initialized: true,
              offlineMode: true,
              error: null
            }))
            return
          } catch (dbError) {
            // If offline fallback fails, try retry logic
          }

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
        const { isOnline } = useOfflineStore.getState()

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

        // If offline, queue the create and keep the optimistic temp-id project
        // in view. syncManager replays this on reconnect and the next pull will
        // reconcile the real server id.
        if (!isOnline) {
          import('../lib/db').then(({ readingDb }) => {
            readingDb.cacheProjects(newAllProjects).catch(e => logger.warn('Failed to cache projects after offline create:', e))
          })
          await queueOperation('create_project', { tempId, ...data })
          await useOfflineStore.getState().updateQueueSize()
          return
        }

        try {
          const result = await api.post('projects', data)

          // Replace temp ID with real ID
          set(state => {
            const updatedAll = state.allProjects.map(p =>
              p.id === tempId ? { ...result, ...data } : p
            )
            // Re-sort in case server data changes order (unlikely for new)
            const sorted = smartSortProjects(updatedAll)

            // Update cache
            import('../lib/db').then(({ readingDb }) => {
              readingDb.cacheProjects(sorted).catch(e => logger.warn('Failed to cache projects after create:', e))
            })

            return {
              allProjects: sorted,
              projects: filterProjects(sorted, state.filter)
            }
          })
        } catch (error) {
          logger.error('[ProjectStore] Failed to create project:', error)
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

        // Update cache optimistically
        import('../lib/db').then(({ readingDb }) => {
          readingDb.cacheProjects(sortedAllProjects).catch(e => logger.warn('Failed to cache projects after update:', e))
        })

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

          // Schedule AI enrichment if tasks OR context were touched (debounced 1 min)
          const hasTaskUpdates = !!data.metadata?.tasks
          const hasContextUpdates = !!data.description || !!data.title || !!data.metadata?.end_goal || !!data.metadata?.motivation

          if (hasTaskUpdates || hasContextUpdates) {
            const project = get().allProjects.find(p => p.id === id)
            const tasks = data.metadata?.tasks || project?.metadata?.tasks || []
            const currentTaskCount = tasks.length

            let hasNewOrCompletedTasks = false
            if (hasTaskUpdates) {
              const hasCompletedTasks = tasks.some((t: { done?: boolean; completed_at?: string }) =>
                t.done || t.completed_at
              )
              const previousTaskCount = project?.metadata?.tasks?.length || 0
              hasNewOrCompletedTasks = currentTaskCount !== previousTaskCount || hasCompletedTasks
            }

            scheduleAIEnrichment(id, currentTaskCount, hasNewOrCompletedTasks || hasContextUpdates)
          }
        } catch (error) {
          logger.error('Failed to update project:', error)
          // Rollback
          set(state => ({
            allProjects: previousAllProjects,
            projects: filterProjects(previousAllProjects, state.filter),
            error: error instanceof Error ? error.message : 'Failed to update project'
          }))
          // Revert cache
          import('../lib/db').then(({ readingDb }) => {
            readingDb.cacheProjects(previousAllProjects).catch(e => logger.warn('Failed to revert project cache:', e))
          })
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

        // Update cache optimistically
        import('../lib/db').then(({ readingDb }) => {
          readingDb.projects.delete(id).catch(e => logger.warn('Failed to delete project from cache:', e))
        })

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
          // Revert cache
          import('../lib/db').then(({ readingDb }) => {
            readingDb.cacheProjects(previousAllProjects).catch(e => logger.warn('Failed to revert project cache:', e))
          })
          throw error
        }
      },

      setPriority: async (id) => {
        // Multi-priority (focus tier, cap 3). The server enforces the cap and
        // returns 409 'focus_cap_reached' when exceeded — we surface that error
        // unchanged so the UI can prompt the user to demote something.
        const previousAllProjects = get().allProjects
        const targetProject = previousAllProjects.find(p => p.id === id)

        if (!targetProject) return

        const nextValue = !targetProject.is_priority

        // Optimistic update. When promoting to priority, also demote all
        // other priorities locally (cap=1, server auto-demotes too) and
        // clear up_next_position on the new priority (mutually exclusive).
        const updatedAllProjects = previousAllProjects.map(p => {
          if (p.id === id) {
            return { ...p, is_priority: nextValue, ...(nextValue ? { up_next_position: null } : {}) }
          }
          if (nextValue && p.is_priority) {
            return { ...p, is_priority: false }
          }
          return p
        })
        const sorted = smartSortProjects(updatedAllProjects)

        set(state => ({
          allProjects: sorted,
          projects: filterProjects(sorted, state.filter)
        }))

        import('../lib/db').then(({ readingDb }) => {
          readingDb.cacheProjects(sorted).catch(e => logger.warn('Failed to cache projects after priority toggle:', e))
        })

        try {
          const response = await api.post('projects?resource=set-priority', { project_id: id })
          if (response && response.projects) {
            const sortedResponse = smartSortProjects(response.projects)
            set(state => ({
              allProjects: sortedResponse,
              projects: filterProjects(sortedResponse, state.filter)
            }))
            import('../lib/db').then(({ readingDb }) => {
              readingDb.cacheProjects(sortedResponse).catch(e => logger.warn('Failed to cache projects after priority set (server):', e))
            })
          }
        } catch (error: any) {
          logger.error('Failed to toggle priority:', error)
          // Rollback optimistic update
          set(state => ({
            allProjects: previousAllProjects,
            projects: filterProjects(previousAllProjects, state.filter),
            error: error?.message || 'Failed to toggle priority'
          }))
          import('../lib/db').then(({ readingDb }) => {
            readingDb.cacheProjects(previousAllProjects).catch(e => logger.warn('Failed to revert project cache:', e))
          })
          throw error
        }
      },

      setUpNext: async (id) => {
        // Toggle: if already pinned, remove. Otherwise add.
        const previousAllProjects = get().allProjects
        const targetProject = previousAllProjects.find(p => p.id === id)
        if (!targetProject) return

        // Offline-created projects carry a temp id until the queue syncs and
        // the server assigns a real UUID. Pinning one would 404. Bail with a
        // friendly error the caller can show in a toast.
        if (typeof id === 'string' && id.startsWith('temp-')) {
          const err = new Error('This project hasn\'t synced yet. Try again in a moment.')
          ;(err as any).code = 'project_not_synced'
          throw err
        }

        const isPinned = targetProject.up_next_position != null
        const action = isPinned ? 'remove' : 'add'

        try {
          const response = await api.post('projects?resource=up-next', { action, project_id: id })
          if (response && response.projects) {
            const sortedResponse = smartSortProjects(response.projects)
            set(state => ({
              allProjects: sortedResponse,
              projects: filterProjects(sortedResponse, state.filter)
            }))
            import('../lib/db').then(({ readingDb }) => {
              readingDb.cacheProjects(sortedResponse).catch(e => logger.warn('Failed to cache projects after Up Next toggle:', e))
            })
          }
        } catch (error: any) {
          logger.error('Failed to toggle Up Next:', error)
          // 404 means our local cache has a project the server doesn't —
          // refetch so the stale tile disappears next render.
          if (error?.status === 404) {
            get().fetchProjects().catch(e => logger.warn('Refresh after 404 failed:', e))
            const friendly = new Error('That project isn\'t on the server. Refreshing your list.')
            ;(friendly as any).status = 404
            throw friendly
          }
          throw error
        }
      },

      replaceUpNext: async (newId, replaceId) => {
        if (typeof newId === 'string' && newId.startsWith('temp-')) {
          const err = new Error('This project hasn\'t synced yet. Try again in a moment.')
          ;(err as any).code = 'project_not_synced'
          throw err
        }
        try {
          const response = await api.post('projects?resource=up-next', {
            action: 'replace',
            project_id: newId,
            replace_id: replaceId,
          })
          if (response && response.projects) {
            const sortedResponse = smartSortProjects(response.projects)
            set(state => ({
              allProjects: sortedResponse,
              projects: filterProjects(sortedResponse, state.filter)
            }))
            import('../lib/db').then(({ readingDb }) => {
              readingDb.cacheProjects(sortedResponse).catch(e => logger.warn('Failed to cache projects after Up Next replace:', e))
            })
          }
        } catch (error: any) {
          logger.error('Failed to replace Up Next slot:', error)
          if (error?.status === 404) {
            get().fetchProjects().catch(e => logger.warn('Refresh after 404 failed:', e))
            const friendly = new Error('That project isn\'t on the server. Refreshing your list.')
            ;(friendly as any).status = 404
            throw friendly
          }
          throw error
        }
      },

      reorderUpNext: async (orderedIds) => {
        // Optimistic: rewrite positions locally first so the drag feels instant.
        const previousAllProjects = get().allProjects
        const positionById = new Map<string, number>()
        orderedIds.forEach((id, i) => positionById.set(id, i + 1))
        const optimistic = previousAllProjects.map(p =>
          positionById.has(p.id) ? { ...p, up_next_position: positionById.get(p.id)! } : p
        )
        set(state => ({
          allProjects: optimistic,
          projects: filterProjects(optimistic, state.filter),
        }))

        try {
          const response = await api.post('projects?resource=up-next', {
            action: 'reorder',
            order: orderedIds,
          })
          if (response && response.projects) {
            const sortedResponse = smartSortProjects(response.projects)
            set(state => ({
              allProjects: sortedResponse,
              projects: filterProjects(sortedResponse, state.filter)
            }))
          }
        } catch (error: any) {
          logger.error('Failed to reorder Up Next:', error)
          // Roll back
          set(state => ({
            allProjects: previousAllProjects,
            projects: filterProjects(previousAllProjects, state.filter),
          }))
          throw error
        }
      },

      setFilter: (filter) => {
        set(state => ({
          filter,
          projects: filterProjects(state.allProjects, filter)
        }))
      },

      clearCache: () => {
        set({ allProjects: [], projects: [], initialized: false, error: null })
      },
      setProjects: async (projects) => {
        // When setting projects (e.g. from sync or background fetch), 
        // we MUST protect pending local changes
        const { getPendingOperations } = await import('../lib/offlineQueue')
        const pendingOps = await getPendingOperations()

        const merged = projects.map(p => {
          const updates = pendingOps
            .filter(op => op.type === 'update_project' && op.data.id === p.id)
            .reduce((acc, op) => ({ ...acc, ...op.data }), {})

          return Object.keys(updates).length > 0 ? { ...p, ...updates } : p
        })

        const sorted = smartSortProjects(merged)
        set({
          allProjects: sorted,
          projects: filterProjects(sorted, get().filter),
          initialized: true
        })
      },
      syncProject: async (project) => {
        // Protect pending local changes during sync
        const { getPendingOperations } = await import('../lib/offlineQueue')
        const pendingOps = await getPendingOperations()

        const updates = pendingOps
          .filter(op => op.type === 'update_project' && op.data.id === project.id)
          .reduce((acc, op) => ({ ...acc, ...op.data }), {})

        const mergedProject = Object.keys(updates).length > 0 ? { ...project, ...updates } : project

        set(state => {
          const exists = state.allProjects.some(p => p.id === mergedProject.id)
          let newAllProjects
          if (exists) {
            newAllProjects = state.allProjects.map(p => p.id === mergedProject.id ? mergedProject : p)
          } else {
            newAllProjects = [...state.allProjects, mergedProject]
          }
          const sorted = smartSortProjects(newAllProjects)

          // Update cache silently
          import('../lib/db').then(({ readingDb }) => {
            readingDb.cacheProjects(sorted).catch(e => logger.warn('Failed to cache synced project:', e))
          })

          return {
            allProjects: sorted,
            projects: filterProjects(sorted, state.filter)
          }
        })
      },
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error })
    }),
    {
      name: 'rosette-projects-store',
      partialize: (state) => ({ allProjects: state.allProjects }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.initialized = true
          state.projects = filterProjects(state.allProjects, state.filter)
        }
      }
    }
  )
)

// Selectors — derived data from the store
export const useUnshapedProjects = () =>
  useProjectStore(useShallow(state => state.allProjects.filter(p => p.metadata?.is_shaped === false)))

// Active, shaped projects only. Up Next has its own shelf; pinned projects
// are excluded from the "recent" selector so they don't show up twice.
const isActiveShaped = (p: { status?: string; metadata?: { is_shaped?: boolean } }) =>
  ['active', 'upcoming'].includes(p.status ?? '') && p.metadata?.is_shaped !== false

// The starred project, if one is set. Drives the "priority" home section.
export const usePriorityProject = () =>
  useProjectStore(useShallow(state =>
    state.allProjects.filter(isActiveShaped).find(p => p.is_priority) ?? null
  ))

// The most-recently-touched active project that isn't the priority and
// isn't sitting in Up Next. Drives the "still warm" home section.
export const useMostRecentNonPriorityProject = () =>
  useProjectStore(useShallow(state => {
    const active = state.allProjects.filter(isActiveShaped)
    const priorityId = active.find(p => p.is_priority)?.id
    return active
      .filter(p => p.up_next_position == null && p.id !== priorityId)
      .sort((a, b) => {
        const aTime = new Date(a.last_active || a.updated_at || 0).getTime()
        const bTime = new Date(b.last_active || b.updated_at || 0).getTime()
        return bTime - aTime
      })[0] ?? null
  }))

// The N most-recently-touched active projects that aren't the priority
// and aren't sitting in Up Next. Drives the "recently active" home row.
export const useRecentNonPriorityProjects = (limit = 2) =>
  useProjectStore(useShallow(state => {
    const active = state.allProjects.filter(isActiveShaped)
    const priorityId = active.find(p => p.is_priority)?.id
    return active
      .filter(p => p.up_next_position == null && p.id !== priorityId)
      .sort((a, b) => {
        const aTime = new Date(a.last_active || a.updated_at || 0).getTime()
        const bTime = new Date(b.last_active || b.updated_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, limit)
  }))

// Up Next shelf: projects with up_next_position set, sorted by position asc.
export const useUpNextProjects = () =>
  useProjectStore(useShallow(state =>
    state.allProjects
      .filter(p => p.up_next_position != null)
      .sort((a, b) => (a.up_next_position ?? 99) - (b.up_next_position ?? 99))
  ))
