/**
 * Create Project Dialog
 * Mobile-optimized bottom sheet for creating new projects — single step
 */

import { useState } from 'react'
import { Plus, Layers } from 'lucide-react'
import { Button } from '../ui/button'
import { handleInputFocus } from '../../utils/keyboard'
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
    end_goal: '',
    project_mode: 'completion' as 'completion' | 'recurring',
    next_step: '',
    type: 'Creative',
  })

  const isFormValid = formData.title.length > 2 && formData.description.length > 10

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      end_goal: '',
      project_mode: 'completion',
      next_step: '',
      type: 'Creative',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
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
        status: 'active',
        type: formData.type,
        metadata: {
          tasks,
          progress: 0,
          end_goal: formData.project_mode === 'completion' ? (formData.end_goal || undefined) : undefined,
          project_mode: formData.project_mode,
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
          className="h-10 w-10 rounded-xl flex items-center justify-center border transition-all hover:bg-[rgba(255,255,255,0.05)]"
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
              Name it, describe it, and you're ready to go
            </BottomSheetDescription>
          </BottomSheetHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-bold text-xs uppercase tracking-widest text-blue-400">Project Name <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                placeholder="Project Aperture"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onFocus={handleInputFocus}
                className="text-2xl h-16 font-bold bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] focus:border-zebra-accent focus:ring-0 transition-all placeholder:text-[var(--brand-text-primary)]/10"
                autoComplete="off"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-bold text-xs uppercase tracking-widest text-blue-400">
                Description <span className="text-red-500">*</span>
              </Label>
              <Input
                id="description"
                placeholder="A short sentence explaining the project..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                onFocus={handleInputFocus}
                className="h-14 bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] focus:border-blue-400 placeholder:text-[var(--brand-text-primary)]/10"
                autoComplete="off"
              />
              <p className="text-[10px] text-[var(--brand-text-muted)] text-right">{formData.description.length}/10 chars min</p>
            </div>

            {/* Classification */}
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">Classification</Label>
              <div className="grid grid-cols-3 gap-2">
                {['Writing', 'Tech', 'Art', 'Music', 'Business', 'Creative'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: cat })}
                    className={`p-3 rounded-xl text-sm font-bold border transition-all text-center ${formData.type === cat
                      ? 'bg-white text-black border-white'
                      : 'bg-black border-[rgba(255,255,255,0.08)] text-[var(--brand-text-secondary)] hover:border-white/30'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Project Mode Toggle */}
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">
                Project Type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, project_mode: 'completion' })}
                  className={`p-3 rounded-xl text-xs font-bold border transition-all text-left ${formData.project_mode === 'completion'
                    ? 'bg-white text-black border-white'
                    : 'bg-black border-[rgba(255,255,255,0.08)] text-[var(--brand-text-secondary)] hover:border-white/30'
                    }`}
                >
                  <div className="font-bold">Has End Goal</div>
                  <div className="text-[10px] opacity-60 mt-0.5">Ship it, complete it</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, project_mode: 'recurring' })}
                  className={`p-3 rounded-xl text-xs font-bold border transition-all text-left ${formData.project_mode === 'recurring'
                    ? 'bg-white text-black border-white'
                    : 'bg-black border-[rgba(255,255,255,0.08)] text-[var(--brand-text-secondary)] hover:border-white/30'
                    }`}
                >
                  <div className="font-bold">Ongoing Habit</div>
                  <div className="text-[10px] opacity-60 mt-0.5">Stay fit, keep learning</div>
                </button>
              </div>
            </div>

            {/* Definition of Done - only for completion projects */}
            {formData.project_mode === 'completion' && (
              <div className="space-y-2">
                <Label htmlFor="end_goal" className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">
                  Definition of Done (Optional)
                </Label>
                <Input
                  id="end_goal"
                  placeholder="e.g., 'App live on App Store'"
                  value={formData.end_goal}
                  onChange={(e) => setFormData({ ...formData, end_goal: e.target.value })}
                  onFocus={handleInputFocus}
                  className="h-14 bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] focus:border-blue-400 placeholder:text-[var(--brand-text-primary)]/10"
                  autoComplete="off"
                />
              </div>
            )}

            {/* First Step */}
            <div className="space-y-2 pb-4">
              <Label htmlFor="next_step" className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">
                First Step (Optional)
              </Label>
              <Input
                id="next_step"
                placeholder="e.g., Create repo, Buy domain..."
                value={formData.next_step}
                onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                onFocus={handleInputFocus}
                className="h-14 bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] focus:border-zebra-accent placeholder:text-[var(--brand-text-primary)]/10"
                autoComplete="off"
              />
            </div>

            <BottomSheetFooter>
              <Button
                type="submit"
                disabled={loading || !isFormValid}
                className="w-full h-14 font-black uppercase tracking-widest touch-manipulation"
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '2px solid rgba(59,130,246,0.5)',
                  borderRadius: '4px',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                  color: 'var(--premium-blue)',
                }}
              >
                {loading ? 'Launching...' : 'Create Project'}
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
