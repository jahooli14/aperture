/**
 * Prefetch Hook
 * Preloads data for likely next pages to make navigation instant
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { cacheManager, CACHE_PRESETS } from '../lib/cacheManager'
import { supabase } from '../lib/supabase'

/**
 * Prefetch strategies based on current page
 */
const PREFETCH_STRATEGIES: Record<string, string[]> = {
  '/': ['memories', 'projects', 'suggestions'], // Homepage users likely go to memories or projects
  '/memories': ['projects', 'today'], // After memories, often check projects or today
  '/projects': ['memories', 'today'], // After projects, often check memories or today
  '/today': ['projects', 'memories'], // Today page links to both
  '/suggestions': ['projects', 'memories'], // Suggestions lead to projects
  '/reading': ['projects'], // Reading users often check projects next
}

/**
 * Prefetch functions for each data type
 */
async function prefetchMemories() {
  await cacheManager.prefetch(
    'memories:all',
    async () => {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    CACHE_PRESETS.normal
  )
}

async function prefetchProjects() {
  await cacheManager.prefetch(
    'projects?filter=all',
    async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')

      if (error) throw error
      return data || []
    },
    CACHE_PRESETS.normal
  )
}

async function prefetchSuggestions() {
  await cacheManager.prefetch(
    'suggestions:all',
    async () => {
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    CACHE_PRESETS.normal
  )
}

async function prefetchToday() {
  await cacheManager.prefetch(
    'daily-queue',
    async () => {
      const response = await fetch('/api/projects?resource=daily-queue')
      if (!response.ok) throw new Error('Failed to fetch daily queue')
      return response.json()
    },
    CACHE_PRESETS.normal
  )
}

/**
 * Map resource names to prefetch functions
 */
const PREFETCH_FUNCTIONS: Record<string, () => Promise<void>> = {
  memories: prefetchMemories,
  projects: prefetchProjects,
  suggestions: prefetchSuggestions,
  today: prefetchToday,
}

/**
 * Hook that automatically prefetches data for likely next pages
 */
export function usePrefetch() {
  const location = useLocation()

  useEffect(() => {
    const currentPath = location.pathname
    const resourcesToPrefetch = PREFETCH_STRATEGIES[currentPath] || []

    // Prefetch after a short delay (let the current page load first)
    const timer = setTimeout(() => {
      console.log(`[Prefetch] Preloading for page: ${currentPath}`)

      resourcesToPrefetch.forEach(resource => {
        const prefetchFn = PREFETCH_FUNCTIONS[resource]
        if (prefetchFn) {
          prefetchFn().catch(err => {
            console.error(`[Prefetch] Failed to prefetch ${resource}:`, err)
          })
        }
      })
    }, 500) // 500ms delay to not interfere with current page

    return () => clearTimeout(timer)
  }, [location.pathname])
}

/**
 * Manual prefetch function for hover states
 */
export function prefetchPage(page: string) {
  const resources = PREFETCH_STRATEGIES[page] || []

  resources.forEach(resource => {
    const prefetchFn = PREFETCH_FUNCTIONS[resource]
    if (prefetchFn) {
      prefetchFn().catch(err => {
        console.error(`[Prefetch] Failed to prefetch ${resource}:`, err)
      })
    }
  })
}
