import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select } from '../ui/select'
import { useToast } from '../ui/toast'
import { useProjectStore } from '../../stores/useProjectStore'
import type { Project } from '../../types'

interface EditProjectDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
  const [loading, setLoading] = useState(false)
  const { updateProject } = useProjectStore()
  const { addToast } = useToast()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'active' as 'upcoming' | 'active' | 'on-hold' | 'maintaining' | 'completed' | 'archived' | 'abandoned',
    priority: false,
    next_step: '',
    progress: 0,
  })

  // Update form when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        title: project.title,
        description: project.description || '',
        status: project.status,
        priority: project.priority || false,
        next_step: project.metadata?.next_step || '',
        progress: project.metadata?.progress || 0,
      })
    }
  }, [project])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return

    setLoading(true)

    try {
      await updateProject(project.id, {
        title: formData.title,
        description: formData.description,
        status: formData.status as any, // Status type updated to include 'abandoned'
        priority: formData.priority,
        metadata: {
          ...project.metadata,
          next_step: formData.next_step || undefined,
          progress: formData.progress > 0 ? formData.progress : undefined,
        },
      })

      addToast({
        title: 'Project updated!',
        description: `"${formData.title}" has been updated.`,
        variant: 'success',
      })

      onOpenChange(false)
    } catch (error) {
      addToast({
        title: 'Failed to update project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!project) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[85vh] sm:max-h-[80vh] p-0 flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-2xl">Edit Project</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Update your project details and track its progress.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title" className="text-sm sm:text-base">Title *</Label>
              <Input
                id="edit-title"
                placeholder="My Awesome Project"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="text-base h-11 sm:h-12"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description" className="text-sm sm:text-base">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="What is this project about?"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                className="text-base min-h-[100px]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-status" className="text-sm sm:text-base">Status</Label>
              <Select
                id="edit-status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as typeof formData.status,
                  })
                }
                className="text-base h-11 sm:h-12"
              >
                <option value="upcoming">📅 Upcoming</option>
                <option value="active">🚀 Active</option>
                <option value="on-hold">⏸️ On Hold</option>
                <option value="maintaining">🔧 Maintaining</option>
                <option value="completed">✅ Completed</option>
                <option value="archived">📦 Archived</option>
              </Select>
            </div>

            <div
              className="flex items-center gap-3 p-4 rounded-xl border-2"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderColor: 'rgba(59, 130, 246, 0.3)'
              }}
            >
              <input
                id="edit-priority"
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
                  htmlFor="edit-priority"
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
              <Label htmlFor="edit-next-step" className="text-sm sm:text-base">Next Step</Label>
              <Input
                id="edit-next-step"
                placeholder="e.g., Fix the login bug, Add color palette, Research frameworks"
                value={formData.next_step}
                onChange={(e) =>
                  setFormData({ ...formData, next_step: e.target.value })
                }
                className="text-base h-11 sm:h-12"
              />
              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                What's the immediate next action for this project?
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-progress" className="text-sm sm:text-base flex items-center justify-between">
                <span>Progress</span>
                <span className="font-bold" style={{ color: 'var(--premium-blue)' }}>
                  {formData.progress}%
                </span>
              </Label>
              <input
                id="edit-progress"
                type="range"
                min="0"
                max="100"
                step="5"
                value={formData.progress}
                onChange={(e) =>
                  setFormData({ ...formData, progress: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-neutral-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-900 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-900 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <div className="h-2 bg-neutral-200 rounded-full overflow-hidden -mt-2 pointer-events-none">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-900 transition-all duration-300"
                  style={{ width: `${formData.progress}%` }}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                Optional: Track completion percentage
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 border-t bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto h-11 sm:h-12"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.title} className="w-full sm:w-auto h-11 sm:h-12">
              {loading ? 'Updating...' : 'Update Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
