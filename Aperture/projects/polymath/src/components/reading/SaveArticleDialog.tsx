/**
 * Save Article Dialog
 * Mobile-optimized bottom sheet for saving URLs to reading queue
 */

import { useState, useEffect, useRef } from 'react'
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
  const [extracting, setExtracting] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const articleIdRef = useRef<string | null>(null)
  const { saveArticle, articles } = useReadingStore()
  const { fetchSuggestions } = useConnectionStore()
  const { addToast } = useToast()

  const resetForm = () => {
    setUrl('')
    setElapsedTime(0)
    setExtracting(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
    articleIdRef.current = null
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Poll for article processing completion
  useEffect(() => {
    if (!extracting || !articleIdRef.current) return

    const checkArticleProcessed = () => {
      const article = articles.find(a => a.id === articleIdRef.current)

      if (article?.processed) {
        // Processing complete!
        console.log('[SaveArticleDialog] Article extraction complete')

        if (timerRef.current) clearInterval(timerRef.current)
        if (pollRef.current) clearInterval(pollRef.current)

        addToast({
          title: 'Article extracted!',
          description: 'Content processed successfully',
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
      }
    }

    // Poll every 1 second
    pollRef.current = setInterval(checkArticleProcessed, 1000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [extracting, articles, addToast, fetchSuggestions, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) return

    setLoading(true)
    setElapsedTime(0)

    try {
      console.log('[SaveArticleDialog] Saving article:', url.trim())
      const article = await saveArticle({ url: url.trim() })

      console.log('[SaveArticleDialog] Article saved, starting extraction monitoring')
      articleIdRef.current = article.id

      // If already processed (unlikely but possible), close immediately
      if (article.processed) {
        addToast({
          title: 'Article saved!',
          description: 'Content extracted successfully',
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
        return
      }

      // Start extraction monitoring
      setLoading(false)
      setExtracting(true)

      // Start countdown timer (max 30 seconds)
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const next = prev + 1
          if (next >= 30) {
            // Timeout - stop polling
            if (timerRef.current) clearInterval(timerRef.current)
            if (pollRef.current) clearInterval(pollRef.current)

            addToast({
              title: 'Extraction taking longer than expected',
              description: 'Check back in a moment',
              variant: 'default',
            })

            resetForm()
            onClose()
            return 30
          }
          return next
        })
      }, 1000)

    } catch (error) {
      console.error('[SaveArticleDialog] Failed to save article:', error)
      addToast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
      resetForm()
    } finally {
      if (!extracting) {
        setLoading(false)
      }
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
              disabled={loading || extracting || !url.trim()}
              className="btn-primary w-full h-12 touch-manipulation"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Saving...
                </>
              ) : extracting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Extracting... {elapsedTime}s / 30s
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
              disabled={loading || extracting}
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
