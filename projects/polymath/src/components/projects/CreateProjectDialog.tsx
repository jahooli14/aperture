/**
 * Create Project Dialog
 * Mobile-optimized bottom sheet for creating new projects  single step
 */

import { useState, useEffect } from 'react'
import { Plus, ArrowUp, ChevronDown } from 'lucide-react'
import { handleInputFocus } from '../../utils/keyboard'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../ui/toast'
import { useProjectStore } from '../../stores/useProjectStore'
import { useAutoSuggestion } from '../../contexts/AutoSuggestionContext'
import { SuggestionToast } from '../SuggestionToast'

export interface CreateProjectDialogProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  trigger?: React.ReactNode
  initialTitle?: string
  initialDescription?: string
  onCreated?: (projectId: string) => void
}

export function CreateProjectDialog({ isOpen, onOpenChange, hideTrigger = false, trigger, initialTitle, initialDescription, onCreated }: CreateProjectDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const { createProject } = useProjectStore()
  const { addToast } = useToast()
  const { fetchSuggestions } = useAutoSuggestion()

  // Use controlled or uncontrolled state
  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const [formData, setFormData] = useState({
    title: initialTitle || '',
    description: initialDescription || '',
    end_goal: '',
    project_mode: 'completion' as 'completion' | 'recurring',
    next_step: '',
    type: 'Creative',
  })

  // Sync initial values when dialog opens with pre-filled data
  useEffect(() => {
    if (open && (initialTitle || initialDescription)) {
      setFormData(prev => ({
        ...prev,
        title: initialTitle || prev.title,
        description: initialDescription || prev.description,
      }))
    }
  }, [open, initialTitle, initialDescription])

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

      const titleAtCreation = formData.title

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

      // Call onCreated with the newly created project ID if provided
      if (onCreated) {
        const newProj = useProjectStore.getState().allProjects.find(p => p.title === titleAtCreation)
        if (newProj) onCreated(newProj.id)
      }

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
          className="h-10 w-10 rounded-xl flex items-center justify-center border transition-all hover:bg-[var(--glass-surface)]"
          style={{
            borderColor: 'rgba(30, 42, 88, 0.2)',
            color: "var(--brand-text-secondary)"
          }}
          title="New Project"
        >
          <Plus className="h-5 w-5" />
        </button>
      ))}

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          <BottomSheetHeader className="sr-only">
            <BottomSheetTitle>New project</BottomSheetTitle>
          </BottomSheetHeader>

          <form onSubmit={handleSubmit} className="flex flex-col pt-1">
            {/* Title */}
            <input
              id="title"
              placeholder="Project name…"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              onFocus={handleInputFocus}
              autoComplete="off"
              autoFocus
              required
              className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none"
              style={{
                color: 'var(--brand-text-primary)',
                fontSize: '22px',
                fontWeight: 700,
                lineHeight: '1.3',
              }}
            />

            {/* Description */}
            <input
              id="description"
              placeholder="What is this about?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onFocus={handleInputFocus}
              autoComplete="off"
              className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mt-2 mb-4"
              style={{
                color: 'var(--brand-text-secondary)',
                fontSize: '15px',
                opacity: formData.description ? 0.7 : 0.4,
              }}
            />

            {/* Optional details */}
            <AnimatePresence>
              {showOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2 mb-4">
                    {formData.project_mode === 'completion' && (
                      <input
                        id="end_goal"
                        placeholder="End goal — what does done look like?"
                        value={formData.end_goal}
                        onChange={(e) => setFormData({ ...formData, end_goal: e.target.value })}
                        onFocus={handleInputFocus}
                        autoComplete="off"
                        className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none"
                        style={{ color: 'var(--brand-text-secondary)', fontSize: '14px', opacity: 0.6 }}
                      />
                    )}
                    <input
                      id="next_step"
                      placeholder="First step to get started?"
                      value={formData.next_step}
                      onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                      onFocus={handleInputFocus}
                      autoComplete="off"
                      className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none"
                      style={{ color: 'var(--brand-text-secondary)', fontSize: '14px', opacity: 0.6 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toolbar */}
            <div className="flex items-center gap-1 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Type pills */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
                {(['Writing', 'Tech', 'Art', 'Music', 'Business', 'Creative'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: cat })}
                    className="flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all"
                    style={{
                      background: formData.type === cat ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: 'var(--brand-text-secondary)',
                      opacity: formData.type === cat ? 1 : 0.35,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Mode toggle */}
              <div className="flex items-center flex-shrink-0 rounded-full overflow-hidden ml-1" style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
                {([
                  { value: 'completion', label: 'Finish' },
                  { value: 'recurring', label: 'Habit' },
                ] as const).map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, project_mode: mode.value })}
                    className="px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background: formData.project_mode === mode.value ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: 'var(--brand-text-secondary)',
                      opacity: formData.project_mode === mode.value ? 1 : 0.4,
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* More options */}
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="flex-shrink-0 p-1.5 rounded-lg transition-all opacity-30 hover:opacity-60"
                style={{ color: 'var(--brand-text-secondary)' }}
                title={showOptions ? 'Hide options' : 'More options'}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
              </button>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all touch-manipulation disabled:opacity-25 ml-1"
                style={{
                  background: isFormValid ? 'var(--brand-primary, #63b3ed)' : 'rgba(255,255,255,0.1)',
                  color: isFormValid ? '#000' : 'var(--brand-text-secondary)',
                }}
                title={loading ? 'Creating…' : 'Create project'}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
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
