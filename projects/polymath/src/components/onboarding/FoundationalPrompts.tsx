import React, { useState, useEffect } from 'react'
import { CheckCircle2, Lock, ChevronRight } from 'lucide-react'
import { useOnboardingStore } from '../../stores/useOnboardingStore'
import { PromptModal } from './PromptModal'
import { MemoryPromptWithStatus } from '../../types'

/**
 * Displays 5 required foundational prompts
 * Shows progress and unlocks projects at 5/5
 */
export function FoundationalPrompts() {
  const {
    requiredPrompts,
    progress,
    loading,
    fetchPrompts,
    submitResponse,
    submitting
  } = useOnboardingStore()

  const [selectedPrompt, setSelectedPrompt] = useState<MemoryPromptWithStatus | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    console.log('[FoundationalPrompts] Fetching prompts...')
    fetchPrompts()
  }, [fetchPrompts])

  useEffect(() => {
    console.log('[FoundationalPrompts] requiredPrompts:', requiredPrompts)
    console.log('[FoundationalPrompts] progress:', progress)
  }, [requiredPrompts, progress])

  const handlePromptClick = (prompt: MemoryPromptWithStatus) => {
    if (prompt.status === 'completed') {
      // Allow editing completed prompts
      setSelectedPrompt(prompt)
      setModalOpen(true)
    } else {
      // Only allow starting if previous is complete or this is first incomplete
      const promptIndex = requiredPrompts.findIndex(p => p.id === prompt.id)
      const previousPrompts = requiredPrompts.slice(0, promptIndex)
      const allPreviousComplete = previousPrompts.every(p => p.status === 'completed')

      if (allPreviousComplete || promptIndex === 0) {
        setSelectedPrompt(prompt)
        setModalOpen(true)
      }
    }
  }

  const handleSubmit = async (bullets: string[]) => {
    if (!selectedPrompt) return

    await submitResponse({
      prompt_id: selectedPrompt.id,
      bullets
    })
  }

  const isPromptLocked = (prompt: MemoryPromptWithStatus, index: number) => {
    if (prompt.status === 'completed') return false
    if (index === 0) return false

    const previousPrompts = requiredPrompts.slice(0, index)
    return !previousPrompts.every(p => p.status === 'completed')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--premium-blue)' }} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Header */}
      <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--premium-bg-3)', backdropFilter: 'blur(12px)' }}>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>Complete Your Foundation</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-full h-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress?.completion_percentage || 0}%`, backgroundColor: 'var(--premium-blue)' }}
            />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
            {progress?.completed_required || 0}/{progress?.total_required || 5}
          </span>
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--premium-text-secondary)' }}>
          {progress?.has_unlocked_projects ? (
            <span className="font-medium" style={{ color: 'var(--premium-blue)' }}>✓ Projects unlocked!</span>
          ) : (
            <>Complete {(progress?.total_required || 5) - (progress?.completed_required || 0)} more to unlock Projects</>
          )}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--premium-text-tertiary)' }}>
          💡 Better memories = Better project suggestions
        </p>
      </div>

      {/* Prompt List */}
      <div className="space-y-3">
        {requiredPrompts.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--premium-text-tertiary)' }}>
            <p>No prompts found. Check console for errors.</p>
          </div>
        ) : (
          requiredPrompts.map((prompt, index) => {
          const locked = isPromptLocked(prompt, index)
          const completed = prompt.status === 'completed'

          return (
            <button
              key={prompt.id}
              onClick={() => handlePromptClick(prompt)}
              disabled={locked}
              className="w-full text-left p-4 rounded-lg transition-all"
              style={{
                background: completed ? 'var(--premium-bg-3)' : locked ? 'var(--premium-bg-1)' : 'var(--premium-bg-2)',
                backdropFilter: 'blur(12px)',
                opacity: locked ? 0.6 : 1,
                cursor: locked ? 'not-allowed' : 'pointer'
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {completed ? (
                    <CheckCircle2 className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
                  ) : locked ? (
                    <Lock className="h-6 w-6" style={{ color: 'var(--premium-text-tertiary)' }} />
                  ) : (
                    <div className="h-6 w-6 rounded-full" style={{ border: '2px solid var(--premium-blue)' }} />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
                      {index + 1}. {prompt.prompt_text}
                    </h3>
                    {!locked && (
                      <ChevronRight className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--premium-text-secondary)' }}>
                    {prompt.prompt_description}
                  </p>
                  {completed && prompt.response && (
                    <div className="mt-2 text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                      <p className="line-clamp-2">
                        {prompt.response.bullets.join(' • ')}
                      </p>
                      <button className="hover:underline mt-1" style={{ color: 'var(--premium-blue)' }}>
                        Edit
                      </button>
                    </div>
                  )}
                  {locked && (
                    <p className="text-xs mt-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Complete previous prompts to unlock
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        }))}
      </div>

      {/* Modal */}
      <PromptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prompt={selectedPrompt}
        promptNumber={
          selectedPrompt
            ? requiredPrompts.findIndex(p => p.id === selectedPrompt.id) + 1
            : undefined
        }
        totalPrompts={requiredPrompts.length}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  )
}
