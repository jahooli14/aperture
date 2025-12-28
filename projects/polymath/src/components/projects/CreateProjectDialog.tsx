/**
 * Create Project Dialog
 * Mobile-optimized bottom sheet for creating new projects
 */

import { useState } from 'react'
import { Plus, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

  // Wizard State
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [direction, setDirection] = useState(0)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    motivation: '',
    end_goal: '',
    next_step: '',
    type: 'Creative',
  })

  // Data Validation for Steps
  const isStep1Valid = formData.title.length > 2
  const isStep2Valid = formData.description.length > 10 && formData.motivation.length > 5


  // ... (rest of the file as before, replacing return)

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      motivation: '',
      end_goal: '',
      next_step: '',
      type: 'Creative',
    })
    setStep(1)
    setDirection(0)
  }

  const nextStep = () => {
    setDirection(1)
    setStep((prev) => (prev < 3 ? (prev + 1 as 1 | 2 | 3) : prev))
  }

  const prevStep = () => {
    setDirection(-1)
    setStep((prev) => (prev > 1 ? (prev - 1 as 1 | 2 | 3) : prev))
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
          end_goal: formData.end_goal || undefined,
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

          <div className="mt-6">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter">The Identity</h3>
                      <p className="text-sm text-gray-400">What are we building?</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="title" className="font-bold text-xs uppercase tracking-widest text-blue-400">Project Name</Label>
                      <Input
                        id="title"
                        placeholder="Project Aperture"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="text-2xl h-16 font-bold bg-white/5 border-white/10 focus:border-zebra-accent focus:ring-0 transition-all placeholder:text-white/10"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase tracking-widest text-gray-500">Classification</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {['Creative', 'Tech', 'Learning', 'Business'].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFormData({ ...formData, type: cat })}
                            className={`p-4 rounded-xl text-sm font-bold border transition-all text-left flex items-center justify-between group ${formData.type === cat
                              ? 'bg-white text-black border-white'
                              : 'bg-black border-white/10 text-gray-400 hover:border-white/30'
                              }`}
                          >
                            <span>{cat}</span>
                            {formData.type === cat && <Layers className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">The Vision</h3>
                    <p className="text-sm text-gray-400">Context is fuel for the Engine.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="font-bold text-xs uppercase tracking-widest text-blue-400">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="description"
                      placeholder="A short sentence explaining the project..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="h-14 bg-white/5 border-white/10 focus:border-blue-400 placeholder:text-white/10"
                      autoComplete="off"
                      autoFocus
                    />
                    <p className="text-[10px] text-gray-500 text-right">{formData.description.length}/10 chars min</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motivation" className="font-bold text-xs uppercase tracking-widest text-blue-400">
                      The "Why" <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="motivation"
                      placeholder="Why does this matter?"
                      value={formData.motivation}
                      onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                      className="h-14 bg-white/5 border-white/10 focus:border-blue-400 placeholder:text-white/10"
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_goal" className="font-bold text-xs uppercase tracking-widest text-gray-500">
                      Definition of Done
                    </Label>
                    <Input
                      id="end_goal"
                      placeholder="What does 'complete' look like? e.g., 'App live on App Store'"
                      value={formData.end_goal}
                      onChange={(e) => setFormData({ ...formData, end_goal: e.target.value })}
                      className="h-14 bg-white/5 border-white/10 focus:border-blue-400 placeholder:text-white/10"
                      autoComplete="off"
                    />
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                      <strong>AI Tip:</strong> Clear goals help the AI suggest tasks that drive toward completion, not busywork.
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">Ignition</h3>
                    <p className="text-sm text-gray-400">Ready to launch.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="next_step" className="font-bold text-xs uppercase tracking-widest text-gray-500">
                      First Step (Optional)
                    </Label>
                    <Input
                      id="next_step"
                      placeholder="e.g., Create repo, Buy domain..."
                      value={formData.next_step}
                      onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                      className="h-14 bg-white/5 border-white/10 focus:border-zebra-accent placeholder:text-white/10"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>

                  <div className="p-6 rounded-2xl bg-zebra border border-white/10 text-center relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Analyzing Context</div>
                      <div className="text-white font-black italic text-lg">{formData.title}</div>
                      <div className="text-sm text-gray-400 mt-1 line-clamp-1">{formData.description}</div>

                      <div className="mt-4 flex justify-center gap-2">
                        <span className="px-2 py-1 bg-white/10 rounded text-[10px] font-mono text-zebra-accent">Scaffolding Ready</span>
                        <span className="px-2 py-1 bg-white/10 rounded text-[10px] font-mono text-zebra-accent">AI Context Loaded</span>
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={prevStep}
                  className="flex-1 h-14 bg-white/5 hover:bg-white/10"
                >
                  Back
                </Button>
              )}

              {step < 3 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                  className="flex-[2] h-14 btn-primary font-bold uppercase tracking-widest"
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] h-14 bg-white text-black hover:bg-zebra-accent font-black uppercase tracking-widest"
                >
                  {loading ? 'Launching...' : 'Initialize Project'}
                </Button>
              )}
            </div>

            {/* Stepper Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${step === i ? 'bg-white w-4' : 'bg-white/20'}`}
                />
              ))}
            </div>
          </div>

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
