import { useState, useRef } from 'react'
import type { Project } from '../types'

export interface PerspectiveSuggestion {
  persona: string
  icon: string
  accentColor: string
  suggestion: string
  confidence: 'high' | 'medium'
  sourcesCited: string[]
}

export interface MultiPerspectiveResult {
  perspectives: PerspectiveSuggestion[]
  synthesized: string
  generatedAt: number
  lakeContext?: {
    memoriesUsed: number
    articlesUsed: number
    projectsUsed: number
  } | null
}

export interface ProjectContext {
  project: Project
  relatedMemories?: string[]
}

interface CacheEntry {
  result: MultiPerspectiveResult
  cachedAt: number
  projectId: string
}

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function useMultiPerspectiveAI() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MultiPerspectiveResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Per-project cache stored in a ref (survives re-renders, lost on unmount)
  const cache = useRef<Map<string, CacheEntry>>(new Map())

  const generate = async (context: ProjectContext) => {
    const { project, relatedMemories = [] } = context
    const projectId = project.id

    // Check cache first
    const cached = cache.current.get(projectId)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      setResult(cached.result)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Build context from project data
      const tasks = project.metadata?.tasks || []
      const doneTasks = tasks
        .filter((t: any) => t.done)
        .sort((a: any, b: any) => {
          const aDate = a.completed_at ? new Date(a.completed_at).getTime() : 0
          const bDate = b.completed_at ? new Date(b.completed_at).getTime() : 0
          return bDate - aDate
        })
        .slice(0, 5)
        .map((t: any) => t.text)

      const openTasks = tasks
        .filter((t: any) => !t.done)
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((t: any) => t.text)

      const payload = {
        projectId,
        projectTitle: project.title,
        projectDescription: project.description || '',
        recentActivity: doneTasks,
        openTodos: openTasks,
        relatedMemories
      }

      const response = await fetch('/api/power-hour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      const perspectiveResult: MultiPerspectiveResult = {
        perspectives: data.perspectives,
        synthesized: data.synthesized,
        generatedAt: data.generatedAt || Date.now(),
        lakeContext: data.lakeContext || null
      }

      // Cache the result
      cache.current.set(projectId, {
        result: perspectiveResult,
        cachedAt: Date.now(),
        projectId
      })

      setResult(perspectiveResult)
    } catch (err: any) {
      console.error('[useMultiPerspectiveAI] Error:', err)
      setError(err?.message || 'Failed to generate suggestions')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setResult(null)
    setError(null)
  }

  const clearCache = (projectId?: string) => {
    if (projectId) {
      cache.current.delete(projectId)
    } else {
      cache.current.clear()
    }
  }

  return { loading, result, error, generate, clear, clearCache }
}
