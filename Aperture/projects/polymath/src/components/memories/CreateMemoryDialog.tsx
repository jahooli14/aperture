/**
 * CreateMemoryDialog - Manual Memory Creation
 * Visually stunning dialog for capturing thoughts manually
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
import { Textarea } from '../ui/textarea'
import { Select } from '../ui/select'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { Plus, Sparkles } from 'lucide-react'

export function CreateMemoryDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { createMemory } = useMemoryStore()
  const { addToast } = useToast()

  const [formData, setFormData] = useState({
    title: '',
    body: '',
    tags: '',
    memory_type: '' as '' | 'foundational' | 'event' | 'insight',
  })

  const resetForm = () => {
    setFormData({
      title: '',
      body: '',
      tags: '',
      memory_type: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await createMemory({
        title: formData.title,
        body: formData.body,
        tags: tags.length > 0 ? tags : undefined,
        memory_type: formData.memory_type || undefined,
      })

      addToast({
        title: 'Memory captured!',
        description: 'Your thought has been saved to your knowledge graph',
        variant: 'success',
      })

      resetForm()
      setOpen(false)
    } catch (error) {
      addToast({
        title: 'Failed to create memory',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="btn-primary">
        <Plus className="mr-2 h-4 w-4" />
        New Memory
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        {/* Subtle accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-50" />

        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-6 w-6 text-orange-600" />
            <DialogTitle className="text-2xl font-semibold text-neutral-900">Capture a Memory</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Manually add a thought, idea, or insight to your personal knowledge graph
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-6">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title" className="font-semibold text-gray-700">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="What's this memory about?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              />
            </div>

            {/* Body */}
            <div className="grid gap-2">
              <Label htmlFor="body" className="font-semibold text-gray-700">
                Content <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="body"
                placeholder="Write your thoughts, ideas, or what you learned..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                required
                rows={6}
                className="border-orange-200 focus:border-orange-400 focus:ring-orange-400 resize-none"
              />
              <p className="text-xs text-gray-500">
                This will be analyzed by AI to extract entities, themes, and connections
              </p>
            </div>

            {/* Memory Type */}
            <div className="grid gap-2">
              <Label htmlFor="memory_type" className="font-semibold text-gray-700">
                Memory Type
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
                className="border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              >
                <option value="">Auto-detect</option>
                <option value="foundational">Foundational - Core knowledge or skill</option>
                <option value="event">Event - Something that happened</option>
                <option value="insight">Insight - Realization or learning</option>
              </Select>
            </div>

            {/* Tags */}
            <div className="grid gap-2">
              <Label htmlFor="tags" className="font-semibold text-gray-700">
                Tags
              </Label>
              <Input
                id="tags"
                placeholder="ai, programming, health (comma-separated)"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              />
              <p className="text-xs text-gray-500">
                Optional. Add tags to help categorize this memory
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm()
                setOpen(false)
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.title || !formData.body}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Capture Memory
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
