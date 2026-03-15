/**
 * Add Note Dialog Component
 * BottomSheet for adding text notes to a project  streamlined single view
 */

import { useState, useEffect } from 'react'
import { Plus, Trash2, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { useToast } from '../ui/toast'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { handleInputFocus } from '../../utils/keyboard'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'

interface AddNoteDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onNoteAdded: (note: any) => void
}

export function AddNoteDialog({ open, onClose, projectId, onNoteAdded }: AddNoteDialogProps) {
  const [bullets, setBullets] = useState<string[]>([''])
  const [isSaving, setIsSaving] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const { addToast } = useToast()
  const createMemory = useMemoryStore(state => state.createMemory)

  // Create and cleanup object URLs to prevent memory leaks
  useEffect(() => {
    const urls = selectedFiles.map(file => URL.createObjectURL(file))
    setPreviewUrls(urls)
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedFiles])

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setBullets([''])
      setSelectedFiles([])
      onClose()
    }
  }

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
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        const authResponse = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName, fileType: file.type })
        }).catch(err => {
          throw new Error('Network error - check your internet connection')
        })

        if (!authResponse.ok) {
          const errorData = await authResponse.json().catch(() => ({}))
          throw new Error(errorData.details || errorData.error || `Server error (${authResponse.status})`)
        }

        const { signedUrl, publicUrl } = await authResponse.json()
        if (!signedUrl || !publicUrl) throw new Error('Invalid response from upload server')

        const uploadResponse = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type, 'x-upsert': 'true' },
          body: file
        }).catch(() => {
          throw new Error('Upload failed - check your internet connection')
        })

        if (!uploadResponse.ok) throw new Error(`Upload failed (${uploadResponse.status})`)
        urls.push(publicUrl)
      }
      return urls
    } catch (error) {
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
      const imageUrls = await uploadImages()
      const body = validBullets.length > 0 ? validBullets.map(b => ` ${b}`).join('\n') : 'Image update'

      const newMemory = await createMemory({
        title: `Note on Project`,
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

      onNoteAdded({
        id: newMemory.id,
        project_id: projectId,
        bullets: validBullets,
        created_at: newMemory.created_at,
        note_type: 'text'
      })

      handleOpenChange(false)
    } catch (error) {
      addToast({
        title: 'Failed to save note',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={handleOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
            <BottomSheetTitle>Add Update</BottomSheetTitle>
          </div>
          <BottomSheetDescription>
            Add bullet points and images for your project update
          </BottomSheetDescription>
        </BottomSheetHeader>

        <div className="space-y-4 mt-6">
          {/* Bullet Points */}
          {bullets.map((bullet, index) => (
            <div key={index} className="flex gap-2">
              <span className="flex-shrink-0 mt-3" style={{ color: "var(--brand-primary)" }}></span>
              <textarea
                value={bullet}
                onChange={(e) => updateBullet(index, e.target.value)}
                onFocus={handleInputFocus}
                placeholder="Add a bullet point..."
                rows={2}
                autoFocus={index === 0}
                className="flex-1 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-none"
                style={{
                  backgroundColor: 'var(--glass-surface)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--brand-text-primary)',
                  '--tw-ring-color': 'var(--brand-primary)'
                } as React.CSSProperties}
              />
              {bullets.length > 1 && (
                <button
                  onClick={() => removeBullet(index)}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-brand-primary/10 flex-shrink-0 mt-2 transition-colors"
                  style={{ color: "var(--brand-primary)" }}
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
            style={{ color: "var(--brand-primary)" }}
          >
            <Plus className="h-4 w-4" />
            Add another bullet
          </button>

          {/* Image Upload */}
          <div className="pt-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--brand-primary)" }}>
                <ImageIcon className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
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
                  className="h-8 px-3 text-xs flex items-center gap-1.5 transition-all hover:bg-[rgba(255,255,255,0.1)] active:scale-95"
                  style={{
                    backgroundColor: 'var(--glass-surface)',
                    color: 'var(--brand-text-secondary)',
                    borderRadius: '9999px',
                    border: '1px solid var(--glass-surface)'
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
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
                        src={previewUrls[index]}
                        alt="Preview"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-md text-[var(--brand-text-primary)]/90 border border-[var(--glass-surface-hover)] transition-all active:bg-brand-primary/80"
                      >
                        <span className="h-3.5 w-3.5 block text-center leading-none">&times;</span>
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <BottomSheetFooter>
          <Button
            onClick={handleSave}
            className="w-full h-12 font-semibold text-[var(--brand-text-primary)] shadow-lg touch-manipulation"
            style={{
              background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary))',
            }}
            disabled={isSaving || uploading || (bullets.every(b => !b.trim()) && selectedFiles.length === 0)}
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
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  )
}
