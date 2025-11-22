import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { FileText, Copy, Check, Save, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useToast } from '../ui/toast'

interface DraftViewerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    draft: string
    onSave: () => void
    isSaving?: boolean
}

export function DraftViewer({ open, onOpenChange, draft, onSave, isSaving }: DraftViewerProps) {
    const { addToast } = useToast()
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(draft)
            setCopied(true)
            addToast({
                title: 'Copied to clipboard',
                variant: 'success'
            })
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col premium-card border-0 p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 bg-black/20 backdrop-blur-xl border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-xl premium-text-platinum">
                            <FileText className="h-5 w-5 text-purple-400" />
                            Generated Draft
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="text-slate-400 hover:text-white"
                            >
                                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="prose prose-invert prose-purple max-w-none">
                        <ReactMarkdown>{draft}</ReactMarkdown>
                    </div>
                </div>

                <DialogFooter className="p-4 bg-black/20 backdrop-blur-xl border-t border-white/5 gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">
                        Discard
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={isSaving}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0"
                    >
                        {isSaving ? (
                            <span className="animate-pulse">Saving...</span>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save as Note
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
