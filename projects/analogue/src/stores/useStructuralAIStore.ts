import { create } from 'zustand'
import { streamStructuralResponse } from '../lib/gemini'
import type { StructuralContext, StructuralAction } from '../lib/gemini'
import { useAIStore } from './useAIStore'

export interface StructuralMessage {
  role: 'user' | 'model'
  content: string       // display text (actions block stripped)
  rawContent: string    // full response including actions block
  actions: StructuralAction[]
  timestamp: number
}

interface StructuralAIStore {
  messages: StructuralMessage[]
  isLoading: boolean
  streamingContent: string
  pendingActions: StructuralAction[]
  error: string | null

  sendMessage: (userMessage: string, ctx: StructuralContext) => Promise<void>
  clearMessages: () => void
  dismissAction: (index: number) => void
  clearAllPending: () => void
  clearError: () => void
}

const ACTIONS_RE = /<actions>\s*([\s\S]*?)\s*<\/actions>/

function parseActions(raw: string): { display: string; actions: StructuralAction[] } {
  const match = raw.match(ACTIONS_RE)
  if (!match) return { display: raw.trim(), actions: [] }

  try {
    const actions = JSON.parse(match[1]) as StructuralAction[]
    const display = raw.replace(ACTIONS_RE, '').trim()
    return { display, actions: Array.isArray(actions) ? actions : [actions] }
  } catch {
    return { display: raw.trim(), actions: [] }
  }
}

function stripActionsFromStreaming(raw: string): string {
  // Strip complete block
  let s = raw.replace(ACTIONS_RE, '')
  // Strip partial opening tag that may be mid-stream
  s = s.replace(/<actions>[\s\S]*$/, '')
  return s.trimEnd()
}

export const useStructuralAIStore = create<StructuralAIStore>()((set, get) => ({
  messages: [],
  isLoading: false,
  streamingContent: '',
  pendingActions: [],
  error: null,

  clearMessages: () => set({ messages: [], streamingContent: '', pendingActions: [], error: null }),
  clearAllPending: () => set({ pendingActions: [] }),
  clearError: () => set({ error: null }),

  dismissAction: (index) => set(state => ({
    pendingActions: state.pendingActions.filter((_, i) => i !== index)
  })),

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
      actions: [],
      timestamp: Date.now()
    }

    set({
      messages: [...messages, userMsg],
      isLoading: true,
      streamingContent: '',
      pendingActions: [],
      error: null
    })

    try {
      let fullRaw = ''
      const history = messages.map(m => ({ role: m.role, content: m.rawContent }))

      for await (const chunk of streamStructuralResponse(apiKey, userMessage, ctx, history)) {
        fullRaw += chunk
        set({ streamingContent: stripActionsFromStreaming(fullRaw) })
      }

      const { display, actions } = parseActions(fullRaw)

      const modelMsg: StructuralMessage = {
        role: 'model',
        content: display,
        rawContent: fullRaw,
        actions,
        timestamp: Date.now()
      }

      set((state) => ({
        messages: [...state.messages, modelMsg],
        isLoading: false,
        streamingContent: '',
        pendingActions: actions
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
