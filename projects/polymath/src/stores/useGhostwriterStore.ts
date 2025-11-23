import { create } from 'zustand'
import { api } from '../lib/apiClient'

interface GhostwriterState {
    isSynthesizing: boolean
    draft: string | null
    error: string | null

    generateDraft: (projectId: string, contextIds: string[], format: 'brief' | 'blog' | 'outline') => Promise<void>
    saveDraft: (projectId: string, content: string, title: string) => Promise<void>
    clearDraft: () => void
}

export const useGhostwriterStore = create<GhostwriterState>((set) => ({
    isSynthesizing: false,
    draft: null,
    error: null,

    generateDraft: async (projectId, contextIds, format) => {
        set({ isSynthesizing: true, error: null })
        try {
            const response = await api.post('projects?resource=ghostwriter', { projectId, format })

            if (response.draft) {
                set({ draft: response.draft, isSynthesizing: false })
            } else {
                throw new Error('No draft returned from API')
            }
        } catch (error) {
            console.error('[Ghostwriter] Failed to generate draft:', error)
            set({
                error: error instanceof Error ? error.message : 'Failed to generate draft',
                isSynthesizing: false
            })
        }
    },

    saveDraft: async (projectId, content, title) => {
        try {
            await api.post(`projects?id=${projectId}&action=add_note`, {
                note_type: 'text',
                content: `# ${title}\n\n${content}`
            })
        } catch (error) {
            console.error('Failed to save draft:', error)
            throw error
        }
    },

    clearDraft: () => set({ draft: null, error: null })
}))
