/**
 * CreateMemoryDialog - Manual Memory Creation
 * Mobile-optimized bottom sheet for capturing thoughts manually
 * Streamlined for fast, pleasant typing experience
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '../ui/button'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'
import { Input } from '../ui/input'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { Plus } from 'lucide-react'
import { celebrate, checkThoughtMilestone, getMilestoneMessage } from '../../utils/celebrations'
import { handleInputFocus } from '../../utils/keyboard'
import { useAutoSuggestion } from '../../contexts/AutoSuggestionContext'
import { SuggestionToast } from '../SuggestionToast'
import { Image as ImageIcon, X } from 'lucide-react'
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
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const { createMemory, memories } = useMemoryStore()
  const { addToast } = useToast()
  const { fetchSuggestions } = useAutoSuggestion()
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Create and cleanup object URLs to prevent memory leaks
  useEffect(() => {
    const urls = selectedFiles.map(file => URL.createObjectURL(file))
    setPreviewUrls(urls)

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedFiles])

  // Use controlled or uncontrolled state
  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const [body, setBody] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    tags: '',
    memory_type: '' as '' | 'foundational' | 'event' | 'insight' | 'quick-note',
  })
  const [recentTags, setRecentTags] = useState<string[]>([])
  const [bodyFocused, setBodyFocused] = useState(false)

  // Load recent tags from memories
  useEffect(() => {
    const memoryStore = useMemoryStore.getState()
    const allTags = memoryStore.memories
      .flatMap(m => m.tags || [])
      .filter(Boolean)

    // Count frequency and take top 8
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag)

    setRecentTags(topTags)
  }, [])

  const resetForm = () => {
    setFormData({
      title: '',
      tags: '',
      memory_type: '',
    })
    setBody('')
    setSelectedFiles([])
    setShowOptions(false)
  }

  // Auto-grow textarea  batched in rAF to avoid double-reflow per keystroke
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)
    const el = e.target
    requestAnimationFrame(() => {
      el.style.height = 'auto'
      el.style.height = Math.max(120, el.scrollHeight) + 'px'
    })
  }

  // Google Keep-style keyboard handling: auto-continue bullets on Enter
  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return

    const el = e.currentTarget
    const { selectionStart } = el
    const lines = body.slice(0, selectionStart).split('\n')
    const currentLine = lines[lines.length - 1]

    // Match bullet patterns: "- ", " ", "* ", "[] ", "[x] ", numbered "1. " etc.
    const bulletMatch = currentLine.match(/^(\s*)([-*]|\[\s?\]|\[x\]|\d+\.)\s/)
    if (!bulletMatch) return

    const [, indent, bullet] = bulletMatch

    // If the current line is ONLY the bullet (empty content), remove the bullet instead
    const contentAfterBullet = currentLine.slice(bulletMatch[0].length).trim()
    if (!contentAfterBullet) {
      e.preventDefault()
      const lineStart = body.lastIndexOf('\n', selectionStart - 1) + 1
      const newBody = body.slice(0, lineStart) + '\n' + body.slice(selectionStart)
      setBody(newBody)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = lineStart + 1
        el.style.height = 'auto'
        el.style.height = Math.max(120, el.scrollHeight) + 'px'
      })
      return
    }

    e.preventDefault()

    // Auto-increment numbered lists
    let nextBullet = bullet
    const numMatch = bullet.match(/^(\d+)\./)
    if (numMatch) {
      nextBullet = `${parseInt(numMatch[1]) + 1}.`
    }
    // Convert [x] to [] for next item
    if (bullet === '[x]') nextBullet = '[]'

    const insertion = `\n${indent}${nextBullet} `
    const newBody = body.slice(0, selectionStart) + insertion + body.slice(selectionStart)
    setBody(newBody)
    requestAnimationFrame(() => {
      const newPos = selectionStart + insertion.length
      el.selectionStart = el.selectionEnd = newPos
      el.style.height = 'auto'
      el.style.height = Math.max(120, el.scrollHeight) + 'px'
    })
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
        }).catch(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    try {
      const imageUrls = await uploadImages()

      // Only send title if user explicitly typed one  AI will generate it otherwise
      const userTitle = formData.title.trim() || undefined

      const memoryData = {
        ...(userTitle && { title: userTitle }),
        body: body.trim(),
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      }

      const savedTitle = userTitle || body.trim().substring(0, 60) || 'Quick thought'

      // Close dialog immediately for better UX
      resetForm()
      setOpen(false)
      setLoading(false)

      // Save in background
      try {
        const newMemory = await createMemory(memoryData)

        if (newMemory?.id) {
          setLastCreatedId(newMemory.id)
          fetchSuggestions('thought', newMemory.id, `${savedTitle} ${body}`)
        }

        const newCount = memories.length + 1
        const isMilestone = checkThoughtMilestone(newCount)
        const milestoneMessage = getMilestoneMessage('thought', newCount)

        if (isMilestone) {
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
          className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-[var(--glass-surface)]"
          style={{
            boxShadow: 'inset 0 0 0 1px rgba(100,180,255,0.2)',
            color: "var(--brand-text-secondary)"
          }}
          title="New Thought"
        >
          <Plus className="h-5 w-5" />
        </button>
      ))}

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          {/* Visually hidden title for accessibility */}
          <BottomSheetHeader className="sr-only">
            <BottomSheetTitle>Capture thought</BottomSheetTitle>
          </BottomSheetHeader>

          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            {/* Body — the hero: full writing surface */}
            <textarea
              ref={bodyRef}
              id="body"
              placeholder="What's on your mind?"
              value={body}
              onChange={handleBodyChange}
              onKeyDown={handleBodyKeyDown}
              onFocus={(e) => { setBodyFocused(true); handleInputFocus(e) }}
              onBlur={() => setBodyFocused(false)}
              required
              autoFocus
              className="w-full text-[17px] leading-relaxed border-0 focus:outline-none focus:ring-0 resize-none placeholder:opacity-20 appearance-none bg-transparent"
              style={{
                color: 'var(--brand-text-primary)',
                minHeight: '160px',
              }}
            />

            {/* Title — subtle underline, secondary */}
            <Input
              id="title"
              placeholder="Title (optional)"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              onFocus={handleInputFocus}
              autoComplete="off"
              className="h-9 border-0 border-b rounded-none bg-transparent px-0 text-sm focus:ring-0 focus:border-b focus:border-white/20 placeholder:opacity-20"
              style={{ color: "var(--brand-text-secondary)" }}
            />

            {/* Quick tags */}
            {recentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recentTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setFormData(prev => {
                        const tagList = prev.tags ? prev.tags.split(',').map(t => t.trim()).filter(Boolean) : []
                        if (tagList.includes(tag)) {
                          return { ...prev, tags: tagList.filter(t => t !== tag).join(', ') }
                        }
                        return { ...prev, tags: [...tagList, tag].join(', ') }
                      })
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                      formData.tags?.split(',').map(t => t.trim()).includes(tag)
                        ? 'opacity-100'
                        : 'opacity-40 hover:opacity-70'
                    }`}
                    style={{
                      background: formData.tags?.split(',').map(t => t.trim()).includes(tag)
                        ? 'rgba(99,179,237,0.15)'
                        : 'var(--glass-surface)',
                      color: 'var(--brand-text-secondary)',
                      boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Bottom bar: Photo + Type + Submit */}
            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--glass-surface)' }}>
              {/* Photo button */}
              <div className="relative flex-shrink-0">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  id="image-upload"
                />
                <button
                  type="button"
                  className="p-2 rounded-lg transition-all hover:bg-[var(--glass-surface)] opacity-50 hover:opacity-80"
                  style={{ color: "var(--brand-text-secondary)" }}
                  title="Add photo"
                >
                  <ImageIcon className="h-4 w-4" />
                  {selectedFiles.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--brand-primary)] rounded-full text-[9px] font-bold flex items-center justify-center text-black">
                      {selectedFiles.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Type pills — compact, inline */}
              <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                {[
                  { value: '', label: 'Auto' },
                  { value: 'foundational', label: 'Core' },
                  { value: 'event', label: 'Event' },
                  { value: 'insight', label: 'Insight' },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, memory_type: type.value as any })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                      formData.memory_type === type.value
                        ? 'opacity-100'
                        : 'opacity-30 hover:opacity-60'
                    }`}
                    style={{
                      background: formData.memory_type === type.value ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: 'var(--brand-text-secondary)',
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Preview Grid */}
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
                      className={`relative rounded-xl overflow-hidden border border-[var(--glass-surface-hover)] ${
                        selectedFiles.length === 3 && index === 0 ? 'col-span-2 aspect-[2/1]' :
                        selectedFiles.length === 1 ? 'aspect-[16/9]' : 'aspect-square'
                      }`}
                    >
                      <img src={previewUrls[index]} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md active:bg-brand-primary/80"
                        style={{ color: 'var(--brand-text-primary)' }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
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
                {uploading ? 'Uploading...' : loading ? 'Saving...' : 'Capture'}
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
