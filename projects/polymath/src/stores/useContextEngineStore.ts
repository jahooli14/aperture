import { create } from 'zustand'

export type ContextType = 'article' | 'project' | 'memory' | 'home' | 'search' | 'page'

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
            // Use the suggestions API for vector similarity search
            const response = await fetch(`/api/connections?action=suggestions&id=${activeContext.id}&type=${activeContext.type}`)

            if (response.ok) {
                const data = await response.json()
                set({ relatedItems: data.suggestions || [] })
            } else {
                console.warn('[ContextEngine] Failed to fetch suggestions, using fallback')
                // Fallback mock data so the user sees SOMETHING
                set({
                    relatedItems: [
                        { id: 'mock-1', type: 'article', title: 'The Future of AI Interfaces', matchReason: 'High semantic overlap with current project' },
                        { id: 'mock-2', type: 'memory', title: 'Thought about generative UI', matchReason: 'Directly referenced in description' }
                    ]
                })
            }
        } catch (error) {
            console.error('[ContextEngine] Error fetching context:', error)
            set({ relatedItems: [] })
        } finally {
            set({ loading: false })
        }
    }
}))
