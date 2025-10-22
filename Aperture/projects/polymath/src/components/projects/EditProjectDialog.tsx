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
    type: 'creative' as 'creative' | 'technical' | 'learning',
    status: 'active' as 'active' | 'on-hold' | 'maintaining' | 'completed' | 'archived',
  })

  // Update form when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        title: project.title,
        description: project.description || '',
        type: project.type,
        status: project.status,
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
        type: formData.type,
        status: formData.status,
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
              <Label htmlFor="edit-type" className="text-sm sm:text-base">Type</Label>
              <Select
                id="edit-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as typeof formData.type,
                  })
                }
                className="text-base h-11 sm:h-12"
              >
                <option value="creative">🎨 Creative</option>
                <option value="technical">⚙️ Technical</option>
                <option value="learning">📚 Learning</option>
              </Select>
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
                <option value="active">🚀 Active</option>
                <option value="on-hold">⏸️ On Hold</option>
                <option value="maintaining">🔧 Maintaining</option>
                <option value="completed">✅ Completed</option>
                <option value="archived">📦 Archived</option>
              </Select>
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
