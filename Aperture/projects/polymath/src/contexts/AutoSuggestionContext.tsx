import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface Suggestion {
  id: string
  toItemType: 'project' | 'thought' | 'article'
  toItemId: string
  toItemTitle: string
  reasoning: string
  confidence: number
}

interface PendingSuggestions {
  [itemId: string]: Suggestion[]
}

interface AutoSuggestionContextType {
  pendingSuggestions: PendingSuggestions
  fetchSuggestions: (itemType: string, itemId: string, content: string) => Promise<void>
  loadExistingSuggestions: (itemId: string) => Promise<void>
  acceptSuggestion: (fromItemId: string, suggestion: Suggestion) => Promise<void>
  dismissSuggestion: (fromItemId: string, suggestionId: string) => void
  clearSuggestions: (itemId: string) => void
  isLoading: boolean
}

const AutoSuggestionContext = createContext<AutoSuggestionContextType | undefined>(undefined)

export function AutoSuggestionProvider({ children }: { children: ReactNode }) {
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingSuggestions>({})
  const [isLoading, setIsLoading] = useState(false)

  const loadExistingSuggestions = useCallback(async (itemId: string) => {
    try {
      // Query Supabase for pending suggestions for this item
      // NOTE: Database schema uses from_item_id/to_item_id/confidence (not source_id/target_id/confidence_score)
      const { data: suggestions, error } = await supabase
        .from('connection_suggestions')
        .select(`
          id,
          to_item_type,
          to_item_id,
          reasoning,
          confidence
        `)
        .eq('from_item_id', itemId)
        .eq('status', 'pending')

      if (error) {
        console.error('[AutoSuggestion] Error loading suggestions:', error)
        return
      }

      if (suggestions && suggestions.length > 0) {
        console.log(`[AutoSuggestion] Found ${suggestions.length} pending suggestions for ${itemId}`)

        // Fetch titles for each suggested item
        const enrichedSuggestions = await Promise.all(
          suggestions.map(async (s) => {
            let title = 'Unknown'

            try {
              if (s.to_item_type === 'project') {
                const { data } = await supabase
                  .from('projects')
                  .select('title')
                  .eq('id', s.to_item_id)
                  .single()
                title = data?.title || 'Unknown Project'
              } else if (s.to_item_type === 'thought') {
                const { data } = await supabase
                  .from('memories')
                  .select('title, body')
                  .eq('id', s.to_item_id)
                  .single()
                title = data?.title || data?.body?.substring(0, 50) + '...' || 'Unknown Thought'
              } else if (s.to_item_type === 'article') {
                const { data } = await supabase
                  .from('reading_queue')
                  .select('title')
                  .eq('id', s.to_item_id)
                  .single()
                title = data?.title || 'Unknown Article'
              }
            } catch (e) {
              console.error('[AutoSuggestion] Error fetching title:', e)
            }

            return {
              id: s.id,
              toItemType: s.to_item_type,
              toItemId: s.to_item_id,
              toItemTitle: title,
              reasoning: s.reasoning,
              confidence: s.confidence
            }
          })
        )

        setPendingSuggestions(prev => ({
          ...prev,
          [itemId]: enrichedSuggestions
        }))

        console.log(`[AutoSuggestion] Loaded ${enrichedSuggestions.length} suggestions for item ${itemId}`)
      } else {
        console.log(`[AutoSuggestion] No pending suggestions found for ${itemId}`)
      }
    } catch (error) {
      console.error('[AutoSuggestion] Error loading suggestions:', error)
    }
  }, [])

  const fetchSuggestions = useCallback(async (
    itemType: string,
    itemId: string,
    content: string
  ) => {
    // Get current user from Supabase
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !content) return

    setIsLoading(true)

    try {
      // Get existing connections to exclude them
      const response = await fetch(`/api/connections?itemId=${itemId}&itemType=${itemType}`)
      const { connections } = await response.json()
      const existingConnectionIds = connections?.map((c: any) => c.related_item_id) || []

      // Fetch AI suggestions
      const suggestResponse = await fetch('/api/connections?action=auto-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType,
          itemId,
          content,
          userId: user.id,
          existingConnectionIds
        })
      })

      if (!suggestResponse.ok) {
        throw new Error('Failed to fetch suggestions')
      }

      const { suggestions } = await suggestResponse.json()

      if (suggestions && suggestions.length > 0) {
        setPendingSuggestions(prev => ({
          ...prev,
          [itemId]: suggestions
        }))
      }
    } catch (error) {
      console.error('[AutoSuggestion] Error fetching suggestions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const acceptSuggestion = useCallback(async (
    fromItemId: string,
    suggestion: Suggestion
  ) => {
    // Get current user from Supabase
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Create the connection
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: fromItemId,
          itemType: pendingSuggestions[fromItemId]?.[0]?.toItemType || 'thought', // Get from context
          relatedItemId: suggestion.toItemId,
          relatedItemType: suggestion.toItemType,
          userId: user.id,
          connectionType: 'ai_suggested',
          suggestionId: suggestion.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create connection')
      }

      // Update suggestion status
      await fetch(`/api/connections?action=update-suggestion&id=${suggestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
      })

      // Remove from pending suggestions
      setPendingSuggestions(prev => ({
        ...prev,
        [fromItemId]: prev[fromItemId]?.filter(s => s.id !== suggestion.id) || []
      }))

      return Promise.resolve()
    } catch (error) {
      console.error('[AutoSuggestion] Error accepting suggestion:', error)
      return Promise.reject(error)
    }
  }, [pendingSuggestions])

  const dismissSuggestion = useCallback(async (
    fromItemId: string,
    suggestionId: string
  ) => {
    try {
      // Update suggestion status
      await fetch(`/api/connections?action=update-suggestion&id=${suggestionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' })
      })

      // Remove from pending suggestions
      setPendingSuggestions(prev => ({
        ...prev,
        [fromItemId]: prev[fromItemId]?.filter(s => s.id !== suggestionId) || []
      }))
    } catch (error) {
      console.error('[AutoSuggestion] Error dismissing suggestion:', error)
    }
  }, [])

  const clearSuggestions = useCallback((itemId: string) => {
    setPendingSuggestions(prev => {
      const newSuggestions = { ...prev }
      delete newSuggestions[itemId]
      return newSuggestions
    })
  }, [])

  return (
    <AutoSuggestionContext.Provider
      value={{
        pendingSuggestions,
        fetchSuggestions,
        loadExistingSuggestions,
        acceptSuggestion,
        dismissSuggestion,
        clearSuggestions,
        isLoading
      }}
    >
      {children}
    </AutoSuggestionContext.Provider>
  )
}

export function useAutoSuggestion() {
  const context = useContext(AutoSuggestionContext)
  if (!context) {
    throw new Error('useAutoSuggestion must be used within AutoSuggestionProvider')
  }
  return context
}
