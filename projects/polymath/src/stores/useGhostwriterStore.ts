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
            // Mock API call for now if endpoint doesn't exist
            // In real implementation: await api.post('ai/synthesize', { projectId, contextIds, format })

            // Simulating network delay
            await new Promise(resolve => setTimeout(resolve, 2000))

            const mockDrafts = {
                brief: `# Project Brief\n\nBased on your thoughts and readings, here is a consolidated brief for this project.\n\n## Objectives\n- Objective 1\n- Objective 2\n\n## Key Insights\n- Insight from connected article\n- Insight from thought`,
                blog: `# Blog Post Title\n\nHere is a draft blog post synthesizing your recent research.\n\n## Introduction\n...\n\n## Body\n...`,
                outline: `# Project Outline\n\n1. Phase 1\n   - Task A\n   - Task B\n2. Phase 2`
            }

            set({ draft: mockDrafts[format], isSynthesizing: false })
        } catch (error) {
            set({ error: 'Failed to generate draft', isSynthesizing: false })
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
