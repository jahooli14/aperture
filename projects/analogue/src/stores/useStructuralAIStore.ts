import { create } from 'zustand'
import { streamStructuralResponse } from '../lib/gemini'
import type { StructuralContext, StructuralAction } from '../lib/gemini'
import { useAIStore } from './useAIStore'

export interface StructuralMessage {
  role: 'user' | 'model'
  content: string      // display text (action block stripped out)
  rawContent: string   // full response including action block
  action: StructuralAction | null
  timestamp: number
}

interface StructuralAIStore {
  messages: StructuralMessage[]
  isLoading: boolean
  streamingContent: string
  pendingAction: StructuralAction | null
  error: string | null

  sendMessage: (userMessage: string, ctx: StructuralContext) => Promise<void>
  clearMessages: () => void
  clearPendingAction: () => void
  clearError: () => void
}

// Extract action block from model response
function parseAction(raw: string): { display: string; action: StructuralAction | null } {
  const match = raw.match(/<action>\s*([\s\S]*?)\s*<\/action>/)
  if (!match) return { display: raw.trim(), action: null }

  try {
    const action = JSON.parse(match[1]) as StructuralAction
    const display = raw.replace(/<action>[\s\S]*?<\/action>/, '').trim()
    return { display, action }
  } catch {
    return { display: raw.trim(), action: null }
  }
}

export const useStructuralAIStore = create<StructuralAIStore>()((set, get) => ({
  messages: [],
  isLoading: false,
  streamingContent: '',
  pendingAction: null,
  error: null,

  clearMessages: () => set({ messages: [], streamingContent: '', pendingAction: null, error: null }),
  clearPendingAction: () => set({ pendingAction: null }),
  clearError: () => set({ error: null }),

  sendMessage: async (userMessage, ctx) => {
    const apiKey = useAIStore.getState().apiKey || import.meta.env.VITE_GEMINI_API_KEY || null
    if (!apiKey) {
      set({ error: 'No API key set. Add your Google AI Studio key in the editor.' })
      return
    }

    const { messages } = get()

    const userMsg: StructuralMessage = {
      role: 'user',
      content: userMessage,
      rawContent: userMessage,
      action: null,
      timestamp: Date.now()
    }

    set({
      messages: [...messages, userMsg],
      isLoading: true,
      streamingContent: '',
      pendingAction: null,
      error: null
    })

    try {
      let fullRaw = ''

      // Build history from prior turns (excluding the new user message)
      const history = messages.map(m => ({ role: m.role, content: m.rawContent }))

      for await (const chunk of streamStructuralResponse(apiKey, userMessage, ctx, history)) {
        fullRaw += chunk
        // Strip action block from streaming display
        const displayChunk = fullRaw.replace(/<action>[\s\S]*?<\/action>/, '').trimEnd()
        set({ streamingContent: displayChunk })
      }

      const { display, action } = parseAction(fullRaw)

      const modelMsg: StructuralMessage = {
        role: 'model',
        content: display,
        rawContent: fullRaw,
        action,
        timestamp: Date.now()
      }

      set((state) => ({
        messages: [...state.messages, modelMsg],
        isLoading: false,
        streamingContent: '',
        pendingAction: action && action.type !== 'none' ? action : null
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      set({
        isLoading: false,
        streamingContent: '',
        error: message.includes('API_KEY') || message.includes('403')
          ? 'Invalid API key. Check your Google AI Studio key.'
          : message
      })
    }
  }
}))
