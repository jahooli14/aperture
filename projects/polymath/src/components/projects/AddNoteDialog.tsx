/**
 * Add Note Dialog Component
 * Modal for adding voice or text notes to a project
 */

import { useState, useEffect } from 'react'
import { X, Mic, Plus, Trash2, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { useToast } from '../ui/toast'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const { addToast } = useToast()
  const createMemory = useMemoryStore(state => state.createMemory)

  useEffect(() => {
    if (!open) {
      // Reset on close
      setBullets([''])
      setIsRecording(false)
      setNoteType('text')
      setSelectedFiles([])
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadImages = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return []

    setUploading(true)
    const urls: string[] = []

    try {
      for (const file of selectedFiles) {
        console.log('[AddNoteDialog] Uploading:', file.name, file.type, `${(file.size / 1024).toFixed(2)}KB`)

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        // 1. Get Signed URL from backend
        console.log('[AddNoteDialog] Requesting signed URL for:', fileName)
        const authResponse = await fetch('/api/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName,
            fileType: file.type
          })
        }).catch(err => {
          console.error('[AddNoteDialog] Network error requesting upload URL:', err)
          throw new Error('Network error - check your internet connection')
        })

        if (!authResponse.ok) {
          const errorData = await authResponse.json().catch(() => ({}))
          console.error('[AddNoteDialog] Failed to get upload URL:', authResponse.status, errorData)
          throw new Error(errorData.details || errorData.error || `Server error (${authResponse.status})`)
        }

        const { signedUrl, publicUrl } = await authResponse.json()

        if (!signedUrl || !publicUrl) {
          console.error('[AddNoteDialog] Missing URLs in response')
          throw new Error('Invalid response from upload server')
        }

        // 2. Upload directly to Supabase Storage via Signed URL
        console.log('[AddNoteDialog] Uploading to storage:', fileName)
        const uploadResponse = await fetch(signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
            'x-upsert': 'true',
          },
          body: file
        }).catch(err => {
          console.error('[AddNoteDialog] Network error uploading file:', err)
          throw new Error('Upload failed - check your internet connection')
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => 'Unknown error')
          console.error('[AddNoteDialog] Upload failed:', uploadResponse.status, errorText)
          throw new Error(`Upload failed (${uploadResponse.status}): ${uploadResponse.statusText}`)
        }

        console.log('[AddNoteDialog] Successfully uploaded:', fileName)
        urls.push(publicUrl)
      }

      console.log('[AddNoteDialog] All images uploaded successfully:', urls.length)
      return urls
    } catch (error) {
      console.error('[AddNoteDialog] Upload process failed:', error)
      const message = error instanceof Error ? error.message : 'Unknown upload error'
      throw new Error(`Failed to upload images: ${message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    const validBullets = bullets.filter((b) => b.trim().length > 0)

    if (validBullets.length === 0 && selectedFiles.length === 0) {
      addToast({
        title: 'No content',
        description: 'Please add at least one bullet point or image',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)

    try {
      // Upload images first if any
      const imageUrls = await uploadImages()

      // Create a memory linked to this project
      // Combine bullets into a single body for the memory
      const body = validBullets.length > 0 ? validBullets.map(b => `• ${b}`).join('\n') : '📷 Image update'

      const newMemory = await createMemory({
        title: `Note on Project`, // Generic title, AI can refine later
        body: body,
        memory_type: 'quick-note',
        source_reference: {
          type: 'project',
          id: projectId,
        },
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
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
              <div className="space-y-4">
                <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                  Add bullet points and images for your project update
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

                {/* Image Upload */}
                <div className="pt-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
                      <ImageIcon className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />
                      Photos
                    </Label>
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        id="project-note-image-upload"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--premium-text-secondary)'
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Image Preview */}
                  <AnimatePresence mode="popLayout">
                    {selectedFiles.length > 0 && (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`grid gap-2 ${selectedFiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
                      >
                        {selectedFiles.map((file, index) => (
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            key={`${file.name}-${index}`}
                            className="relative rounded-xl overflow-hidden group border"
                            style={{
                              borderColor: 'rgba(255, 255, 255, 0.1)',
                              aspectRatio: selectedFiles.length === 1 ? '16/9' : '1/1'
                            }}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt="Preview"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 border border-white/10 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/80"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
              disabled={isSaving || uploading || (noteType === 'text' && bullets.every(b => !b.trim()) && selectedFiles.length === 0)}
            >
              {uploading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Uploading images...
                </>
              ) : isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Note'
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
