import { useState, useEffect, useRef } from 'react'
import { BookmarkPlus, Loader2 } from 'lucide-react'
import { useReadingStore } from '../../stores/useReadingStore'
import { useToast } from '../ui/toast'
import {
    BottomSheet,
    BottomSheetContent,
    BottomSheetHeader,
    BottomSheetTitle,
    BottomSheetDescription,
    BottomSheetFooter,
} from '../ui/bottom-sheet'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

interface SaveArticleDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function SaveArticleDialog({ isOpen, onOpenChange }: SaveArticleDialogProps) {
    const { saveArticle, fetchArticles } = useReadingStore()
    const { addToast } = useToast()
    const [url, setUrl] = useState('')
    const [saving, setSaving] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setUrl('')
            setSaving(false)
            // Try to read clipboard for a URL
            navigator.clipboard?.readText?.().then(text => {
                if (text && /^https?:\/\/.+/.test(text.trim())) {
                    setUrl(text.trim())
                }
            }).catch(() => {})
            // Focus input after sheet animation
            setTimeout(() => inputRef.current?.focus(), 300)
        }
    }, [isOpen])

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        const trimmed = url.trim()
        if (!trimmed) return

        // Basic URL validation
        try {
            new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
        } catch {
            addToast({ title: 'Invalid URL', description: 'Please enter a valid link.', variant: 'destructive' })
            return
        }

        const finalUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
        setSaving(true)
        try {
            await saveArticle({ url: finalUrl })
            await fetchArticles(undefined, true)
            addToast({ title: 'Saved!', description: 'Article added to your reading queue.', variant: 'success' })
            onOpenChange(false)
        } catch {
            addToast({ title: 'Failed to save', description: 'Could not extract article. Try again.', variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <BottomSheet open={isOpen} onOpenChange={onOpenChange}>
            <BottomSheetContent>
                <BottomSheetHeader>
                    <BottomSheetTitle className="flex items-center gap-2">
                        <BookmarkPlus className="h-5 w-5 text-brand-primary" />
                        Save Short Read
                    </BottomSheetTitle>
                    <BottomSheetDescription>
                        Paste a link to save it to your reading queue.
                    </BottomSheetDescription>
                </BottomSheetHeader>

                <form onSubmit={handleSubmit} className="px-4 py-3">
                    <Input
                        ref={inputRef}
                        type="url"
                        placeholder="https://example.com/article"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        disabled={saving}
                        className="text-base"
                        autoComplete="off"
                    />
                </form>

                <BottomSheetFooter>
                    <Button
                        onClick={() => handleSubmit()}
                        disabled={!url.trim() || saving}
                        className="w-full"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Article'
                        )}
                    </Button>
                </BottomSheetFooter>
            </BottomSheetContent>
        </BottomSheet>
    )
}
