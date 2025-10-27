/**
 * Save Article Dialog
 * Quick dialog to save URLs to reading queue
 */

import { useState } from 'react'
import { Loader2, Link as LinkIcon } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { useToast } from '../ui/toast'
import { useReadingStore } from '../../stores/useReadingStore'

interface SaveArticleDialogProps {
  open: boolean
  onClose: () => void
}

export function SaveArticleDialog({ open, onClose }: SaveArticleDialogProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { saveArticle } = useReadingStore()
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) return

    setLoading(true)

    try {
      console.log('[SaveArticleDialog] Saving article:', url.trim())
      await saveArticle({ url: url.trim() })

      console.log('[SaveArticleDialog] Article saved successfully')
      addToast({
        title: 'Article saved!',
        description: 'Added to your reading queue',
        variant: 'success',
      })

      setUrl('')
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-blue-900" />
              Save Article
            </DialogTitle>
            <DialogDescription>
              Paste a URL to save it to your reading queue
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="grid gap-2">
              <Label htmlFor="url">Article URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                autoFocus
                className="h-12"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !url.trim()}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Article'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
