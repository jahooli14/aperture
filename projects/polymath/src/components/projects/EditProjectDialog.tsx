/**
 * Edit Project Dialog
 * Bottom sheet for editing existing project details
 */

import { useState, useEffect } from 'react'
import { Layers, Settings2 } from 'lucide-react'
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
import type { Project } from '../../types'

export interface EditProjectDialogProps {
    project: Project
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function EditProjectDialog({ project, isOpen, onOpenChange }: EditProjectDialogProps) {
    const [loading, setLoading] = useState(false)
    const { updateProject } = useProjectStore()
    const { addToast } = useToast()

    // Step state
    const [step, setStep] = useState<1 | 2>(1)
    const [direction, setDirection] = useState(0)

    const [formData, setFormData] = useState({
        title: project.title,
        description: project.description || '',
        end_goal: project.metadata?.end_goal || '',
        type: project.type || 'Creative',
    })

    // Sync with project prop if it changes
    useEffect(() => {
        setFormData({
            title: project.title,
            description: project.description || '',
            end_goal: project.metadata?.end_goal || '',
            type: project.type || 'Creative',
        })
    }, [project])

    const isStep1Valid = formData.title.length > 2
    const isStep2Valid = formData.description.length > 10

    const handleSubmit = async () => {
        setLoading(true)

        try {
            await updateProject(project.id, {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                metadata: {
                    ...project.metadata,
                    end_goal: formData.end_goal || undefined,
                },
            })

            addToast({
                title: 'Project updated!',
                description: `Changes to "${formData.title}" have been saved.`,
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

    const nextStep = () => {
        setDirection(1)
        setStep(2)
    }

    const prevStep = () => {
        setDirection(-1)
        setStep(1)
    }

    return (
        <BottomSheet open={isOpen} onOpenChange={onOpenChange}>
            <BottomSheetContent>
                <BottomSheetHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <Settings2 className="h-6 w-6 text-blue-400" />
                        <BottomSheetTitle>Edit Project</BottomSheetTitle>
                    </div>
                    <BottomSheetDescription>
                        Update your project's identity and vision for better AI analysis.
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
                                        <h3 className="text-2xl font-black italic uppercase tracking-tighter">Identity</h3>
                                        <p className="text-sm text-gray-400">The core definition.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="title" className="font-bold text-xs uppercase tracking-widest text-blue-400">Project Name</Label>
                                        <Input
                                            id="title"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="text-2xl h-16 font-bold bg-white/5 border-white/10 focus:border-blue-400 focus:ring-0 transition-all"
                                            autoComplete="off"
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
                                                    {formData.type === cat && <Layers className="h-4 w-4" />}
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
                                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">Vision</h3>
                                    <p className="text-sm text-gray-400">Context for the AI Engine.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className="font-bold text-xs uppercase tracking-widest text-blue-400">
                                        Description <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="h-14 bg-white/5 border-white/10 focus:border-blue-400"
                                        autoComplete="off"
                                    />
                                    <p className="text-[10px] text-gray-500 text-right">{formData.description.length}/10 chars min</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="end_goal" className="font-bold text-xs uppercase tracking-widest text-gray-500">
                                        Definition of Done (Optional)
                                    </Label>
                                    <Input
                                        id="end_goal"
                                        placeholder="What does 'complete' look like?"
                                        value={formData.end_goal}
                                        onChange={(e) => setFormData({ ...formData, end_goal: e.target.value })}
                                        className="h-14 bg-white/5 border-white/10 focus:border-blue-400 placeholder:text-white/20"
                                        autoComplete="off"
                                    />
                                    <p className="text-[10px] text-gray-500">Helps AI suggest tasks that drive toward completion</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex gap-3 mt-8">
                        {step === 2 && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={prevStep}
                                className="flex-1 h-14 bg-white/5 hover:bg-white/10"
                            >
                                Back
                            </Button>
                        )}

                        {step === 1 ? (
                            <Button
                                type="button"
                                onClick={nextStep}
                                disabled={!isStep1Valid}
                                className="flex-[2] h-14 bg-blue-600 text-white font-bold uppercase tracking-widest"
                            >
                                Vision Next
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading || !isStep2Valid}
                                className="flex-[2] h-14 bg-white text-black hover:bg-blue-400 font-black uppercase tracking-widest"
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>
                        )}
                    </div>

                    <div className="flex justify-center gap-2 mt-6">
                        {[1, 2].map(i => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-all ${step === i ? 'bg-white w-4' : 'bg-white/20'}`}
                            />
                        ))}
                    </div>
                </div>
            </BottomSheetContent>
        </BottomSheet>
    )
}
