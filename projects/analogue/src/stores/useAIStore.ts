import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { streamResponse } from '../lib/gemini'
import type { GeminiContext } from '../lib/gemini'

export interface AIMessage {
  role: 'user' | 'model'
  content: string
  timestamp: number
}

interface AIStore {
  apiKey: string | null
  messages: AIMessage[]
  isLoading: boolean
  streamingContent: string
  error: string | null

  setApiKey: (key: string) => void
  clearApiKey: () => void
  sendMessage: (userMessage: string, ctx: GeminiContext) => Promise<void>
  clearMessages: () => void
  clearError: () => void
}

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      apiKey: null,
      messages: [],
      isLoading: false,
      streamingContent: '',
      error: null,

      setApiKey: (key) => set({ apiKey: key.trim(), error: null }),
      clearApiKey: () => set({ apiKey: null }),
      clearMessages: () => set({ messages: [], streamingContent: '', error: null }),
      clearError: () => set({ error: null }),

      sendMessage: async (userMessage, ctx) => {
        const { messages } = get()
        const apiKey = get().apiKey || import.meta.env.VITE_GEMINI_API_KEY || null
        if (!apiKey) {
          set({ error: 'No API key set. Please add your Google AI Studio key.' })
          return
        }

        const userMsg: AIMessage = {
          role: 'user',
          content: userMessage,
          timestamp: Date.now()
        }

        set({
          messages: [...messages, userMsg],
          isLoading: true,
          streamingContent: '',
          error: null
        })

        try {
          let fullResponse = ''

          for await (const chunk of streamResponse(apiKey, userMessage, ctx)) {
            fullResponse += chunk
            set({ streamingContent: fullResponse })
          }

          const modelMsg: AIMessage = {
            role: 'model',
            content: fullResponse,
            timestamp: Date.now()
          }

          set((state) => ({
            messages: [...state.messages, modelMsg],
            isLoading: false,
            streamingContent: ''
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
    }),
    {
      name: 'analogue-ai',
      partialize: (state) => ({ apiKey: state.apiKey })
    }
  )
)
