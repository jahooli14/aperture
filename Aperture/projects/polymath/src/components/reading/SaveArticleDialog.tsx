/**
 * Save Article Dialog
 * Mobile-optimized bottom sheet for saving URLs to reading queue
 */

import { useState } from 'react'
import { BookmarkPlus, Link as LinkIcon } from 'lucide-react'
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
import { useReadingStore } from '../../stores/useReadingStore'
import { useConnectionStore } from '../../stores/useConnectionStore'

interface SaveArticleDialogProps {
  open: boolean
  onClose: () => void
}

export function SaveArticleDialog({ open, onClose }: SaveArticleDialogProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { saveArticle } = useReadingStore()
  const { fetchSuggestions } = useConnectionStore()
  const { addToast } = useToast()

  const resetForm = () => {
    setUrl('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) return

    setLoading(true)

    try {
      console.log('[SaveArticleDialog] Saving article:', url.trim())
      const article = await saveArticle({ url: url.trim() })

      console.log('[SaveArticleDialog] Article saved successfully')
      addToast({
        title: 'Article saved!',
        description: 'Looking for connections...',
        variant: 'success',
      })

      // Trigger connection detection
      if (article.content || article.excerpt) {
        fetchSuggestions(
          'article',
          article.id,
          article.content || article.excerpt || '',
          article.title || undefined
        )
      }

      resetForm()
      onClose()
    } catch (error) {
      console.error('[SaveArticleDialog] Failed to save article:', error)
      addToast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <div className="flex items-center gap-3 mb-2">
            <BookmarkPlus className="h-6 w-6" style={{ color: 'var(--premium-emerald)' }} />
            <BottomSheetTitle>Save Article</BottomSheetTitle>
          </div>
          <BottomSheetDescription>
            Paste a URL to save it to your reading queue
          </BottomSheetDescription>
        </BottomSheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* URL Input */}
          <div className="space-y-2 pb-4">
            <Label htmlFor="url" className="font-semibold text-sm sm:text-base" style={{ color: 'var(--premium-text-primary)' }}>
              Article URL <span style={{ color: 'var(--premium-red)' }}>*</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              autoFocus
              className="text-base h-11 sm:h-12"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-primary)'
              }}
              autoComplete="off"
            />
            <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              AI will extract the content and find connections
            </p>
          </div>

          <BottomSheetFooter>
            <Button
              type="submit"
              disabled={loading || !url.trim()}
              className="btn-primary w-full h-12 touch-manipulation"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  Save Article
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm()
                onClose()
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
  )
}
