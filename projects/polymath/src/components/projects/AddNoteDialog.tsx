/**
 * Add Note Dialog Component
 * Modal for adding voice or text notes to a project
 */

import { useState, useEffect } from 'react'
import { X, Mic, Plus, Trash2, FileText } from 'lucide-react'
import { Button } from '../ui/button'
import { useToast } from '../ui/toast'
import { useMemoryStore } from '../../stores/useMemoryStore'

interface AddNoteDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onNoteAdded: (note: any) => void
}

export function AddNoteDialog({ open, onClose, projectId, onNoteAdded }: AddNoteDialogProps) {
  const [noteType, setNoteType] = useState<'voice' | 'text'>('text')
  const [bullets, setBullets] = useState<string[]>([''])
  const [isRecording, setIsRecording] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { addToast } = useToast()
  const createMemory = useMemoryStore(state => state.createMemory)

  useEffect(() => {
    if (!open) {
      // Reset on close
      setBullets([''])
      setIsRecording(false)
      setNoteType('text')
    } else {
      console.log('[AddNoteDialog] Opened with noteType:', noteType)
    }
  }, [open, noteType])

  const addBullet = () => {
    setBullets([...bullets, ''])
  }

  const removeBullet = (index: number) => {
    if (bullets.length > 1) {
      setBullets(bullets.filter((_, i) => i !== index))
    }
  }

  const updateBullet = (index: number, value: string) => {
    const newBullets = [...bullets]
    newBullets[index] = value
    setBullets(newBullets)
  }

  const handleSave = async () => {
    const validBullets = bullets.filter((b) => b.trim().length > 0)

    if (validBullets.length === 0) {
      addToast({
        title: 'No content',
        description: 'Please add at least one bullet point',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)

    setIsSaving(true)

    try {
      // Create a memory linked to this project
      // Combine bullets into a single body for the memory
      const body = validBullets.map(b => `• ${b}`).join('\n')

      const newMemory = await createMemory({
        title: `Note on Project`, // Generic title, AI can refine later
        body: body,
        memory_type: 'quick-note',
        source_reference: {
          type: 'project',
          id: projectId,
        }
      })

      addToast({
        title: 'Note added',
        description: 'Your note has been saved to your memory bank',
        variant: 'success',
      })

      // Adapt memory to ProjectNote format for immediate UI update if needed
      // But ideally we rely on refresh.
      // We pass a compliant object to satisfy the callback
      onNoteAdded({
        id: newMemory.id,
        project_id: projectId,
        bullets: validBullets,
        created_at: newMemory.created_at,
        note_type: 'text'
      })

      onClose()
    } catch (error) {
      console.error('[AddNoteDialog] Save error:', error)
      addToast({
        title: 'Failed to save note',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleVoiceRecord = () => {
    // Close this dialog and trigger FloatingNav voice capture
    // which creates a memory/thought linked to the project
    console.log('[AddNoteDialog] Switching to voice capture (creates thought)')
    onClose()
    // Dispatch event to open FloatingNav voice modal
    window.dispatchEvent(new CustomEvent('openVoiceCapture'))
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] animate-fadeIn"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-x-0 bottom-0 z-[70] animate-slideUp md:inset-0 md:flex md:items-center md:justify-center">
        <div className="premium-card rounded-t-2xl md:rounded-2xl shadow-2xl max-w-2xl w-full mx-auto max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <h2 className="text-lg font-bold premium-text-platinum">Add Update</h2>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" style={{ color: 'var(--premium-text-secondary)' }} />
            </button>
          </div>

          {/* Type Toggle - Clear Selection */}
          <div className="p-6 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex gap-3">
              <button
                onClick={() => setNoteType('voice')}
                className={`flex-1 px-6 py-4 rounded-xl font-semibold transition-all ${noteType === 'voice'
                  ? 'shadow-2xl ring-2'
                  : 'hover:bg-white/5'
                  }`}
                style={noteType === 'voice' ? {
                  background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                  color: 'white'
                } : {
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--premium-text-tertiary)'
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <Mic className={`h-6 w-6 ${noteType === 'voice' ? '' : 'opacity-50'}`} />
                  <span className="text-sm">Voice note</span>
                  {noteType === 'voice' && (
                    <span className="text-xs opacity-80">Creates linked thought</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setNoteType('text')}
                className={`flex-1 px-6 py-4 rounded-xl font-semibold transition-all ${noteType === 'text'
                  ? 'shadow-2xl ring-2'
                  : 'hover:bg-white/5'
                  }`}
                style={noteType === 'text' ? {
                  background: 'linear-gradient(135deg, var(--premium-indigo), var(--premium-purple))',
                  color: 'white'
                } : {
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--premium-text-tertiary)'
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <FileText className={`h-6 w-6 ${noteType === 'text' ? '' : 'opacity-50'}`} />
                  <span className="text-sm">Text update</span>
                  {noteType === 'text' && (
                    <span className="text-xs opacity-80">Project progress notes</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {noteType === 'voice' ? (
              <div className="text-center py-12">
                <button
                  onClick={handleVoiceRecord}
                  className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all ${isRecording
                    ? 'animate-pulse'
                    : ''
                    }`}
                  style={isRecording ? {
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white'
                  } : {
                    background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                    color: 'white'
                  }}
                >
                  <Mic className="h-8 w-8" />
                </button>
                <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                  {isRecording ? 'Recording...' : 'Tap to start recording'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                  Add bullet points for your project update
                </p>

                {bullets.map((bullet, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex-shrink-0 mt-3" style={{ color: 'var(--premium-text-tertiary)' }}>•</span>
                    <textarea
                      value={bullet}
                      onChange={(e) => updateBullet(index, e.target.value)}
                      placeholder="Add a bullet point..."
                      rows={2}
                      className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--premium-text-primary)',
                        '--tw-ring-color': 'var(--premium-blue)'
                      } as React.CSSProperties}
                    />
                    {bullets.length > 1 && (
                      <button
                        onClick={() => removeBullet(index)}
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-red-500/10 flex-shrink-0 mt-2 transition-colors"
                        style={{ color: '#ef4444' }}
                        aria-label="Remove bullet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={addBullet}
                  className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--premium-blue)' }}
                >
                  <Plus className="h-4 w-4" />
                  Add another bullet
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex gap-3" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-2 font-semibold hover:bg-white/5"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'var(--premium-text-secondary)'
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 font-semibold text-white shadow-lg"
              style={{
                background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
              }}
              disabled={isSaving || (noteType === 'text' && bullets.every(b => !b.trim()))}
            >
              {isSaving ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
