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
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { Sparkles, Plus, X } from 'lucide-react'
import type { Memory } from '../../types'

interface EditMemoryDialogProps {
  memory: Memory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditMemoryDialog({ memory, open, onOpenChange }: EditMemoryDialogProps) {
  const [loading, setLoading] = useState(false)
  const { updateMemory } = useMemoryStore()
  const { addToast } = useToast()

  const [bullets, setBullets] = useState<string[]>([''])
  const [formData, setFormData] = useState({
    title: '',
    tags: '',
    memory_type: '' as '' | 'foundational' | 'event' | 'insight',
  })

  useEffect(() => {
    if (memory && open) {
      setFormData({
        title: memory.title,
        tags: memory.tags?.join(', ') || '',
        memory_type: memory.memory_type || '',
      })

      // Convert body text to bullets (split by newlines or sentences)
      const bodyBullets = memory.body
        .split(/\n+/)
        .map(b => b.trim())
        .filter(b => b.length > 0)

      setBullets(bodyBullets.length > 0 ? bodyBullets : [''])
    }
  }, [memory, open])

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
    if (!memory) return

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

      await updateMemory(memory.id, {
        title: formData.title,
        body,
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
      })

      addToast({
        title: 'Memory updated!',
        description: 'Your changes have been saved',
        variant: 'success',
      })

      onOpenChange(false)
    } catch (error) {
      addToast({
        title: 'Failed to update memory',
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
            <BottomSheetTitle>Edit Memory</BottomSheetTitle>
          </div>
          <BottomSheetDescription>
            Update your captured thought
          </BottomSheetDescription>
        </BottomSheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-semibold text-gray-700 text-sm sm:text-base">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="What's this about?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 text-base h-11 sm:h-12"
                autoComplete="off"
              />
            </div>

            {/* Bullet Points */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-gray-700 text-sm sm:text-base">
                  Content <span className="text-red-500">*</span>
                </Label>
                <Button
                  type="button"
                  onClick={addBullet}
                  variant="ghost"
                  size="sm"
                  className="text-blue-900 hover:text-blue-950 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add point
                </Button>
              </div>

              <div className="space-y-3">
                {bullets.map((bullet, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-shrink-0 w-6 h-11 sm:h-12 flex items-center justify-center text-gray-400 font-medium">
                      •
                    </div>
                    <Input
                      placeholder={`Point ${index + 1}`}
                      value={bullet}
                      onChange={(e) => updateBullet(index, e.target.value)}
                      className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 text-base h-11 sm:h-12"
                      autoComplete="off"
                    />
                    {bullets.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeBullet(index)}
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500">
                AI will re-analyze this to extract entities and themes
              </p>
            </div>

            {/* Memory Type */}
            <div className="space-y-2">
              <Label htmlFor="memory_type" className="font-semibold text-gray-700 text-sm sm:text-base">
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
                className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 text-base h-11 sm:h-12"
              >
                <option value="">Auto-detect</option>
                <option value="foundational">Foundational - Core knowledge</option>
                <option value="event">Event - Something that happened</option>
                <option value="insight">Insight - Realization or learning</option>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2 pb-4">
              <Label htmlFor="tags" className="font-semibold text-gray-700 text-sm sm:text-base">
                Tags (Optional)
              </Label>
              <Input
                id="tags"
                placeholder="ai, programming, health"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 text-base h-11 sm:h-12"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500">
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
