import { useState, useEffect } from 'react'
import { Edit } from 'lucide-react'
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
import { Textarea } from '../ui/textarea'
import { useToast } from '../ui/toast'
import { useReadingStore } from '../../stores/useReadingStore'
import type { Article } from '../../types/reading'

interface EditArticleDialogProps {
  article: Article
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditArticleDialog({ article, open, onOpenChange }: EditArticleDialogProps) {
  const [loading, setLoading] = useState(false)
  const { updateArticle } = useReadingStore()
  const { addToast } = useToast()

  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    tags: '',
    notes: '',
  })

  useEffect(() => {
    if (open && article) {
      setFormData({
        title: article.title || '',
        excerpt: article.excerpt || '',
        tags: article.tags?.join(', ') || '',
        notes: article.notes || '',
      })
    }
  }, [open, article])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await updateArticle(article.id, {
        title: formData.title,
        excerpt: formData.excerpt || undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: formData.notes || undefined,
      })

      addToast({
        title: 'Article updated!',
        description: `Changes saved successfully.`,
        variant: 'success',
      })

      onOpenChange(false)
    } catch (error) {
      addToast({
        title: 'Failed to update article',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[85vh] sm:max-h-[80vh] p-0 flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-2xl">Edit article</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Update article details and add your notes
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-sm sm:text-base">Title *</Label>
              <Input
                id="title"
                placeholder="Article title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="text-base h-11 sm:h-12"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="excerpt" className="text-sm sm:text-base">Excerpt</Label>
              <Textarea
                id="excerpt"
                placeholder="Brief summary or key points..."
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
                rows={3}
                className="text-base"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags" className="text-sm sm:text-base">Tags</Label>
              <Input
                id="tags"
                placeholder="technology, ai, programming"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                className="text-base h-11 sm:h-12"
              />
              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                Comma-separated tags to categorize this article
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes" className="text-sm sm:text-base">Personal Notes</Label>
              <Textarea
                id="notes"
                placeholder="Your thoughts, highlights, and reflections..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={4}
                className="text-base"
              />
              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                Add your personal insights and highlights from the article
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 border-t premium-glass-subtle">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto h-11 sm:h-12"
              style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--premium-text-secondary)' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.title}
              className="w-full sm:w-auto h-11 sm:h-12"
              style={{
                backgroundColor: 'var(--premium-blue)',
                color: 'white',
                opacity: loading || !formData.title ? 0.5 : 1
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
