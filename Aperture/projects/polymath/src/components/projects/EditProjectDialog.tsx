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
    type: 'personal' as 'personal' | 'technical' | 'meta',
    status: 'active' as 'active' | 'dormant' | 'completed' | 'archived',
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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details and track its progress.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                placeholder="My Awesome Project"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="What is this project about?"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  id="edit-type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as typeof formData.type,
                    })
                  }
                >
                  <option value="personal">👤 Personal</option>
                  <option value="technical">⚙️ Technical</option>
                  <option value="meta">🧠 Meta</option>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  id="edit-status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as typeof formData.status,
                    })
                  }
                >
                  <option value="active">🚀 Active</option>
                  <option value="dormant">💤 Dormant</option>
                  <option value="completed">✅ Completed</option>
                  <option value="archived">📦 Archived</option>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.title}>
              {loading ? 'Updating...' : 'Update Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
