import { create } from 'zustand'

export type ContextType = 'article' | 'project' | 'memory' | 'home' | 'search'

export interface ContextItem {
    id: string
    type: 'article' | 'project' | 'memory'
    title: string
    subtitle?: string
    url?: string // For articles
    image?: string
    matchReason?: string
}

interface ContextState {
    activeContext: {
        type: ContextType
        id?: string
        title?: string
        data?: any // Extra data like full article content for analysis
    }
    sidebarOpen: boolean
    relatedItems: ContextItem[]
    loading: boolean

    // Actions
    setContext: (type: ContextType, id?: string, title?: string, data?: any) => void
    toggleSidebar: (open?: boolean) => void
    fetchRelatedContext: () => Promise<void>
    clearContext: () => void
}

export const useContextEngineStore = create<ContextState>((set, get) => ({
    activeContext: { type: 'home' },
    sidebarOpen: false,
    relatedItems: [],
    loading: false,

    setContext: (type, id, title, data) => {
        const current = get().activeContext
        // Only update if changed to prevent loops
        if (current.type === type && current.id === id) return

        set({
            activeContext: { type, id, title, data },
            // Auto-fetch related items when context changes if sidebar is open
            // or just clear them until fetched
            relatedItems: []
        })

        // If sidebar is open, fetch immediately
        if (get().sidebarOpen) {
            get().fetchRelatedContext()
        }
    },

    toggleSidebar: (open) => {
        const newState = open ?? !get().sidebarOpen
        set({ sidebarOpen: newState })

        // If opening, fetch data if needed
        if (newState && get().relatedItems.length === 0) {
            get().fetchRelatedContext()
        }
    },

    clearContext: () => {
        set({
            activeContext: { type: 'home' },
            relatedItems: []
        })
    },

    fetchRelatedContext: async () => {
        const { activeContext } = get()
        if (activeContext.type === 'home' || !activeContext.id) {
            set({ relatedItems: [], loading: false })
            return
        }

        set({ loading: true })

        try {
            // Use the existing connections API but with a specific "context" action
            // We might need to adjust the API endpoint or use the existing 'suggest' action
            const response = await fetch('/api/connections?action=context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contextType: activeContext.type,
                    contextId: activeContext.id,
                    contextData: activeContext.data
                })
            })

            if (response.ok) {
                const data = await response.json()
                set({ relatedItems: data.items || [] })
            } else {
                // Fallback to empty if API fails (or isn't implemented yet)
                console.warn('[ContextEngine] Failed to fetch context, falling back to empty')
                set({ relatedItems: [] })
            }
        } catch (error) {
            console.error('[ContextEngine] Error fetching context:', error)
            set({ relatedItems: [] })
        } finally {
            set({ loading: false })
        }
    }
}))
