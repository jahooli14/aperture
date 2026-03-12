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
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { Plus, Brain, ChevronDown } from 'lucide-react'
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

  // Auto-grow textarea — batched in rAF to avoid double-reflow per keystroke
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

    // Match bullet patterns: "- ", "• ", "* ", "[] ", "[x] ", numbered "1. " etc.
    const bulletMatch = currentLine.match(/^(\s*)([-•*]|\[\s?\]|\[x\]|\d+\.)\s/)
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

      // Only send title if user explicitly typed one — AI will generate it otherwise
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
          className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
          style={{
            boxShadow: 'inset 0 0 0 1px rgba(100,180,255,0.2)',
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
              <Brain className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              <BottomSheetTitle>Capture thought</BottomSheetTitle>
            </div>
            <BottomSheetDescription>
              What's on your mind?
            </BottomSheetDescription>
          </BottomSheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Body — primary field, auto-growing textarea */}
            <div
              className="rounded-xl transition-all duration-200 px-3 py-2.5"
              style={{
                background: bodyFocused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                boxShadow: bodyFocused
                  ? 'inset 0 0 0 1.5px rgba(99,179,237,0.4)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.07)',
              }}
            >
              <textarea
                ref={bodyRef}
                id="body"
                placeholder="What's on your mind?&#10;&#10;Start with - or • for bullet lists"
                value={body}
                onChange={handleBodyChange}
                onKeyDown={handleBodyKeyDown}
                onFocus={(e) => { setBodyFocused(true); handleInputFocus(e) }}
                onBlur={() => setBodyFocused(false)}
                required
                autoFocus
                className="w-full text-[15px] leading-relaxed border-0 focus:outline-none focus:ring-0 resize-none placeholder:text-white/20 appearance-none"
                style={{
                  color: 'var(--premium-text-primary)',
                  backgroundColor: 'transparent',
                  minHeight: '120px',
                }}
              />
            </div>

            {/* Title — secondary, optional */}
            <div>
              <Input
                id="title"
                placeholder="Title (optional)"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onFocus={handleInputFocus}
                autoComplete="off"
                className="h-10 border-0 border-b rounded-none bg-transparent px-1 text-sm focus:ring-0 focus:border-b focus:border-white/20 placeholder:text-white/20"
                style={{ color: 'var(--premium-text-secondary)' }}
              />
            </div>

            {/* Quick tags - always visible */}
            {recentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
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
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      formData.tags?.split(',').map(t => t.trim()).includes(tag)
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-white/5 text-gray-500 hover:bg-white/10'
                    }`}
                    style={{
                      boxShadow: formData.tags?.split(',').map(t => t.trim()).includes(tag)
                        ? 'inset 0 0 0 1px rgba(99,179,237,0.3)'
                        : 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                    }}
                  >
                    {tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowOptions(true)}
                  className="px-2.5 py-1 rounded-full text-xs text-gray-600 hover:bg-white/5 transition-colors"
                  style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
                >
                  + tag
                </button>
              </div>
            )}

            {/* Quick Actions Row — Photos + More Options */}
            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
              {/* Photo button */}
              <div className="relative">
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
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all hover:bg-white/5"
                  style={{ color: 'var(--premium-text-secondary)' }}
                >
                  <ImageIcon className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />
                  Photo
                  {selectedFiles.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-bold">
                      {selectedFiles.length}
                    </span>
                  )}
                </button>
              </div>

              {/* More Options toggle */}
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all hover:bg-white/5"
                style={{ color: 'var(--premium-text-secondary)' }}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
                {showOptions ? 'Less' : 'Type & Tags'}
              </button>
            </div>

            {/* Image Preview Grid */}
            <AnimatePresence mode="popLayout">
              {selectedFiles.length > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`grid gap-2 ${selectedFiles.length === 1 ? 'grid-cols-1' :
                    selectedFiles.length === 2 ? 'grid-cols-2' :
                      selectedFiles.length === 3 ? 'grid-cols-2' :
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
                      className={`relative rounded-xl overflow-hidden group border border-white/10 shadow-lg ${selectedFiles.length === 3 && index === 0 ? 'col-span-2 aspect-[2/1]' :
                        selectedFiles.length === 1 ? 'aspect-[16/9]' : 'aspect-square'
                        }`}
                    >
                      <img
                        src={previewUrls[index]}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                      {/* Always visible on touch — no hover required */}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/50 backdrop-blur-md text-white/90 border border-white/10 active:bg-red-500/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapsible Options */}
            <AnimatePresence>
              {showOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 pt-2">
                    {/* Memory Type — pill buttons instead of dropdown */}
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase tracking-widest text-gray-500">Type</Label>
                      <div className="flex flex-wrap gap-2">
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
                            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${formData.memory_type === type.value
                              ? 'bg-white text-black border-white'
                              : 'bg-transparent border-white/10 text-gray-400 hover:border-white/30'
                              }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase tracking-widest text-gray-500">Tags</Label>
                      <Input
                        id="tags"
                        placeholder="ai, programming, health"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        onFocus={handleInputFocus}
                        className="h-11 bg-white/5 border-white/10 focus:border-blue-400 placeholder:text-white/15"
                        style={{ color: 'var(--premium-text-primary)' }}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <BottomSheetFooter>
              <Button
                type="submit"
                disabled={loading || !body.trim() || uploading}
                className="w-full h-12 font-bold tracking-wide text-[15px] touch-manipulation"
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '2px solid rgba(59,130,246,0.5)',
                  borderRadius: '4px',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                  color: 'var(--premium-blue)',
                }}
              >
                {uploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-black border-r-transparent mr-2"></div>
                    Uploading...
                  </>
                ) : loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-black border-r-transparent mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Capture'
                )}
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
