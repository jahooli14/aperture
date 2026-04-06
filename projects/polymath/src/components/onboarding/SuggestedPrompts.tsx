import React, { useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { useOnboardingStore } from '../../stores/useOnboardingStore'
import { PromptModal } from './PromptModal'
import { MemoryPromptWithStatus } from '../../types'

/**
 * AI-generated follow-up prompts based on onboarding analysis.
 * Shown on the Thoughts page as lightweight suggestions — not a gate.
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
      <h3 className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--brand-primary)', opacity: 0.7 }}>
        <Lightbulb className="h-4 w-4" />
        Tell us more
      </h3>

      <div className="space-y-2">
        {suggestedPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="p-4 rounded-xl transition-all"
            style={{
              background: 'var(--glass-surface)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h4 className="font-semibold text-sm" style={{ color: 'var(--brand-text-primary)' }}>{prompt.prompt_text}</h4>
                {prompt.prompt_description && (
                  <p className="text-xs mt-1" style={{ color: 'var(--brand-text-secondary)', opacity: 0.7 }}>{prompt.prompt_description}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleDismiss(prompt.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors"
                style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
              >
                <X className="h-3 w-3" />
                Skip
              </button>
              <button
                onClick={() => handleAdd(prompt)}
                className="flex-1 px-4 py-1.5 text-xs font-bold rounded-lg transition-all hover:opacity-90"
                style={{
                  background: 'rgba(var(--brand-primary-rgb, 6, 182, 212), 0.15)',
                  color: 'var(--brand-primary)',
                  border: '1px solid rgba(var(--brand-primary-rgb, 6, 182, 212), 0.2)',
                }}
              >
                Answer
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
