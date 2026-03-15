/**
 * EditMemoryDialog - Edit existing memories (Bottom Sheet)
 */

import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { useRef } from 'react'
import { Brain, Image as ImageIcon, X, Plus, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Memory } from '../../types'

interface EditMemoryDialogProps {
  memory: Memory | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMemoryUpdated?: () => void
}

export function EditMemoryDialog({ memory, open, onOpenChange, onMemoryUpdated }: EditMemoryDialogProps) {
  const [loading, setLoading] = useState(false)
  const { updateMemory } = useMemoryStore()
  const { addToast } = useToast()

  const [uploading, setUploading] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  // Image state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [existingImages, setExistingImages] = useState<string[]>([])

  const [body, setBody] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    tags: '',
    memory_type: '' as '' | 'foundational' | 'event' | 'insight' | 'quick-note',
  })

  // Create and cleanup object URLs to prevent memory leaks
  useEffect(() => {
    const urls = selectedFiles.map(file => URL.createObjectURL(file))
    setPreviewUrls(urls)

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedFiles])

  useEffect(() => {
    if (memory && open) {
      setFormData({
        title: memory.title,
        tags: memory.tags?.join(', ') || '',
        memory_type: memory.memory_type || '',
      })
      setBody(memory.body)
      setExistingImages(memory.image_urls || [])
      setSelectedFiles([]) // Reset new files on open
    }
  }, [memory, open])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])])
    }
  }

  const removeNewFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingImage = (urlToRemove: string) => {
    setExistingImages(prev => prev.filter(url => url !== urlToRemove))
  }

  const uploadImages = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return []

    setUploading(true)
    const urls: string[] = []

    try {
      for (const file of selectedFiles) {
        console.log('[EditMemoryDialog] Uploading:', file.name, file.type, `${(file.size / 1024).toFixed(2)}KB`)

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        // 1. Get Signed URL from backend
        console.log('[EditMemoryDialog] Requesting signed URL for:', fileName)
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
          console.error('[EditMemoryDialog] Network error requesting upload URL:', err)
          throw new Error('Network error - check your internet connection')
        })

        if (!authResponse.ok) {
          const errorData = await authResponse.json().catch(() => ({}))
          console.error('[EditMemoryDialog] Failed to get upload URL:', authResponse.status, errorData)
          throw new Error(errorData.details || errorData.error || `Server error (${authResponse.status})`)
        }

        const { signedUrl, publicUrl } = await authResponse.json()

        if (!signedUrl || !publicUrl) {
          console.error('[EditMemoryDialog] Missing URLs in response')
          throw new Error('Invalid response from upload server')
        }

        // 2. Upload directly to Supabase Storage via Signed URL
        console.log('[EditMemoryDialog] Uploading to storage:', fileName)
        const uploadResponse = await fetch(signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
            'x-upsert': 'true', // Allow overwriting if exists
          },
          body: file
        }).catch(err => {
          console.error('[EditMemoryDialog] Network error uploading file:', err)
          throw new Error('Upload failed - check your internet connection')
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => 'Unknown error')
          console.error('[EditMemoryDialog] Upload failed:', uploadResponse.status, errorText)
          throw new Error(`Upload failed (${uploadResponse.status}): ${uploadResponse.statusText}`)
        }

        console.log('[EditMemoryDialog] Successfully uploaded:', fileName)
        urls.push(publicUrl)
      }

      console.log('[EditMemoryDialog] All images uploaded successfully:', urls.length)
      return urls
    } catch (error) {
      console.error('[EditMemoryDialog] Upload process failed:', error)
      const message = error instanceof Error ? error.message : 'Unknown upload error'
      throw new Error(`Failed to upload images: ${message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memory) return

    setLoading(true)

    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      // Upload new images
      const newImageUrls = await uploadImages()

      // Combine existing (kept) images with new uploaded ones
      const finalImageUrls = [...existingImages, ...newImageUrls]

      await updateMemory(memory.id, {
        title: formData.title,
        body: body.trim(),
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
        image_urls: finalImageUrls.length > 0 ? finalImageUrls : undefined,
      })

      addToast({
        title: 'Thought updated!',
        description: 'Your changes have been saved',
        variant: 'success',
      })

      onMemoryUpdated?.()

      onOpenChange(false)
    } catch (error) {
      console.error('[EditMemoryDialog] Update failed:', error)
      addToast({
        title: 'Failed to update thought',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!memory) return null

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader className="sr-only">
          <BottomSheetTitle>Edit thought</BottomSheetTitle>
        </BottomSheetHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          {/* Body — the hero */}
          <Textarea
            id="body"
            placeholder="Write your thoughts..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            className="text-[17px] leading-relaxed resize-none border-0 focus:ring-0 bg-transparent p-0 min-h-[160px] placeholder:opacity-20"
            style={{ color: 'var(--brand-text-primary)' }}
          />

          {/* Title — subtle secondary */}
          <Input
            id="title"
            placeholder="Title (optional)"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="h-9 border-0 border-b rounded-none bg-transparent px-0 text-sm focus:ring-0 focus:border-b focus:border-white/20 placeholder:opacity-20"
            style={{ color: "var(--brand-text-secondary)" }}
            autoComplete="off"
          />

          {/* Bottom bar: Photo + Options toggle */}
          <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--glass-surface)' }}>
            {/* Photo button */}
            <div className="relative flex-shrink-0">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                id="edit-image-upload"
              />
              <button
                type="button"
                className="p-2 rounded-lg transition-all hover:bg-[var(--glass-surface)] opacity-50 hover:opacity-80"
                style={{ color: "var(--brand-text-secondary)" }}
                title="Add photo"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
            </div>

            {/* More options toggle */}
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1 text-[11px] opacity-40 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
              {showOptions ? 'Less' : 'Type & Tags'}
            </button>
          </div>

          {/* Image grid */}
          <AnimatePresence mode="popLayout">
            {(existingImages.length > 0 || selectedFiles.length > 0) && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid gap-2 grid-cols-2"
              >
                {existingImages.map((url, index) => (
                  <motion.div
                    layout key={`existing-${url}-${index}`}
                    className="relative rounded-xl overflow-hidden aspect-square"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)' }}
                  >
                    <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(url)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md"
                      style={{ color: 'var(--brand-text-primary)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
                {selectedFiles.map((file, index) => (
                  <motion.div
                    layout key={`new-${file.name}-${index}`}
                    className="relative rounded-xl overflow-hidden aspect-square border border-dashed border-white/20"
                  >
                    <img src={previewUrls[index]} alt="New upload" className="w-full h-full object-cover opacity-80" />
                    <span className="absolute bottom-2 left-2 bg-black/50 text-[var(--brand-text-primary)] text-[10px] px-1.5 py-0.5 rounded-full">New</span>
                    <button
                      type="button"
                      onClick={() => removeNewFile(index)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md"
                      style={{ color: 'var(--brand-text-primary)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsible: Type & Tags */}
          <AnimatePresence>
            {showOptions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  {/* Type pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: '', label: 'Auto' },
                      { value: 'foundational', label: 'Core' },
                      { value: 'event', label: 'Event' },
                      { value: 'insight', label: 'Insight' },
                      { value: 'quick-note', label: 'Note' },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, memory_type: type.value as any })}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          formData.memory_type === type.value
                            ? 'border-white/30 bg-white/10 opacity-100'
                            : 'border-white/10 opacity-40 hover:opacity-70'
                        }`}
                        style={{ color: 'var(--brand-text-secondary)' }}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {/* Tags */}
                  <Input
                    id="tags"
                    placeholder="Tags: ai, health, work"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="h-9 border-0 border-b rounded-none bg-transparent px-0 text-sm focus:ring-0 placeholder:opacity-20"
                    style={{ color: 'var(--brand-text-secondary)' }}
                    autoComplete="off"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <BottomSheetFooter>
            <Button
              type="submit"
              disabled={loading || !body.trim() || uploading}
              className="w-full h-11 font-semibold text-sm touch-manipulation"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--brand-text-primary)',
              }}
            >
              {uploading ? 'Uploading...' : loading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full h-10 touch-manipulation opacity-40 hover:opacity-70 text-sm"
            >
              Cancel
            </Button>
          </BottomSheetFooter>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}
