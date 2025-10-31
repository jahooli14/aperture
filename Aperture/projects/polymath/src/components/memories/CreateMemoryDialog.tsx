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
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { Plus, Sparkles, X } from 'lucide-react'
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

  const [bullets, setBullets] = useState<string[]>([''])
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
    setBullets([''])
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const body = bullets
        .map(b => b.trim())
        .filter(b => b.length > 0)
        .join('\n\n')

      const newMemory = await createMemory({
        title: formData.title,
        body,
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
      })

      // Trigger AI suggestion system
      if (newMemory?.id) {
        setLastCreatedId(newMemory.id)
        fetchSuggestions('thought', newMemory.id, `${formData.title} ${body}`)
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

      resetForm()
      setOpen(false)
    } catch (error) {
      addToast({
        title: 'Failed to create thought',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="border-2 shadow-xl rounded-full px-6 py-2.5 font-medium transition-all hover:shadow-2xl inline-flex items-center gap-2 hover-lift touch-manipulation"
        style={{
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: 'rgba(99, 102, 241, 0.5)',
          color: 'var(--premium-indigo)'
        }}
      >
        <Plus className="h-4 w-4" />
        New Thought
      </button>

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              <BottomSheetTitle>Capture Memory</BottomSheetTitle>
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

            {/* Bullet Points */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
                  Content <span style={{ color: 'var(--premium-red)' }}>*</span>
                </Label>
                <Button
                  type="button"
                  onClick={addBullet}
                  variant="ghost"
                  size="sm"
                  style={{ color: 'var(--premium-blue)' }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add point
                </Button>
              </div>

              <div className="space-y-3">
                {bullets.map((bullet, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-shrink-0 w-6 h-11 sm:h-12 flex items-center justify-center font-medium" style={{ color: 'var(--premium-text-tertiary)' }}>
                      •
                    </div>
                    <Input
                      placeholder={`Point ${index + 1}`}
                      value={bullet}
                      onChange={(e) => updateBullet(index, e.target.value)}
                      className="text-base h-11 sm:h-12"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--premium-text-primary)'
                      }}
                      autoComplete="off"
                    />
                    {bullets.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeBullet(index)}
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0"
                        style={{ color: 'var(--premium-text-tertiary)' }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                AI will analyze this to extract entities and themes
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
                disabled={loading || !formData.title || bullets.every(b => !b.trim())}
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
