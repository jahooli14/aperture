import React, { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useOnboardingStore } from '../../stores/useOnboardingStore'
import { PromptModal } from './PromptModal'
import { MemoryPromptWithStatus } from '../../types'

/**
 * AI-generated follow-up prompts based on gap detection
 * Appears in "My Memories" tab
 */
export function SuggestedPrompts() {
  const { suggestedPrompts, submitResponse, dismissPrompt, submitting } = useOnboardingStore()

  const [selectedPrompt, setSelectedPrompt] = useState<MemoryPromptWithStatus | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  if (!suggestedPrompts || suggestedPrompts.length === 0) {
    return null
  }

  const handleAdd = (prompt: MemoryPromptWithStatus) => {
    setSelectedPrompt(prompt)
    setModalOpen(true)
  }

  const handleDismiss = async (promptId: string) => {
    await dismissPrompt(promptId)
  }

  const handleSubmit = async (bullets: string[]) => {
    if (!selectedPrompt) return

    await submitResponse({
      prompt_id: selectedPrompt.id,
      bullets
    })
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-600" />
        Suggested Prompts ({suggestedPrompts.length})
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Based on what you've shared, these would enrich your graph:
      </p>

      <div className="space-y-3">
        {suggestedPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{prompt.prompt_text}</h4>
                {prompt.prompt_description && (
                  <p className="text-sm text-gray-600 mt-1">{prompt.prompt_description}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleDismiss(prompt.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
                Dismiss
              </button>
              <button
                onClick={() => handleAdd(prompt)}
                className="flex-1 px-4 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Add →
              </button>
            </div>
          </div>
        ))}
      </div>

      <PromptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prompt={selectedPrompt}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  )
}
