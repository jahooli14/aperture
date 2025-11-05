/**
 * Suggestion Store (Zustand)
 * Manages project suggestions state and API calls
 */

import { create } from 'zustand'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

interface ProjectSuggestion {
  id: string
  user_id: string
  title: string
  description: string
  capability_ids: string[]
  novelty_score: number
  feasibility_score: number
  interest_score: number
  total_points: number
  is_wildcard: boolean
  status: 'pending' | 'spark' | 'meh' | 'built' | 'dismissed' | 'saved'
  created_at: string
  metadata?: any
}

interface SuggestionState {
  suggestions: ProjectSuggestion[]
  loading: boolean
  error: string | null
  filter: 'all' | 'pending' | 'spark' | 'saved' | 'built'
  sortBy: 'points' | 'recent' | 'rating'
  synthesizing: boolean

  // Actions
  fetchSuggestions: () => Promise<void>
  rateSuggestion: (id: string, rating: number) => Promise<void>
  buildSuggestion: (id: string, projectData?: {
    title?: string
    description?: string
    type?: 'hobby' | 'side-project' | 'learning'
  }) => Promise<any>
  triggerSynthesis: () => Promise<void>
  setFilter: (filter: SuggestionState['filter']) => void
  setSortBy: (sortBy: SuggestionState['sortBy']) => void
}

export const useSuggestionStore = create<SuggestionState>((set, get) => ({
  suggestions: [],
  loading: false,
  error: null,
  filter: 'pending',
  sortBy: 'points',
  synthesizing: false,

  fetchSuggestions: async () => {
    set({ loading: true, error: null })

    try {
      const { filter } = get()
      const params = new URLSearchParams()

      if (filter !== 'all') {
        params.append('status', filter)
      }

      const response = await fetch(`${API_BASE}/projects?resource=suggestions&${params}`)

      if (!response.ok) {
        const text = await response.text()
        // Check if response is HTML (error page)
        if (text.includes('<!doctype') || text.includes('<!DOCTYPE')) {
          throw new Error(`API returned error page (${response.status}). Check API endpoint.`)
        }
        throw new Error(`Failed to fetch suggestions: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        throw new Error('API did not return JSON. Check endpoint configuration.')
      }

      const data = await response.json()
      set({ suggestions: data.suggestions || [], loading: false })
    } catch (error) {
      console.error('Fetch suggestions error:', error)
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      })
    }
  },

  rateSuggestion: async (id: string, rating: number) => {
    try {
      console.log('[store] Rating suggestion:', id, 'with rating:', rating)
      const response = await fetch(`${API_BASE}/projects?resource=suggestions&action=rate&id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[store] Rating failed:', errorData)
        throw new Error(errorData.error || 'Failed to rate suggestion')
      }

      console.log('[store] Rating successful')
      // Refresh suggestions after rating
      await get().fetchSuggestions()
    } catch (error) {
      console.error('[store] Rating error:', error)
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  buildSuggestion: async (id: string, projectData?: {
    title?: string
    description?: string
  }) => {
    try {
      const response = await fetch(`${API_BASE}/projects?resource=suggestions&action=build&id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_title: projectData?.title,
          project_description: projectData?.description,
        })
      })

      if (!response.ok) {
        throw new Error('Failed to build suggestion')
      }

      // Refresh suggestions after building
      await get().fetchSuggestions()

      return await response.json()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  triggerSynthesis: async () => {
    set({ synthesizing: true, error: null })

    try {
      const response = await fetch(`${API_BASE}/cron/jobs?job=synthesis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        // Extract helpful error message from API response
        const errorMsg = data.error || 'Failed to trigger synthesis'
        const suggestion = data.suggestions || ''
        const fullError = suggestion ? `${errorMsg}\n\n${suggestion}` : errorMsg
        throw new Error(fullError)
      }

      // Refresh suggestions after synthesis
      await get().fetchSuggestions()

      set({ synthesizing: false })

      return data
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        synthesizing: false
      })
      throw error
    }
  },

  setFilter: (filter) => {
    set({ filter })
    get().fetchSuggestions()
  },

  setSortBy: (sortBy) => {
    set({ sortBy })
    // Sort existing suggestions in memory
    const { suggestions } = get()
    const sorted = [...suggestions].sort((a, b) => {
      if (sortBy === 'points') return b.total_points - a.total_points
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'rating') {
        const ratingOrder = { spark: 3, saved: 2, pending: 1, meh: 0, dismissed: -1, built: 4 }
        return ratingOrder[b.status] - ratingOrder[a.status]
      }
      return 0
    })
    set({ suggestions: sorted })
  }
}))
