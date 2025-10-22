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

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { createProject } = useProjectStore()
  const { addToast } = useToast()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'creative' as 'creative' | 'technical' | 'learning',
    status: 'active' as 'active' | 'on-hold' | 'maintaining' | 'completed' | 'archived',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await createProject({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        status: formData.status,
      })

      addToast({
        title: 'Project created!',
        description: `"${formData.title}" has been added to your projects.`,
        variant: 'success',
      })

      // Reset form and close dialog
      setFormData({
        title: '',
        description: '',
        type: 'creative',
        status: 'active',
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
        <button className="px-6 py-2.5 bg-orange-600 text-white rounded-full font-medium hover:bg-orange-700 transition-colors shadow-sm inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[85vh] sm:max-h-[80vh] p-0 flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-2xl">Create New Project</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Add a new project to track your creative work and strengthen capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-sm sm:text-base">Title *</Label>
              <Input
                id="title"
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
              <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
              <Textarea
                id="description"
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
              <Label htmlFor="type" className="text-sm sm:text-base">Type</Label>
              <Select
                id="type"
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
              <Label htmlFor="status" className="text-sm sm:text-base">Status</Label>
              <Select
                id="status"
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
              onClick={() => setOpen(false)}
              disabled={loading}
              className="w-full sm:w-auto h-11 sm:h-12"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.title} className="w-full sm:w-auto h-11 sm:h-12 btn-primary">
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
