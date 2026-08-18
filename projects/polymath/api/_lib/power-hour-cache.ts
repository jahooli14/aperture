/**
 * Power Hour Cache Manager
 *
 * Manages intelligent caching and invalidation for Power Hour plans:
 * - 20-hour global cache
 * - Per-project cache with smart invalidation on project updates
 * - Rate limiting to prevent spam regeneration
 */

import { getSupabaseClient } from './supabase.js'

const supabase = getSupabaseClient()

// Rate limiting: Track last generation time per project
const projectGenerationTimestamps = new Map<string, number>()

const CACHE_DURATION_MS = 20 * 60 * 60 * 1000 // 20 hours
const MIN_REGENERATION_INTERVAL_MS = 60 * 60 * 1000 // 1 hour between regenerations per project
// Different callers ask for different durations for the same project —
// KeepGoingCard always asks for the 60-minute default, Focus chat asks for
// whatever the user actually said ("I've got 20 minutes"). A single cache
// slot per project would make those two constantly evict each other,
// regenerating on nearly every request. Cache a handful of durations per
// project instead so both fit without fighting.
const MAX_CACHED_DURATIONS_PER_PROJECT = 4

interface CachedPlanEntry {
  duration: number
  tasks: any[]
  timestamp: string
}

export interface CacheStrategy {
  useGlobalCache: boolean
  useProjectCache: boolean
  projectId?: string
  forceRefresh: boolean
}

/**
 * Check if we should use cached Power Hour data
 */
export async function shouldUseCachedPowerHour(
  userId: string,
  projectId?: string,
  forceRefresh: boolean = false,
  durationMinutes: number = 60
): Promise<{ useCache: boolean; cachedTasks?: any; source?: string }> {
  if (forceRefresh) {
    return { useCache: false }
  }

  // 1. Check project-specific cache first (if targeting a project)
  if (projectId) {
    const projectCache = await getProjectCache(projectId, durationMinutes)
    if (projectCache) {
      console.log('[PowerHourCache] Using project-specific cache for:', projectId)
      return { useCache: true, cachedTasks: projectCache, source: 'project' }
    }
  }

  // 2. Check global cache (daily pre-generated)
  const globalCache = await getGlobalCache(userId)
  if (globalCache) {
    console.log('[PowerHourCache] Using global cache')
    return { useCache: true, cachedTasks: globalCache, source: 'global' }
  }

  return { useCache: false }
}

/**
 * Save Power Hour plan to cache
 */
export async function savePowerHourCache(
  userId: string,
  tasks: any[],
  projectId?: string,
  durationMinutes: number = 60
): Promise<void> {
  const timestamp = new Date().toISOString()

  // Save project-specific cache
  if (projectId && tasks.length > 0) {
    const projectTask = tasks.find(t => t.project_id === projectId)
    if (projectTask) {
      await saveProjectCache(projectId, [projectTask], timestamp, durationMinutes)
    }
  }

  // Save global cache
  if (!projectId && tasks.length > 0) {
    await saveGlobalCache(userId, tasks, timestamp)
  }
}

/**
 * Invalidate cache when a project is updated
 * Call this from project update endpoints
 */
export async function invalidateProjectCache(projectId: string): Promise<void> {
  console.log('[PowerHourCache] Invalidating cache for project:', projectId)

  const { data: project } = await supabase
    .from('projects')
    .select('metadata')
    .eq('id', projectId)
    .single()

  const { error } = await supabase
    .from('projects')
    .update({
      metadata: {
        ...project?.metadata,
        power_hour_cache_invalidated: true
      }
    })
    .eq('id', projectId)

  if (error) {
    console.error('[PowerHourCache] Failed to invalidate:', error)
  }
}

/**
 * Check rate limiting: Can we regenerate this project?
 */
export function canRegenerateProject(projectId: string): boolean {
  const lastGenerated = projectGenerationTimestamps.get(projectId)
  if (!lastGenerated) return true

  const elapsed = Date.now() - lastGenerated
  return elapsed > MIN_REGENERATION_INTERVAL_MS
}

/**
 * Mark project as regenerated (for rate limiting)
 */
export function markProjectRegenerated(projectId: string): void {
  projectGenerationTimestamps.set(projectId, Date.now())
}

// Private helpers

async function getProjectCache(projectId: string, durationMinutes: number): Promise<any[] | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('metadata')
    .eq('id', projectId)
    .single()

  // Check if cache is invalidated (project changed since any of these were generated)
  if (project?.metadata?.power_hour_cache_invalidated === true) {
    return null
  }

  const plans: CachedPlanEntry[] = project?.metadata?.power_hour_plans || []
  const entry = plans.find(p => p.duration === durationMinutes)
  if (!entry) return null

  const age = Date.now() - new Date(entry.timestamp).getTime()
  if (age > CACHE_DURATION_MS) {
    return null // Expired
  }

  return entry.tasks
}

async function getGlobalCache(userId: string): Promise<any[] | null> {
  const cutoff = new Date(Date.now() - CACHE_DURATION_MS).toISOString()

  const { data: cached } = await supabase
    .from('daily_power_hour')
    .select('*')
    .eq('user_id', userId)
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return cached?.tasks || null
}

async function saveProjectCache(
  projectId: string,
  tasks: any[],
  timestamp: string,
  durationMinutes: number
): Promise<void> {
  const { data: project } = await supabase
    .from('projects')
    .select('metadata')
    .eq('id', projectId)
    .single()

  const existing: CachedPlanEntry[] = project?.metadata?.power_hour_plans || []
  // Replace any existing entry for this exact duration, keep the rest,
  // and cap the list so a project someone keeps re-planning at slightly
  // different durations doesn't grow this unboundedly.
  const nextPlans = [...existing.filter(p => p.duration !== durationMinutes), { duration: durationMinutes, tasks, timestamp }]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_CACHED_DURATIONS_PER_PROJECT)

  await supabase
    .from('projects')
    .update({
      metadata: {
        ...project?.metadata,
        power_hour_plans: nextPlans,
        power_hour_cache_invalidated: false
      }
    })
    .eq('id', projectId)
}

async function saveGlobalCache(
  userId: string,
  tasks: any[],
  timestamp: string
): Promise<void> {
  await supabase
    .from('daily_power_hour')
    .insert({
      user_id: userId,
      tasks,
      created_at: timestamp
    })
}
