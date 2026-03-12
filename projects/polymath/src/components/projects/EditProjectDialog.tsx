/**
 * Edit Project Dialog
 * Bottom sheet for editing existing project details — single step
 */

import { useState, useEffect } from 'react'
import { Layers, Settings2 } from 'lucide-react'
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

    const isFormValid = formData.title.length > 2 && formData.description.length > 10

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

    return (
        <BottomSheet open={isOpen} onOpenChange={onOpenChange}>
            <BottomSheetContent>
                <BottomSheetHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <Settings2 className="h-6 w-6 text-blue-400" />
                        <BottomSheetTitle>Edit Project</BottomSheetTitle>
                    </div>
                    <BottomSheetDescription>
                        Update your project details for better AI analysis.
                    </BottomSheetDescription>
                </BottomSheetHeader>

                <div className="mt-6 space-y-5">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title" className="font-bold text-xs uppercase tracking-widest text-blue-400">Project Name</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            onFocus={handleInputFocus}
                            className="text-2xl h-16 font-bold bg-white/5 border-white/10 focus:border-blue-400 focus:ring-0 transition-all"
                            autoComplete="off"
                        />
                    </div>

                    {/* Classification */}
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

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description" className="font-bold text-xs uppercase tracking-widest text-blue-400">
                            Description <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            onFocus={handleInputFocus}
                            className="h-14 bg-white/5 border-white/10 focus:border-blue-400"
                            autoComplete="off"
                        />
                        <p className="text-[10px] text-gray-500 text-right">{formData.description.length}/10 chars min</p>
                    </div>

                    {/* Definition of Done */}
                    <div className="space-y-2 pb-4">
                        <Label htmlFor="end_goal" className="font-bold text-xs uppercase tracking-widest text-gray-500">
                            Definition of Done (Optional)
                        </Label>
                        <Input
                            id="end_goal"
                            placeholder="What does 'complete' look like?"
                            value={formData.end_goal}
                            onChange={(e) => setFormData({ ...formData, end_goal: e.target.value })}
                            onFocus={handleInputFocus}
                            className="h-14 bg-white/5 border-white/10 focus:border-blue-400 placeholder:text-white/20"
                            autoComplete="off"
                        />
                        <p className="text-[10px] text-gray-500">Helps AI suggest tasks that drive toward completion</p>
                    </div>

                    <BottomSheetFooter>
                        <Button
                            type="button"
                            onClick={handleSubmit}
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
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </BottomSheetFooter>
                </div>
            </BottomSheetContent>
        </BottomSheet>
    )
}
