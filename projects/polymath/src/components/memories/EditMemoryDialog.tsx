/**
 * EditMemoryDialog - Edit existing memories (Bottom Sheet)
 */

import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { useRef } from 'react'
import { Brain, Image as ImageIcon, X, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
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
        <BottomSheetHeader>
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
            <BottomSheetTitle>Edit thought</BottomSheetTitle>
          </div>
          <BottomSheetDescription>
            Update your thought
          </BottomSheetDescription>
        </BottomSheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
              Title <span style={{ color: '#ef4444' }}>*</span>
            </Label>
            <Input
              id="title"
              placeholder="What's this about?"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="text-base h-11 sm:h-12"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-primary)'
              }}
              autoComplete="off"
            />
          </div>

          {/* Body Content */}
          <div className="space-y-2">
            <Label htmlFor="body" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
              Content <span style={{ color: '#ef4444' }}>*</span>
            </Label>
            <Textarea
              id="body"
              placeholder="Write your thoughts..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              className="text-base min-h-[200px] resize-y leading-relaxed p-4"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-primary)'
              }}
            />
            <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              AI will analyze this to extract entities and themes.
            </p>
          </div>

          {/* Image Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-sm sm:text-base cursor-pointer flex items-center gap-2 group" style={{ color: 'var(--premium-text-primary)' }}>
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
                  id="edit-image-upload"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs flex items-center gap-1.5 transition-all hover:bg-white/10 active:scale-95"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--premium-text-secondary)',
                    borderRadius: '9999px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </Button>
              </div>
            </div>

            {/* Combined Image Grid (Existing + New) */}
            <AnimatePresence mode="popLayout">
              {(existingImages.length > 0 || selectedFiles.length > 0) && (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="grid gap-3 grid-cols-2" // Simplified to 2 cols for stability in edit mode
                >
                  {/* Existing Images */}
                  {existingImages.map((url, index) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      key={`existing-${url}-${index}`}
                      className="relative rounded-2xl overflow-hidden group border border-white/10 shadow-lg aspect-square"
                    >
                      <img
                        src={url}
                        alt="Existing attachment"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      <button
                        type="button"
                        onClick={() => removeExistingImage(url)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 border border-white/10 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/80 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}

                  {/* New Selected Files */}
                  {selectedFiles.map((file, index) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      key={`new-${file.name}-${index}`}
                      className="relative rounded-2xl overflow-hidden group border border-dashed border-white/20 shadow-lg aspect-square"
                    >
                      <img
                        src={previewUrls[index]}
                        alt="New upload preview"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">New</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeNewFile(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 border border-white/10 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/80 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Memory Type */}
          <div className="space-y-2">
            <Label htmlFor="memory_type" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
              Type (Optional)
            </Label>
            <Select
              id="memory_type"
              value={formData.memory_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  memory_type: e.target.value as '' | 'foundational' | 'event' | 'insight' | 'quick-note',
                })
              }
              className="text-base h-11 sm:h-12"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-primary)'
              }}
            >
              <option value="">Auto-detect</option>
              <option value="foundational">Foundational - Core knowledge</option>
              <option value="event">Event - Something that happened</option>
              <option value="insight">Insight - Realization or learning</option>
              <option value="quick-note">Quick Note - Lightweight thought</option>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2 pb-4">
            <Label htmlFor="tags" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
              Tags (Optional)
            </Label>
            <Input
              id="tags"
              placeholder="ai, programming, health"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="text-base h-11 sm:h-12"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-primary)'
              }}
              autoComplete="off"
            />
            <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              Comma-separated tags to categorize this memory
            </p>
          </div>

          <BottomSheetFooter>
            <Button
              type="submit"
              disabled={loading || !formData.title || !body.trim() || uploading}
              className="btn-primary w-full h-12 touch-manipulation"
            >
              {uploading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Uploading images...
                </>
              ) : loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full h-12 touch-manipulation"
            >
              Cancel
            </Button>
          </BottomSheetFooter>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}
