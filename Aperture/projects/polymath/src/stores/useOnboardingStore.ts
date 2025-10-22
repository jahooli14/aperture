import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  MemoryPromptWithStatus,
  MemoryProgress,
  CreateMemoryResponseInput,
  SubmitMemoryResponse,
  MemoryPromptsResponse
} from '../types'

interface OnboardingStore {
  // State
  requiredPrompts: MemoryPromptWithStatus[]
  suggestedPrompts: MemoryPromptWithStatus[]
  optionalPrompts: MemoryPromptWithStatus[]
  progress: MemoryProgress | null
  loading: boolean
  error: string | null
  submitting: boolean

  // Actions
  fetchPrompts: () => Promise<void>
  submitResponse: (input: CreateMemoryResponseInput) => Promise<SubmitMemoryResponse>
  dismissPrompt: (promptId: string) => Promise<void>
  reset: () => void
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  // Initial state
  requiredPrompts: [],
  suggestedPrompts: [],
  optionalPrompts: [],
  progress: null,
  loading: false,
  error: null,
  submitting: false,

  // Fetch all prompts with user status
  fetchPrompts: async () => {
    set({ loading: true, error: null })

    try {
      // Try to get authenticated user, but don't require it
      const { data: { user } } = await supabase.auth.getUser()

      const headers: Record<string, string> = {}
      if (user) {
        headers['x-user-id'] = user.id
      }

      const response = await fetch('/api/memory-prompts', { headers })

      if (!response.ok) {
        throw new Error('Failed to fetch prompts')
      }

      const data: MemoryPromptsResponse = await response.json()

      set({
        requiredPrompts: data.required,
        suggestedPrompts: data.suggested,
        optionalPrompts: data.optional,
        progress: data.progress,
        loading: false
      })
    } catch (error) {
      console.error('[onboarding] Error fetching prompts:', error)
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      })
    }
  },

  // Submit memory response
  submitResponse: async (input: CreateMemoryResponseInput) => {
    set({ submitting: true, error: null })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const response = await fetch('/api/memory-responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify(input)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit response')
      }

      const result: SubmitMemoryResponse = await response.json()

      // Refresh prompts to get updated status
      await get().fetchPrompts()

      set({ submitting: false })
      return result
    } catch (error) {
      console.error('[onboarding] Error submitting response:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({
        error: errorMessage,
        submitting: false
      })
      throw error
    }
  },

  // Dismiss a suggested prompt
  dismissPrompt: async (promptId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update status directly in Supabase
      const { error } = await supabase
        .from('user_prompt_status')
        .update({
          status: 'dismissed',
          dismissed_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('prompt_id', promptId)

      if (error) throw error

      // Refresh prompts
      await get().fetchPrompts()
    } catch (error) {
      console.error('[onboarding] Error dismissing prompt:', error)
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  // Reset store
  reset: () => {
    set({
      requiredPrompts: [],
      suggestedPrompts: [],
      optionalPrompts: [],
      progress: null,
      loading: false,
      error: null,
      submitting: false
    })
  }
}))
