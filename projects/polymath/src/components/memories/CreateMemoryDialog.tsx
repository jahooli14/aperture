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
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { Plus, Sparkles } from 'lucide-react'
import { celebrate, checkThoughtMilestone, getMilestoneMessage } from '../../utils/celebrations'
import { useAutoSuggestion } from '../../contexts/AutoSuggestionContext'
import { SuggestionToast } from '../SuggestionToast'

export function CreateMemoryDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
  const { createMemory, memories } = useMemoryStore()
  const { addToast } = useToast()
  const { fetchSuggestions } = useAutoSuggestion()

  const [body, setBody] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    tags: '',
    memory_type: '' as '' | 'foundational' | 'event' | 'insight',
  })

  const resetForm = () => {
    setFormData({
      title: '',
      tags: '',
      memory_type: '',
    })
    setBody('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Prepare data before closing
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const memoryData = {
      title: formData.title,
      body: body.trim(),
      tags: tags.length > 0 ? tags : undefined,
      memory_type: formData.memory_type || undefined,
    }

    const savedTitle = formData.title

    // Close dialog immediately for better UX
    resetForm()
    setOpen(false)
    setLoading(false)

    // Save in background
    try {
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
  }

  return (
    <>
      {/* Trigger Button */}
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
