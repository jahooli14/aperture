/**
 * Connection Suggestions Store
 * Manages real-time connection suggestions
 */

import { create } from 'zustand'

export interface ConnectionSuggestion {
  targetId: string
  targetType: 'memory' | 'project' | 'article'
  targetTitle: string
  reason: string
  confidence: number
  snippet?: string
}

interface ConnectionState {
  suggestions: ConnectionSuggestion[]
  sourceId: string | null
  sourceType: 'memory' | 'article' | null
  loading: boolean

  // Actions
  fetchSuggestions: (sourceType: 'memory' | 'article', sourceId: string, content: string, title?: string) => Promise<void>
  clearSuggestions: () => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  suggestions: [],
  sourceId: null,
  sourceType: null,
  loading: false,

  fetchSuggestions: async (sourceType, sourceId, content, title) => {
    set({ loading: true })

    try {
      const response = await fetch('/api/connections/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: sourceType,
          contentId: sourceId,
          contentText: content,
          contentTitle: title
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch connection suggestions')
      }

      const { suggestions } = await response.json()

      set({
        suggestions,
        sourceId,
        sourceType,
        loading: false
      })
    } catch (error) {
      console.error('[ConnectionStore] Error fetching suggestions:', error)
      set({ loading: false })
    }
  },

  clearSuggestions: () => {
    set({
      suggestions: [],
      sourceId: null,
      sourceType: null
    })
  }
}))
