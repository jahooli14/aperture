/**
 * EditMemoryDialog - Edit existing memories with bullet-point input (Bottom Sheet)
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
import { Sparkles } from 'lucide-react'
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

  const [body, setBody] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    tags: '',
    memory_type: '' as '' | 'foundational' | 'event' | 'insight' | 'quick-note',
  })

  useEffect(() => {
    if (memory && open) {
      setFormData({
        title: memory.title,
        tags: memory.tags?.join(', ') || '',
        memory_type: memory.memory_type || '',
      })
      setBody(memory.body)
    }
  }, [memory, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memory) return

    setLoading(true)

    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await updateMemory(memory.id, {
        title: formData.title,
        body: body.trim(),
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
      })

      addToast({
        title: 'Thought updated!',
        description: 'Your changes have been saved',
        variant: 'success',
      })

      onMemoryUpdated?.()

      onOpenChange(false)
    } catch (error) {
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
            <Sparkles className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
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
              disabled={loading || !formData.title || !body.trim()}
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
