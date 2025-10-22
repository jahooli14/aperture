import React, { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { MemoryPromptWithStatus } from '../../types'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'

interface PromptModalProps {
  open: boolean
  onClose: () => void
  prompt: MemoryPromptWithStatus | null
  promptNumber?: number
  totalPrompts?: number
  onSubmit: (bullets: string[]) => Promise<void>
  submitting: boolean
}

/**
 * Full-screen modal for entering memory responses
 * Mobile-optimized with bullet entry and validation
 */
export function PromptModal({
  open,
  onClose,
  prompt,
  promptNumber,
  totalPrompts,
  onSubmit,
  submitting
}: PromptModalProps) {
  const [bullets, setBullets] = useState<string[]>(['', '', ''])
  const [error, setError] = useState<string | null>(null)

  if (!open || !prompt) return null

  const handleAddBullet = () => {
    setBullets([...bullets, ''])
  }

  const handleRemoveBullet = (index: number) => {
    if (bullets.length <= 3) return
    setBullets(bullets.filter((_, i) => i !== index))
  }

  const handleBulletChange = (index: number, value: string) => {
    const newBullets = [...bullets]
    newBullets[index] = value
    setBullets(newBullets)
    setError(null)
  }

  const handleSubmit = async () => {
    // Filter out empty bullets
    const filledBullets = bullets.filter(b => b.trim().length > 0)

    // Validate
    if (filledBullets.length < 3) {
      setError('Add at least 3 bullets')
      return
    }

    const tooShort = filledBullets.some(b => b.trim().length < 10)
    if (tooShort) {
      setError('Add more detail to each bullet (minimum 10 characters)')
      return
    }

    try {
      await onSubmit(filledBullets)
      // Reset on success
      setBullets(['', '', ''])
      setError(null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    }
  }

  const handleSkip = () => {
    setBullets(['', '', ''])
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={handleSkip}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          disabled={submitting}
        >
          <X className="h-5 w-5" />
        </button>
        {promptNumber && totalPrompts && (
          <span className="text-sm text-gray-500">
            {promptNumber}/{totalPrompts}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <h2 className="text-xl font-bold mb-2">{prompt.prompt_text}</h2>
        {prompt.prompt_description && (
          <p className="text-gray-600 text-sm mb-6">{prompt.prompt_description}</p>
        )}

        <div className="space-y-3">
          {bullets.map((bullet, index) => (
            <div key={index} className="flex gap-2 items-start">
              <span className="text-gray-400 mt-3">•</span>
              <Textarea
                value={bullet}
                onChange={(e) => handleBulletChange(index, e.target.value)}
                placeholder={`Bullet ${index + 1}`}
                className="flex-1 min-h-[80px]"
                disabled={submitting}
              />
              {bullets.length > 3 && (
                <button
                  onClick={() => handleRemoveBullet(index)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors mt-2"
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleAddBullet}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mt-4 text-sm font-medium"
          disabled={submitting}
        >
          <Plus className="h-4 w-4" />
          Add bullet
        </button>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            💡 <strong>Be specific!</strong> AI can't suggest great projects from vague responses.
            Add concrete details, names, feelings, and examples.
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-6 text-lg"
        >
          {submitting ? 'Saving...' : 'Save →'}
        </Button>
        <button
          onClick={handleSkip}
          className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm mt-2"
          disabled={submitting}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
