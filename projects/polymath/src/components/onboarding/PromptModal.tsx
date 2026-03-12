import React, { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { MemoryPromptWithStatus } from '../../types'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { handleInputFocus } from '../../utils/keyboard'

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
    <div className="fixed inset-0 z-50 flex flex-col" style={{
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={handleSkip}
          className="p-2 rounded-full transition-colors active:bg-[rgba(255,255,255,0.1)]"
          style={{ color: "var(--brand-primary)" }}
          disabled={submitting}
        >
          <X className="h-5 w-5" />
        </button>
        {promptNumber && totalPrompts && (
          <span className="text-sm" style={{ color: "var(--brand-primary)" }}>
            {promptNumber}/{totalPrompts}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-48">
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>{prompt.prompt_text}</h2>
        {prompt.prompt_description && (
          <p className="text-sm mb-6" style={{ color: "var(--brand-primary)" }}>{prompt.prompt_description}</p>
        )}

        <div className="space-y-3">
          {bullets.map((bullet, index) => (
            <div key={index} className="p-3 rounded-lg flex gap-3 items-start" style={{ backgroundColor: 'var(--brand-glass-bg)' }}>
              <span className="pt-3" style={{ color: "var(--brand-primary)" }}></span>
              <Textarea
                value={bullet}
                onChange={(e) => handleBulletChange(index, e.target.value)}
                onFocus={handleInputFocus}
                placeholder={`Bullet ${index + 1}`}
                className="flex-1 min-h-[60px]"
                disabled={submitting}
              />
              {bullets.length > 3 && (
                <button
                  onClick={() => handleRemoveBullet(index)}
                  className="p-2 rounded-full transition-colors mt-2 active:bg-[rgba(255,255,255,0.1)]"
                  style={{ color: "var(--brand-primary)" }}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button
            onClick={handleAddBullet}
            className="flex items-center gap-2 text-sm font-medium active:opacity-70 touch-manipulation"
            style={{ color: "var(--brand-primary)" }}
            disabled={submitting}
          >
            <Plus className="h-4 w-4" />
            Add bullet
          </button>
        </div>

        <div className="mt-6 p-4 rounded-lg" style={{
          backgroundColor: 'var(--glass-surface)',
          border: 'none'
        }}>
          <p className="text-sm" style={{ color: "var(--brand-primary)" }}>
             <strong>Be specific!</strong> AI can't suggest great projects from vague responses.
            Add concrete details, names, feelings, and examples.
          </p>
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-lg" style={{
            backgroundColor: 'var(--glass-surface)',
            border: 'none'
          }}>
            <p className="text-sm" style={{ color: "var(--brand-primary)" }}>{error}</p>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed left-0 right-0 p-4 shadow-lg" style={{
        bottom: '80px',
        backgroundColor: 'var(--brand-glass-bg)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 60
      }}>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-6 text-lg"
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary))',
            color: 'white'
          }}
        >
          {submitting ? 'Saving...' : 'Save '}
        </Button>
        <button
          onClick={handleSkip}
          className="w-full py-3 text-sm mt-2 active:opacity-70 touch-manipulation"
          style={{ color: "var(--brand-primary)" }}
          disabled={submitting}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
