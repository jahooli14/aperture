/**
 * CreateMemoryDialog - Manual Memory Creation
 * Mobile-optimized dialog for capturing thoughts manually
 */

import { useState } from 'react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { Plus, Sparkles, X } from 'lucide-react'

export function CreateMemoryDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { createMemory } = useMemoryStore()
  const { addToast } = useToast()

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

      await createMemory({
        title: formData.title,
        body,
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
      })

      addToast({
        title: 'Thought captured!',
        description: 'Your thought has been saved to your knowledge graph',
        variant: 'success',
      })

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="backdrop-blur-xl bg-white/80 border-2 shadow-xl rounded-full px-6 py-2.5 font-medium transition-all hover:shadow-2xl inline-flex items-center gap-2 hover-lift" style={{ borderColor: 'rgba(99, 102, 241, 0.5)', color: '#6366f1' }}>
          <Plus className="h-4 w-4" />
          New Thought
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col overflow-hidden">
        {/* Subtle accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50" />

        <DialogHeader className="pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-blue-900 flex-shrink-0" />
            <DialogTitle className="text-lg sm:text-2xl font-semibold text-neutral-900">Capture Memory</DialogTitle>
          </div>
          <DialogDescription className="text-sm sm:text-base text-left">
            Add a thought, idea, or insight
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-4 sm:space-y-6">
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
                AI will analyze this to extract entities and themes
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
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 border-t bg-white">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm()
                setOpen(false)
              }}
              disabled={loading}
              className="w-full sm:w-auto h-11 sm:h-12"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.title || bullets.every(b => !b.trim())}
              className="btn-primary w-full sm:w-auto h-11 sm:h-12"
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
