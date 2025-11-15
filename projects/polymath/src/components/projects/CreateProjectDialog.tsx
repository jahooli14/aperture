/**
 * Create Project Dialog
 * Mobile-optimized bottom sheet for creating new projects
 */

import { useState } from 'react'
import { Plus, Layers } from 'lucide-react'
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
    next_step: '',
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      next_step: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Create tasks array if first step is provided
      const tasks = formData.next_step ? [{
        id: crypto.randomUUID(),
        text: formData.next_step,
        done: false,
        created_at: new Date().toISOString(),
        order: 0
      }] : []

      await createProject({
        title: formData.title,
        description: formData.description || '',
        // type is optional - database will default to 'creative'
        status: 'active', // Always start as active
        metadata: {
          tasks,
          progress: 0,
        },
      })

      addToast({
        title: 'Project created!',
        description: `"${formData.title}" has been added to your projects.`,
        variant: 'success',
      })

      resetForm()
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
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="h-10 w-10 rounded-xl flex items-center justify-center border transition-all hover:bg-white/5"
        style={{
          borderColor: 'rgba(30, 42, 88, 0.2)',
          color: 'rgba(100, 180, 255, 1)'
        }}
        title="New Project"
      >
        <Plus className="h-5 w-5" />
      </button>

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <div className="flex items-center gap-3 mb-2">
              <Layers className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              <BottomSheetTitle>Start a New Project</BottomSheetTitle>
            </div>
            <BottomSheetDescription>
              Quick start - name it, describe it, and define the first step
            </BottomSheetDescription>
          </BottomSheetHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
                Project Name <span style={{ color: 'var(--premium-red)' }}>*</span>
              </Label>
              <Input
                id="title"
                placeholder="My Next Big Thing"
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

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
                Description (Optional)
              </Label>
              <Input
                id="description"
                placeholder="What's this project about?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="text-base h-11 sm:h-12"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--premium-text-primary)'
                }}
                autoComplete="off"
              />
            </div>

            {/* Next Step */}
            <div className="space-y-2 pb-4">
              <Label htmlFor="next_step" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
                First Step (Optional)
              </Label>
              <Input
                id="next_step"
                placeholder="e.g., Research ideas, Build prototype, Write outline"
                value={formData.next_step}
                onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                className="text-base h-11 sm:h-12"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--premium-text-primary)'
                }}
                autoComplete="off"
              />
            </div>

            <BottomSheetFooter>
              <Button
                type="submit"
                disabled={loading || !formData.title}
                className="btn-primary w-full h-12 touch-manipulation"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Layers className="mr-2 h-4 w-4" />
                    Create Project
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
          itemType="project"
          itemTitle={formData.title}
        />
      )}
    </>
  )
}
