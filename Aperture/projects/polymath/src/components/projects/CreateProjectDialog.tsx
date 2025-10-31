import { useState } from 'react'
import { Plus } from 'lucide-react'
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
import { useToast } from '../ui/toast'
import { useProjectStore } from '../../stores/useProjectStore'
import { useAutoSuggestion } from '../../contexts/AutoSuggestionContext'
import { SuggestionToast } from '../SuggestionToast'

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
  const { createProject } = useProjectStore()
  const { addToast } = useToast()
  const { fetchSuggestions } = useAutoSuggestion()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: false,
    next_step: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const newProject = await createProject({
        title: formData.title,
        description: formData.description || '',
        status: 'active', // Always start as active
        priority: formData.priority,
        metadata: {
          next_step: formData.next_step || undefined,
          progress: 0,
        },
      })

      // Trigger AI suggestion system
      if (newProject?.id) {
        setLastCreatedId(newProject.id)
        const content = `${formData.title} ${formData.description || ''} ${formData.next_step || ''}`
        fetchSuggestions('project', newProject.id, content)
      }

      addToast({
        title: 'Project created!',
        description: `"${formData.title}" has been added to your projects.`,
        variant: 'success',
      })

      // Reset form and close dialog
      setFormData({
        title: '',
        description: '',
        priority: false,
        next_step: '',
      })
      setOpen(false)
    } catch (error) {
      addToast({
        title: 'Failed to create project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="premium-glass border px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-white/5 transition-all" style={{ borderColor: 'rgba(59, 130, 246, 0.3)', color: 'var(--premium-blue)' }}>
          <Plus className="h-4 w-4" />
          <span style={{ color: 'var(--premium-text-primary)' }}>New Project</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[85vh] sm:max-h-[80vh] p-0 flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-2xl">Start a New Project</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Quick start - name it, describe it, and define the first step
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-sm sm:text-base">Project Name *</Label>
              <Input
                id="title"
                placeholder="My Next Big Thing"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="text-base h-11 sm:h-12"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm sm:text-base">Description (one-liner)</Label>
              <Input
                id="description"
                placeholder="What's this project about?"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="text-base h-11 sm:h-12"
              />
            </div>

            <div
              className="flex items-center gap-3 p-4 rounded-xl border-2"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderColor: 'rgba(59, 130, 246, 0.3)'
              }}
            >
              <input
                id="priority"
                type="checkbox"
                checked={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.checked })
                }
                className="w-5 h-5 rounded border-2 focus:ring-2 cursor-pointer"
                style={{
                  borderColor: 'var(--premium-blue)',
                  color: 'var(--premium-blue)'
                }}
              />
              <div className="flex-1">
                <Label
                  htmlFor="priority"
                  className="text-sm sm:text-base font-bold cursor-pointer"
                  style={{ color: 'var(--premium-text-primary)' }}
                >
                  ⭐ Priority Project
                </Label>
                <p className="text-xs mt-1" style={{ color: 'var(--premium-text-secondary)' }}>
                  Show on home page with next step highlighted
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="next-step" className="text-sm sm:text-base">What's the first step?</Label>
              <Input
                id="next-step"
                placeholder="e.g., Research ideas, Build prototype, Write outline"
                value={formData.next_step}
                onChange={(e) =>
                  setFormData({ ...formData, next_step: e.target.value })
                }
                className="text-base h-11 sm:h-12"
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 border-t premium-glass-subtle">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="w-full sm:w-auto h-11 sm:h-12"
              style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--premium-text-secondary)' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.title}
              className="w-full sm:w-auto h-11 sm:h-12"
              style={{
                backgroundColor: 'var(--premium-blue)',
                color: 'white',
                opacity: loading || !formData.title ? 0.5 : 1
              }}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* AI Suggestion Toast */}
      {lastCreatedId && (
        <SuggestionToast
          itemId={lastCreatedId}
          itemType="project"
          itemTitle={formData.title}
        />
      )}
    </Dialog>
  )
}
