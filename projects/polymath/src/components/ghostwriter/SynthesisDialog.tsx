import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Sparkles, FileText, AlignLeft, List, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SynthesisDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSynthesize: (format: 'brief' | 'blog' | 'outline') => void
    contextCount: number
}

export function SynthesisDialog({ open, onOpenChange, onSynthesize, contextCount }: SynthesisDialogProps) {
    const [selectedFormat, setSelectedFormat] = useState<'brief' | 'blog' | 'outline'>('brief')

    const formats = [
        {
            id: 'brief',
            label: 'Project Brief',
            description: 'Consolidate thoughts into a structured overview',
            icon: FileText
        },
        {
            id: 'blog',
            label: 'Blog Post',
            description: 'Draft a public post sharing your learnings',
            icon: AlignLeft
        },
        {
            id: 'outline',
            label: 'Action Plan',
            description: 'Break down the project into actionable steps',
            icon: List
        }
    ] as const

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md premium-card border-0">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                        <span className="premium-text-platinum">Ghostwriter</span>
                    </DialogTitle>
                    <p className="text-sm text-slate-400">
                        Synthesize {contextCount} connected items into a new draft.
                    </p>
                </DialogHeader>

                <div className="grid gap-3 py-4">
                    {formats.map((format) => {
                        const Icon = format.icon
                        const isSelected = selectedFormat === format.id

                        return (
                            <button
                                key={format.id}
                                onClick={() => setSelectedFormat(format.id)}
                                className={cn(
                                    "flex items-start gap-4 p-4 rounded-xl transition-all text-left border",
                                    isSelected
                                        ? "bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    isSelected ? "bg-purple-500/20 text-purple-300" : "bg-white/5 text-slate-400"
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className={cn(
                                            "font-medium mb-1",
                                            isSelected ? "text-purple-100" : "text-slate-300"
                                        )}>
                                            {format.label}
                                        </h3>
                                        {isSelected && <Check className="h-4 w-4 text-purple-400" />}
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {format.description}
                                    </p>
                                </div>
                            </button>
                        )
                    })}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onSynthesize(selectedFormat)}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0"
                    >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Draft
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
