/**
 * Save Article Dialog
 * Mobile-optimized bottom sheet for saving URLs to reading queue
 * Streamlined — paste URL, hit save, done
 */

import { useState } from 'react'
import { BookmarkPlus, Link as LinkIcon } from 'lucide-react'
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
import { useToast } from '../ui/toast'
import { useReadingStore } from '../../stores/useReadingStore'
import { useConnectionStore } from '../../stores/useConnectionStore'
import { articleProcessor } from '../../lib/articleProcessor'

interface SaveArticleDialogProps {
  open: boolean
  onClose: () => void
  hideTrigger?: boolean
}

export function SaveArticleDialog({ open, onClose, hideTrigger = false }: SaveArticleDialogProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
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
      const article = await saveArticle({ url: url.trim() })

      addToast({
        title: 'Article saved!',
        description: 'Added to your queue',
        variant: 'success',
      })

      resetForm()
      onClose()

      // Background processing
      if (!article.id.startsWith('temp-')) {
        articleProcessor.startProcessing(article.id, url.trim(), async (status, updatedArticle) => {
          const { fetchArticles } = useReadingStore.getState()

          if (status === 'complete') {
            addToast({
              title: 'Article ready!',
              description: updatedArticle?.title || 'Content extracted successfully',
              variant: 'success',
            })

            await fetchArticles(undefined, true)

            if (updatedArticle && (updatedArticle.content || updatedArticle.excerpt)) {
              fetchSuggestions(
                'article',
                updatedArticle.id,
                updatedArticle.content || updatedArticle.excerpt || '',
                updatedArticle.title || undefined
              )
            }
          } else if (status === 'failed') {
            await fetchArticles(undefined, true)
          }
        })
      }

    } catch (error) {
      addToast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
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

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* URL Input — big and clear */}
          <div className="pt-2">
            <div
              className="flex items-center gap-3 rounded-xl px-4 transition-all duration-200"
              style={{
                backgroundColor: inputFocused ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                boxShadow: inputFocused
                  ? 'inset 0 0 0 1.5px rgba(99,179,237,0.5), 0 4px 20px rgba(0,0,0,0.2)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
              }}
            >
              <LinkIcon className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--premium-blue)' }} />
              <input
                id="url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={(e) => { setInputFocused(true); handleInputFocus(e) }}
                onBlur={() => setInputFocused(false)}
                required
                autoFocus
                autoComplete="off"
                className="flex-1 h-14 border-0 text-[15px] focus:outline-none focus:ring-0 placeholder:text-white/20 appearance-none"
                style={{ color: 'var(--premium-text-primary)', backgroundColor: 'transparent' }}
              />
            </div>
            <p className="text-xs mt-2 px-1" style={{ color: 'var(--premium-text-tertiary)' }}>
              AI will extract the content and find connections
            </p>
          </div>

          <BottomSheetFooter>
            <Button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-widest touch-manipulation"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-black border-r-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Article'
              )}
            </Button>
          </BottomSheetFooter>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}
