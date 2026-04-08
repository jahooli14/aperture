/**
 * Edit Project Dialog
 * Bottom sheet for editing existing project details  single step
 */

import { useState, useEffect } from 'react'
import { Layers } from 'lucide-react'
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
import { PROJECT_TYPES } from '../../lib/projectTheme'

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
                    <BottomSheetTitle>Edit Project</BottomSheetTitle>
                    <BottomSheetDescription>
                        Update your project details.
                    </BottomSheetDescription>
                </BottomSheetHeader>

                <div className="mt-6 space-y-5">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-xs font-medium tracking-wide text-[var(--brand-text-secondary)]">project name</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            onFocus={handleInputFocus}
                            className="text-lg h-12 font-semibold bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-brand-primary focus:ring-0 transition-all"
                            autoComplete="off"
                        />
                    </div>

                    {/* Classification */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium tracking-wide text-[var(--brand-text-secondary)]">classification</Label>
                        <div className="flex flex-wrap gap-2">
                            {PROJECT_TYPES.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: cat })}
                                    className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${formData.type === cat
                                        ? 'border-[rgba(var(--brand-primary-rgb),0.4)] text-[var(--brand-primary)]'
                                        : 'border-[var(--glass-surface-hover)] text-[var(--brand-text-secondary)] hover:border-white/20'
                                        }`}
                                    style={formData.type === cat ? { background: 'rgba(var(--brand-primary-rgb),0.12)' } : { background: 'var(--glass-surface)' }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-xs font-medium tracking-wide text-[var(--brand-text-secondary)]">
                            description
                        </Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            onFocus={handleInputFocus}
                            className="h-12 bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-brand-primary"
                            autoComplete="off"
                        />
                    </div>

                    {/* Definition of Done */}
                    <div className="space-y-2 pb-4">
                        <Label htmlFor="end_goal" className="text-xs font-medium tracking-wide text-[var(--brand-text-secondary)]">
                            definition of done
                        </Label>
                        <Input
                            id="end_goal"
                            placeholder="What does 'complete' look like?"
                            value={formData.end_goal}
                            onChange={(e) => setFormData({ ...formData, end_goal: e.target.value })}
                            onFocus={handleInputFocus}
                            className="h-12 bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-brand-primary placeholder:text-[var(--brand-text-primary)]/20"
                            autoComplete="off"
                        />
                    </div>

                    <BottomSheetFooter>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || !isFormValid}
                            className="w-full h-12 font-semibold tracking-wide touch-manipulation"
                            style={{
                              background: 'rgba(var(--brand-primary-rgb),0.15)',
                              border: '1px solid rgba(var(--brand-primary-rgb),0.4)',
                              borderRadius: 'var(--brand-radius)',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                              color: 'var(--brand-primary)',
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
