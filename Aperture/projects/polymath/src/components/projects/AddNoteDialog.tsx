/**
 * Add Note Dialog Component
 * Modal for adding voice or text notes to a project
 */

import { useState, useEffect } from 'react'
import { X, Mic, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { useToast } from '../ui/toast'

interface AddNoteDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onNoteAdded: (note: any) => void
}

export function AddNoteDialog({ open, onClose, projectId, onNoteAdded }: AddNoteDialogProps) {
  const [noteType, setNoteType] = useState<'voice' | 'text'>('voice')
  const [bullets, setBullets] = useState<string[]>([''])
  const [isRecording, setIsRecording] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    if (!open) {
      // Reset on close
      setBullets([''])
      setIsRecording(false)
      setNoteType('voice')
    }
  }, [open])

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

    try {
      const response = await fetch('/api/projects?resource=notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          bullets: validBullets,
          note_type: noteType,
        }),
      })

      const data = await response.json()

      if (data.success) {
        addToast({
          title: 'Note added',
          description: 'Your update has been saved',
          variant: 'success',
        })
        onNoteAdded(data.note)
        onClose()
      } else {
        throw new Error(data.error || 'Failed to save note')
      }
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
    // TODO: Integrate with existing voice recording system
    addToast({
      title: 'Coming soon',
      description: 'Voice recording integration in progress',
      variant: 'default',
    })
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp md:inset-0 md:flex md:items-center md:justify-center">
        <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-2xl w-full mx-auto max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">Add Update</h2>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-neutral-600" />
            </button>
          </div>

          {/* Type Toggle */}
          <div className="p-4 border-b border-neutral-200 bg-neutral-50">
            <div className="flex gap-2">
              <button
                onClick={() => setNoteType('voice')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  noteType === 'voice'
                    ? 'bg-blue-900 text-white'
                    : 'bg-white text-neutral-600 border border-neutral-300 hover:border-blue-300'
                }`}
              >
                🎤 Voice Note
              </button>
              <button
                onClick={() => setNoteType('text')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  noteType === 'text'
                    ? 'bg-blue-900 text-white'
                    : 'bg-white text-neutral-600 border border-neutral-300 hover:border-blue-300'
                }`}
              >
                📝 Text Note
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {noteType === 'voice' ? (
              <div className="text-center py-12">
                <button
                  onClick={handleVoiceRecord}
                  className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all ${
                    isRecording
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-blue-900 text-white hover:bg-blue-800'
                  }`}
                >
                  <Mic className="h-8 w-8" />
                </button>
                <p className="text-sm text-neutral-600">
                  {isRecording ? 'Recording...' : 'Tap to start recording'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600 mb-4">
                  Add bullet points for your project update
                </p>

                {bullets.map((bullet, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-neutral-400 flex-shrink-0 mt-3">•</span>
                    <textarea
                      value={bullet}
                      onChange={(e) => updateBullet(index, e.target.value)}
                      placeholder="Add a bullet point..."
                      rows={2}
                      className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    {bullets.length > 1 && (
                      <button
                        onClick={() => removeBullet(index)}
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-red-50 text-red-600 flex-shrink-0 mt-2"
                        aria-label="Remove bullet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={addBullet}
                  className="flex items-center gap-2 text-sm font-medium text-blue-900 hover:text-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add another bullet
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-200 flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-blue-900 hover:bg-blue-800"
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
