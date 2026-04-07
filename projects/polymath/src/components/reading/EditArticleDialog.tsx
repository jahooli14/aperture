import { useState, useEffect } from 'react'
import { Edit } from 'lucide-react'
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
import { Textarea } from '../ui/textarea'
import { useToast } from '../ui/toast'
import { useReadingStore } from '../../stores/useReadingStore'
import { handleInputFocus } from '../../utils/keyboard'
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
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <div className="flex items-center gap-3 mb-2">
            <Edit className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
            <BottomSheetTitle>Edit article</BottomSheetTitle>
          </div>
          <BottomSheetDescription>
            Update article details and add your notes
          </BottomSheetDescription>
        </BottomSheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="font-bold text-xs uppercase tracking-widest text-brand-primary">Title <span className="text-brand-text-secondary">*</span></Label>
            <Input
              id="title"
              placeholder="Article title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              onFocus={handleInputFocus}
              required
              className="text-xl h-14 font-bold bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-blue-400 focus:ring-0"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt" className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">Excerpt</Label>
            <Textarea
              id="excerpt"
              placeholder="Brief summary or key points..."
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              onFocus={handleInputFocus}
              rows={3}
              className="bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-blue-400 placeholder:text-[var(--brand-text-primary)]/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags" className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">Tags</Label>
            <Input
              id="tags"
              placeholder="technology, ai, programming"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              onFocus={handleInputFocus}
              className="h-14 bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-blue-400 placeholder:text-[var(--brand-text-primary)]/20"
              autoComplete="off"
            />
            <p className="text-[10px] text-[var(--brand-text-muted)]">Comma-separated tags</p>
          </div>

          <div className="space-y-2 pb-4">
            <Label htmlFor="notes" className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">Personal Notes</Label>
            <Textarea
              id="notes"
              placeholder="Your thoughts, highlights, and reflections..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              onFocus={handleInputFocus}
              rows={4}
              className="bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-blue-400 placeholder:text-[var(--brand-text-primary)]/20"
            />
            <p className="text-[10px] text-[var(--brand-text-muted)]">Add your personal insights and highlights</p>
          </div>

          <BottomSheetFooter>
            <Button
              type="submit"
              disabled={loading || !formData.title}
              className="w-full h-14 font-black uppercase tracking-widest touch-manipulation"
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.5)',
                borderRadius: '4px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                color: 'var(--brand-primary)',
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </BottomSheetFooter>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}
