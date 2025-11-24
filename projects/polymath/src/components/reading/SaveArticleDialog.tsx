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
import { articleProcessor } from '../../lib/articleProcessor'

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

      // Optimistic save - returns immediately with temp article
      const article = await saveArticle({ url: url.trim() })

      console.log('[SaveArticleDialog] Article saved (optimistic), starting robust processing')

      // Show success immediately and close dialog
      addToast({
        title: 'Article saved!',
        description: 'Added to your queue',
        variant: 'success',
      })

      resetForm()
      onClose()

      // Use ArticleProcessor for robust background polling with retry
      // Note: If offline, this will just queue up or fail gracefully
      if (!article.id.startsWith('temp-')) {
        articleProcessor.startProcessing(article.id, url.trim(), async (status, updatedArticle) => {
          const { fetchArticles } = useReadingStore.getState()

          if (status === 'complete') {
            console.log('[SaveArticleDialog] Extraction complete')

            addToast({
              title: 'Article ready!',
              description: updatedArticle?.title || 'Content extracted successfully',
              variant: 'success',
            })

            // Refresh articles list
            await fetchArticles(undefined, true)

            // Trigger connection detection
            if (updatedArticle && (updatedArticle.content || updatedArticle.excerpt)) {
              fetchSuggestions(
                'article',
                updatedArticle.id,
                updatedArticle.content || updatedArticle.excerpt || '',
                updatedArticle.title || undefined
              )
            }
          } else if (status === 'retrying') {
            // Quietly retry in background
            console.log('[SaveArticleDialog] Retrying extraction...')
          } else if (status === 'failed') {
            // Don't show error toast for background processing failures unless critical
            console.log('[SaveArticleDialog] Extraction failed')
            await fetchArticles(undefined, true)
          }
        })
      }

    } catch (error) {
      console.error('[SaveArticleDialog] Failed to save article:', error)
      addToast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
      // Close dialog even on error so user isn't stuck
      resetForm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <div className="flex items-center gap-3 mb-2">
            <BookmarkPlus className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
            <BottomSheetTitle>Save article</BottomSheetTitle>
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
