/**
 * CreateMemoryDialog - Manual Memory Creation
 * Mobile-optimized bottom sheet for capturing thoughts manually
 */

import { useState } from 'react'
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
import { Plus, Sparkles } from 'lucide-react'
import { celebrate, checkThoughtMilestone, getMilestoneMessage } from '../../utils/celebrations'
import { useAutoSuggestion } from '../../contexts/AutoSuggestionContext'
import { SuggestionToast } from '../SuggestionToast'
import { supabase } from '../../lib/supabase'
import { Image as ImageIcon, X, Paperclip } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface CreateMemoryDialogProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  trigger?: React.ReactNode
}

export function CreateMemoryDialog({ isOpen, onOpenChange, hideTrigger = false, trigger }: CreateMemoryDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const { createMemory, memories } = useMemoryStore()
  const { addToast } = useToast()
  const { fetchSuggestions } = useAutoSuggestion()

  // Use controlled or uncontrolled state
  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const [body, setBody] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    tags: '',
    memory_type: '' as '' | 'foundational' | 'event' | 'insight',
  })

  // ... (rest of the file logic remains same, just replacing return)

  const resetForm = () => {
    setFormData({
      title: '',
      tags: '',
      memory_type: '',
    })
    setBody('')
    setSelectedFiles([])
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

        // 1. Get Signed URL from backend
        const authResponse = await fetch('/api/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName,
            fileType: file.type
          })
        })

        if (!authResponse.ok) {
          const errorData = await authResponse.json().catch(() => ({}))
          throw new Error(errorData.details || errorData.error || 'Failed to get upload URL')
        }

        const { signedUrl, publicUrl } = await authResponse.json()

        // 2. Upload directly to Supabase Storage via Signed URL
        const uploadResponse = await fetch(signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file
        })

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`)
        }

        urls.push(publicUrl)
      }
      return urls
    } catch (error) {
      console.error('Upload failed:', error)
      const message = error instanceof Error ? error.message : 'Unknown upload error'
      throw new Error(`Failed to upload images: ${message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Prepare data before closing
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    try {
      // Upload images first if any
      const imageUrls = await uploadImages()

      const memoryData = {
        title: formData.title,
        body: body.trim(),
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      }

      const savedTitle = formData.title

      // Close dialog immediately for better UX
      resetForm()
      setOpen(false)
      setLoading(false)

      // Save in background
      try {
        // NOTE: We already uploaded images above, but if createMemory fails they become orphaned.
        // In a production app cleanup might be needed, but acceptable for now.
        const newMemory = await createMemory(memoryData)

        // Trigger AI suggestion system
        if (newMemory?.id) {
          setLastCreatedId(newMemory.id)
          fetchSuggestions('thought', newMemory.id, `${savedTitle} ${body}`)
        }

        // Check for milestone celebrations
        const newCount = memories.length + 1
        const isMilestone = checkThoughtMilestone(newCount)
        const milestoneMessage = getMilestoneMessage('thought', newCount)

        if (isMilestone) {
          // Trigger celebration animation
          if (newCount === 1) celebrate.firstThought()
          else if (newCount === 10) celebrate.tenthThought()
          else if (newCount === 50) celebrate.fiftiethThought()
          else if (newCount === 100) celebrate.hundredthThought()

          addToast({
            title: milestoneMessage || 'Thought captured!',
            description: newCount === 1 ? 'Keep going!' : 'You\'re building an incredible knowledge base',
            variant: 'success',
          })
        } else {
          addToast({
            title: 'Thought captured!',
            description: 'Your thought has been saved to your knowledge graph',
            variant: 'success',
          })
        }
      } catch (error) {
        addToast({
          title: 'Failed to create thought',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.log('Submission catch block caught:', error)
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to prepare submission',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      {!hideTrigger && (trigger || (
        <button
          onClick={() => setOpen(true)}
          className="h-10 w-10 rounded-xl flex items-center justify-center border transition-all hover:bg-white/5"
          style={{
            borderColor: 'rgba(30, 42, 88, 0.2)',
            color: 'rgba(100, 180, 255, 1)'
          }}
          title="New Thought"
        >
          <Plus className="h-5 w-5" />
        </button>
      ))}

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              <BottomSheetTitle>Capture thought</BottomSheetTitle>
            </div>
            <BottomSheetDescription>
              Add a thought, idea, or insight
            </BottomSheetDescription>
          </BottomSheetHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
                Title <span style={{ color: 'var(--premium-red)' }}>*</span>
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
                Content <span style={{ color: 'var(--premium-red)' }}>*</span>
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

            {/* Image Attachments */}
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
                    id="image-upload"
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

              {/* Image Preview Grid - Smart Layout */}
              <AnimatePresence mode="popLayout">
                {selectedFiles.length > 0 && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`grid gap-3 ${selectedFiles.length === 1 ? 'grid-cols-1' :
                      selectedFiles.length === 2 ? 'grid-cols-2' :
                        selectedFiles.length === 3 ? 'grid-cols-2' : // First one spans full? handled below
                          'grid-cols-2'
                      }`}
                  >
                    {selectedFiles.map((file, index) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        key={`${file.name}-${index}`}
                        className={`relative rounded-2xl overflow-hidden group border border-white/10 shadow-lg ${selectedFiles.length === 3 && index === 0 ? 'col-span-2 aspect-[2/1]' :
                          selectedFiles.length === 1 ? 'aspect-[16/9]' : 'aspect-square'
                          }`}
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt="Preview"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <button
                          type="button"
                          onClick={() => removeFile(index)}
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
                    memory_type: e.target.value as '' | 'foundational' | 'event' | 'insight',
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
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Capture Thought
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetForm()
                  setOpen(false)
                }}
                disabled={loading}
                className="w-full h-12 touch-manipulation"
              >
                Cancel
              </Button>
            </BottomSheetFooter>
          </form>
        </BottomSheetContent>
      </BottomSheet>

      {/* AI Suggestion Toast */}
      {lastCreatedId && (
        <SuggestionToast
          itemId={lastCreatedId}
          itemType="thought"
          itemTitle={formData.title}
        />
      )}
    </>
  )
}
