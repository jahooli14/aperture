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

export interface CreateProjectDialogProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  trigger?: React.ReactNode
}

export function CreateProjectDialog({ isOpen, onOpenChange, hideTrigger = false, trigger }: CreateProjectDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
  const { createProject } = useProjectStore()
  const { addToast } = useToast()
  const { fetchSuggestions } = useAutoSuggestion()

  // Use controlled or uncontrolled state
  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    motivation: '',
    next_step: '',
    type: 'Creative',
  })

  // ... (rest of the file as before, replacing return)

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      motivation: '',
      next_step: '',
      type: 'Creative',
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
        type: formData.type,
        metadata: {
          tasks,
          progress: 0,
          motivation: formData.motivation,
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
      {!hideTrigger && (trigger || (
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
      ))}

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

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
                Category
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {['Creative', 'Tech', 'Writing', 'Business', 'Life', 'Learning'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: cat })}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all border ${formData.type === cat
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Motivation - The "So What" */}
            <div className="space-y-2">
              <Label htmlFor="motivation" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
                Motivation (Why?)
              </Label>
              <Input
                id="motivation"
                placeholder="Why is this project important right now?"
                value={formData.motivation}
                onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                className="text-base h-11 sm:h-12"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  borderColor: 'rgba(59, 130, 246, 0.2)',
                  color: 'var(--premium-text-primary)'
                }}
                autoComplete="off"
              />
              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                Defining the "why" helps the AI align suggestions with your goals.
              </p>
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
