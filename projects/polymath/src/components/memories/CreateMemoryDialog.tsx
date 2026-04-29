/**
 * CreateMemoryDialog — Keep-style instant capture
 *
 *  • Tap → sheet slides up, textarea is already focused
 *  • Every keystroke is persisted to localStorage so nothing is ever lost
 *  • Closing the sheet (X / drag / tap-outside) saves automatically when
 *    there's content — no save button needed
 *  • Optimistic: the new memory appears in the list the instant you close,
 *    while the server quietly enriches it (title, tags, embeddings) behind
 *    the scenes
 *  • Offline: queued, then re-titled by the server on reconnect
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { useOfflineStore } from '../../stores/useOfflineStore'
import {
  Plus, Bold, Italic, List, Image as ImageIcon, X, CheckSquare, Square, MoreHorizontal,
} from 'lucide-react'
import { celebrate, checkThoughtMilestone, getMilestoneMessage } from '../../utils/celebrations'
import { handleInputFocus } from '../../utils/keyboard'
import { useAutoSuggestion } from '../../contexts/AutoSuggestionContext'
import { SuggestionToast } from '../SuggestionToast'
import { motion, AnimatePresence } from 'framer-motion'
import { useBodyEditor } from '../../hooks/useBodyEditor'
import { useNoteDraft } from '../../hooks/useNoteDraft'
import type { ChecklistItem } from '../../types'

interface VoiceSeed {
  id: string
  text: string
  type: 'bridge' | 'pressure' | 'neglect'
}

// Module-level cache — seeds survive between dialog opens within the same session
let seedsCache: { seeds: VoiceSeed[]; fetchedAt: number } | null = null
const SEEDS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function VoiceSeeds({
  onSelect,
  hasContent,
  isOpen,
}: {
  onSelect: (text: string) => void
  hasContent: boolean
  isOpen: boolean
}) {
  const [seeds, setSeeds] = useState<VoiceSeed[]>(() => seedsCache?.seeds ?? [])
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed state whenever the dialog opens fresh
  useEffect(() => {
    if (isOpen) setDismissed(false)
  }, [isOpen])

  // Fetch only after the sheet is fully on-screen, so the open animation
  // never competes with a network request.
  useEffect(() => {
    if (!isOpen) return
    const cacheValid = seedsCache && Date.now() - seedsCache.fetchedAt < SEEDS_CACHE_TTL
    if (cacheValid) {
      setSeeds(seedsCache!.seeds)
      return
    }
    const timer = setTimeout(() => {
      fetch('/api/memories?seeds=true')
        .then((r) => (r.ok ? r.json() : { seeds: [] }))
        .then((data) => {
          const fresh = data.seeds || []
          seedsCache = { seeds: fresh, fetchedAt: Date.now() }
          setSeeds(fresh)
        })
        .catch(() => {})
    }, 600) // After spring settles
    return () => clearTimeout(timer)
  }, [isOpen])

  if (dismissed || seeds.length === 0 || hasContent) return null

  return (
    <div
      className="pt-2 pb-1"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1 h-1 rounded-full opacity-30" style={{ background: 'var(--brand-primary)' }} />
        <span
          className="text-[10px] font-medium tracking-widest uppercase"
          style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}
        >
          Worth thinking about
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-auto opacity-20 hover:opacity-40 transition-opacity"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {seeds.map((seed, i) => (
          <motion.button
            key={seed.id}
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => {
              onSelect(seed.text)
              setDismissed(true)
            }}
            className="text-left text-sm px-3 py-1.5 rounded-lg transition-all active:scale-[0.98]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--brand-text-secondary)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {seed.text}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function ToolbarBtn({
  title, onClick, children, active,
}: {
  title: string; onClick: () => void; children: React.ReactNode; active?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="relative p-2 rounded-lg transition-all"
      style={{
        color: active ? 'var(--brand-primary)' : 'var(--brand-text-secondary)',
        opacity: active ? 1 : 0.4,
      }}
    >
      {children}
    </button>
  )
}

function ChecklistEditor({
  items,
  onChange,
}: {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}) {
  const addItem = () => {
    const newItem: ChecklistItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: '',
      checked: false,
    }
    onChange([...items, newItem])
    setTimeout(() => {
      const inputs = document.querySelectorAll('[data-checklist-item]')
      const last = inputs[inputs.length - 1] as HTMLInputElement
      last?.focus()
    }, 50)
  }

  const updateItem = (id: string, text: string) => {
    onChange(items.map((item) => item.id === id ? { ...item, text } : item))
  }

  const toggleItem = (id: string) => {
    onChange(items.map((item) => item.id === id ? { ...item, checked: !item.checked } : item))
  }

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem()
    } else if (e.key === 'Backspace' && (e.target as HTMLInputElement).value === '' && items.length > 1) {
      e.preventDefault()
      removeItem(id)
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-checklist-item]')
        const prev = inputs[Math.max(0, index - 1)] as HTMLInputElement
        prev?.focus()
      }, 50)
    }
  }

  return (
    <div className="flex flex-col gap-1 min-h-[120px]" style={{ paddingBottom: '8px' }}>
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-2 group"
          >
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className="flex-shrink-0 transition-all"
              style={{ color: item.checked ? 'var(--brand-primary)' : 'rgba(255,255,255,0.25)' }}
            >
              {item.checked
                ? <CheckSquare className="h-4 w-4" />
                : <Square className="h-4 w-4" />
              }
            </button>
            <input
              data-checklist-item
              type="text"
              value={item.text}
              placeholder="List item…"
              onChange={(e) => updateItem(item.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, item.id, index)}
              className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 py-1"
              style={{
                color: item.checked ? 'rgba(255,255,255,0.3)' : 'var(--brand-text-primary)',
                fontSize: '17px',
                lineHeight: '1.5',
                textDecoration: item.checked ? 'line-through' : 'none',
              }}
            />
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label="Remove item"
              className="flex-shrink-0 opacity-30 hover:opacity-80 transition-opacity p-2 rounded-lg min-h-[32px] min-w-[32px] flex items-center justify-center"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-2 py-1 transition-opacity opacity-30 hover:opacity-60 w-fit"
        style={{ color: 'var(--brand-text-secondary)' }}
      >
        <Plus className="h-4 w-4" />
        <span style={{ fontSize: '15px' }}>New item</span>
      </button>
    </div>
  )
}

export interface CreateMemoryDialogProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  trigger?: React.ReactNode
  initialMode?: 'text' | 'checklist'
  onSwitchType?: () => void
}

export function CreateMemoryDialog({
  isOpen,
  onOpenChange,
  hideTrigger = false,
  trigger,
  initialMode = 'text',
  onSwitchType,
}: CreateMemoryDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const { initialDraft, persist: persistDraft, clear: clearDraft } = useNoteDraft()

  const [isChecklistMode, setIsChecklistMode] = useState(
    initialDraft?.isChecklistMode ?? initialMode === 'checklist'
  )
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    initialDraft?.checklistItems?.length
      ? initialDraft.checklistItems
      : [{ id: `item_${Date.now()}`, text: '', checked: false }]
  )
  const { createMemory, memories } = useMemoryStore()
  const { addToast } = useToast()
  const { fetchSuggestions } = useAutoSuggestion()
  const { isOnline } = useOfflineStore()

  const {
    body, setBody, bodyRef, bodyFocused, setBodyFocused,
    wordCount, handleBodyChange, handleBodyKeyDown, applyFormat,
  } = useBodyEditor({ minHeight: 160 })

  // Restore body draft once on first render
  const bodyHydrated = useRef(false)
  useEffect(() => {
    if (bodyHydrated.current) return
    if (initialDraft?.body) setBody(initialDraft.body)
    bodyHydrated.current = true
  }, [initialDraft, setBody])

  // Create and cleanup object URLs to prevent memory leaks
  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file))
    setPreviewUrls(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [selectedFiles])

  // Use controlled or uncontrolled state
  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const [formData, setFormData] = useState({
    title: initialDraft?.title ?? '',
    tags: initialDraft?.tags ?? '',
    memory_type: (initialDraft?.memoryType ?? '') as '' | 'foundational' | 'event' | 'insight' | 'quick-note',
  })
  const [recentTags, setRecentTags] = useState<string[]>([])
  const titleRef = useRef<HTMLInputElement>(null)

  // Persist draft on every meaningful change (debounced inside the hook)
  useEffect(() => {
    persistDraft({
      body,
      title: formData.title,
      isChecklistMode,
      checklistItems,
      memoryType: formData.memory_type,
      tags: formData.tags,
    })
  }, [body, formData.title, formData.tags, formData.memory_type, isChecklistMode, checklistItems, persistDraft])

  // Load recent tags from memories — only when sheet opens, not on every mount
  useEffect(() => {
    if (!open) return
    const memoryStore = useMemoryStore.getState()
    const allTags = memoryStore.memories
      .flatMap((m) => m.tags || [])
      .filter(Boolean)

    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 8)
      .map(([tag]) => tag)

    setRecentTags(topTags)
  }, [open])

  const resetForm = useCallback(() => {
    setFormData({ title: '', tags: '', memory_type: '' })
    setBody('')
    setSelectedFiles([])
    setIsChecklistMode(initialMode === 'checklist')
    setChecklistItems([{ id: `item_${Date.now()}`, text: '', checked: false }])
    clearDraft()
  }, [initialMode, setBody, clearDraft])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadImages = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return []

    setUploading(true)
    const urls: string[] = []

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        const authResponse = await fetch('/api/utilities?resource=upload-image', {
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

  const hasChecklistContent = checklistItems.some((item) => item.text.trim().length > 0)
  const hasContent = isChecklistMode ? hasChecklistContent : body.trim().length > 0

  // Single source of truth for "save what's in the sheet right now". Used by:
  //   • the floating Done button (explicit save)
  //   • close-to-save (drag down / X / tap outside)
  // Returns true if a save was kicked off.
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!hasContent) return false

    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const userTitle = formData.title.trim() || undefined

    let memoryData: Parameters<typeof createMemory>[0]
    if (isChecklistMode) {
      const validItems = checklistItems.filter((item) => item.text.trim().length > 0)
      memoryData = {
        title: userTitle || 'Checklist',
        checklist_items: validItems,
        tags: tags.length > 0 ? tags : undefined,
        memory_type: 'quick-note',
      }
    } else {
      memoryData = {
        ...(userTitle && { title: userTitle }),
        body: body.trim(),
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
      }
    }

    const savedTitle = userTitle
      || (isChecklistMode ? 'Checklist' : body.trim().substring(0, 60))
      || 'Quick thought'

    const previousMemoryCount = memories.length

    // Tear down the form synchronously so the UI feels instant. The store
    // already adds an optimistic memory at the top of the list.
    resetForm()

    // Run the network work in the background — never block the UI.
    void (async () => {
      try {
        let imageUrls: string[] = []
        if (selectedFiles.length > 0) {
          try {
            imageUrls = await uploadImages()
          } catch (uploadErr) {
            addToast({
              title: 'Image upload failed',
              description: uploadErr instanceof Error ? uploadErr.message : 'Unknown error',
              variant: 'destructive',
            })
          }
        }

        const finalData = imageUrls.length > 0
          ? { ...memoryData, image_urls: imageUrls }
          : memoryData

        const newMemory = await createMemory(finalData)

        if (newMemory?.id) {
          setLastCreatedId(newMemory.id)
          if (!isChecklistMode) {
            fetchSuggestions('thought', newMemory.id, `${savedTitle} ${body}`)
          }
        }

        const newCount = previousMemoryCount + 1
        const isMilestone = checkThoughtMilestone(newCount)
        const milestoneMessage = getMilestoneMessage('thought', newCount)

        if (isMilestone) {
          if (newCount === 1) celebrate.firstThought()
          else if (newCount === 10) celebrate.tenthThought()
          else if (newCount === 50) celebrate.fiftiethThought()
          else if (newCount === 100) celebrate.hundredthThought()

          addToast({
            title: milestoneMessage || 'Note saved',
            description: newCount === 1 ? 'Keep going.' : 'You\'re building an incredible knowledge base',
            variant: 'success',
          })
        } else if (!isOnline) {
          addToast({
            title: 'Saved offline',
            description: 'Will sync and get a smart title when back online.',
            variant: 'success',
          })
        }
      } catch (error) {
        addToast({
          title: 'Failed to save',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    })()

    return true
  }, [
    hasContent, formData, body, isChecklistMode, checklistItems, memories.length,
    selectedFiles, isOnline, createMemory, fetchSuggestions, addToast, resetForm,
  ])

  // Auto-save on close. Closing the sheet IS the save action — no button required.
  const handleOpenChange = useCallback(async (next: boolean) => {
    if (!next && hasContent) {
      await saveNow()
    } else if (!next) {
      // Closing with no content — clear the draft so it doesn't reappear empty
      clearDraft()
    }
    setOpen(next)
  }, [hasContent, saveNow, clearDraft, setOpen])

  // Submit handler for the explicit Done affordance
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const saved = await saveNow()
    if (saved) setOpen(false)
  }

  return (
    <>
      {/* Trigger Button */}
      {!hideTrigger && (trigger || (
        <button
          onClick={() => setOpen(true)}
          className="h-11 w-11 rounded-xl flex items-center justify-center transition-all hover:bg-[rgba(255,255,255,0.1)] bg-[var(--glass-surface)]"
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--brand-primary)'
          }}
          title="New Thought"
        >
          <Plus className="h-5 w-5" />
        </button>
      ))}

      <BottomSheet open={open} onOpenChange={handleOpenChange}>
        <BottomSheetContent>
          {/* Visually hidden title for accessibility */}
          <BottomSheetHeader className="sr-only">
            <BottomSheetTitle>Capture thought</BottomSheetTitle>
          </BottomSheetHeader>

          <form onSubmit={handleSubmit} className="flex flex-col pt-1">
            {/* ── Writing surface ── */}
            {isChecklistMode ? (
              <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />
            ) : (
              <textarea
                ref={bodyRef}
                id="body"
                placeholder="What's on your mind?"
                value={body}
                onChange={handleBodyChange}
                onKeyDown={handleBodyKeyDown}
                onFocus={(e) => { setBodyFocused(true); handleInputFocus(e) }}
                onBlur={() => setBodyFocused(false)}
                autoFocus
                className="w-full border-0 focus:outline-none focus:ring-0 resize-none appearance-none bg-transparent"
                style={{
                  color: 'var(--brand-text-primary)',
                  fontSize: '17px',
                  lineHeight: '1.65',
                  minHeight: '160px',
                }}
              />
            )}

            {/* ── Title — ghost, secondary ── */}
            <input
              ref={titleRef}
              id="title"
              placeholder={isChecklistMode ? 'Checklist title…' : 'Title (optional — we\'ll write one for you)'}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              onFocus={handleInputFocus}
              autoComplete="off"
              className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mb-3"
              style={{
                fontSize: '13px',
                color: 'var(--brand-text-secondary)',
                opacity: formData.title ? 0.7 : 0.35,
              }}
            />

            {/* ── Image previews ── */}
            <AnimatePresence mode="popLayout">
              {selectedFiles.length > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`grid gap-2 mb-3 ${selectedFiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
                >
                  {selectedFiles.map((file, index) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      key={`${file.name}-${index}`}
                      className={`relative rounded-xl overflow-hidden ${
                        selectedFiles.length === 3 && index === 0 ? 'col-span-2 aspect-[2/1]' :
                        selectedFiles.length === 1 ? 'aspect-[16/9]' : 'aspect-square'
                      }`}
                      style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
                    >
                      <img src={previewUrls[index]} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
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

            {/* ── Toolbar ── */}
            <div
              className="flex items-center gap-0.5 pt-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* Checklist toggle */}
              <ToolbarBtn
                title={isChecklistMode ? 'Switch to text' : 'Switch to checklist'}
                onClick={() => setIsChecklistMode(!isChecklistMode)}
                active={isChecklistMode}
              >
                <CheckSquare className="h-4 w-4" />
              </ToolbarBtn>

              {/* Formatting (text mode only) */}
              {!isChecklistMode && (
                <>
                  <ToolbarBtn title="Bold" onClick={() => applyFormat('bold')}>
                    <Bold className="h-4 w-4" />
                  </ToolbarBtn>
                  <ToolbarBtn title="Italic" onClick={() => applyFormat('italic')}>
                    <Italic className="h-4 w-4" />
                  </ToolbarBtn>
                  <ToolbarBtn title="Bullet list" onClick={() => applyFormat('bullet')}>
                    <List className="h-4 w-4" />
                  </ToolbarBtn>
                </>
              )}

              {/* Photo */}
              <div className="relative ml-0.5">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <ToolbarBtn title="Add photo" onClick={() => {}}>
                  <ImageIcon className="h-4 w-4" />
                  {selectedFiles.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center text-black"
                      style={{ background: 'var(--brand-primary)' }}>
                      {selectedFiles.length}
                    </span>
                  )}
                </ToolbarBtn>
              </div>

              {/* Other note types — projects, articles, lists */}
              {onSwitchType && (
                <ToolbarBtn title="Other types" onClick={onSwitchType}>
                  <MoreHorizontal className="h-4 w-4" />
                </ToolbarBtn>
              )}

              {/* Spacer + ambient status */}
              <div className="flex-1 flex items-center justify-center gap-2">
                {bodyFocused && wordCount > 0 && !isChecklistMode && (
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
                    {wordCount}w
                  </span>
                )}
                {isChecklistMode && (
                  <span className="text-[10px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}>
                    {checklistItems.filter((i) => i.checked).length}/{checklistItems.filter((i) => i.text).length} done
                  </span>
                )}
                {hasContent && (
                  <span
                    className="text-[10px] tracking-widest uppercase font-semibold"
                    style={{
                      color: isOnline ? 'rgba(var(--brand-primary-rgb), 0.6)' : 'rgba(255, 200, 80, 0.65)',
                      opacity: 0.7,
                    }}
                  >
                    {isOnline ? 'Saved' : 'Offline draft'}
                  </span>
                )}
              </div>

              {/* Type pills (text mode only) */}
              {!isChecklistMode && (
                <div className="flex items-center gap-0.5 mr-2">
                  {([
                    { value: '', label: 'Auto' },
                    { value: 'foundational', label: 'Core' },
                    { value: 'event', label: 'Event' },
                    { value: 'insight', label: 'Insight' },
                  ] as const).map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, memory_type: type.value as '' | 'foundational' | 'event' | 'insight' | 'quick-note' })}
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0"
                      style={{
                        background: formData.memory_type === type.value ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: 'var(--brand-text-secondary)',
                        opacity: formData.memory_type === type.value ? 1 : 0.35,
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Done — explicit save shortcut. Close-to-save still works without it. */}
              <button
                type="submit"
                disabled={!hasContent || uploading}
                aria-label="Done"
                className="flex-shrink-0 px-3 h-9 rounded-full text-[12px] font-bold uppercase tracking-[0.15em] transition-all touch-manipulation disabled:opacity-30"
                style={{
                  background: hasContent ? 'rgba(var(--brand-primary-rgb), 0.18)' : 'transparent',
                  color: hasContent ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-secondary)',
                  border: hasContent
                    ? '1px solid rgba(var(--brand-primary-rgb), 0.35)'
                    : '1px solid transparent',
                }}
                title={uploading ? 'Uploading…' : 'Done'}
              >
                {uploading ? '…' : 'Done'}
              </button>
            </div>

            {/* ── Recent tags — tappable chips below toolbar ── */}
            {recentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {recentTags.map((tag) => {
                  const currentTags = formData.tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0)
                  const isSelected = currentTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          const updated = currentTags.filter((t) => t !== tag).join(', ')
                          setFormData({ ...formData, tags: updated })
                        } else {
                          const updated = [...currentTags, tag].join(', ')
                          setFormData({ ...formData, tags: updated })
                        }
                      }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95"
                      style={{
                        background: isSelected
                          ? 'rgba(var(--brand-primary-rgb),0.15)'
                          : 'rgba(255,255,255,0.04)',
                        border: isSelected
                          ? '1px solid rgba(var(--brand-primary-rgb),0.35)'
                          : '1px solid rgba(255,255,255,0.08)',
                        color: isSelected
                          ? 'rgba(165,148,249,0.9)'
                          : 'var(--brand-text-muted)',
                      }}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Voice seeds — below toolbar, passive, hidden once writing starts (text mode only) ── */}
            {!isChecklistMode && (
              <VoiceSeeds
                hasContent={!!body.trim()}
                isOpen={open}
                onSelect={(text) => {
                  setBody(text)
                  requestAnimationFrame(() => {
                    if (bodyRef.current) {
                      bodyRef.current.style.height = 'auto'
                      bodyRef.current.style.height =
                        Math.max(120, bodyRef.current.scrollHeight) + 'px'
                      bodyRef.current.focus()
                      bodyRef.current.setSelectionRange(text.length, text.length)
                    }
                  })
                }}
              />
            )}
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
