/**
 * Reader View Page - Premium Reading Experience
 * Inspired by Readwise Reader and Omnivore
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ExternalLink,
  Archive,
  Loader2,
  Highlighter,
  MessageSquare,
  BookmarkPlus,
  Clock,
  Type,
  Check,
  Download,
  WifiOff,
} from 'lucide-react'
import { format } from 'date-fns'
import DOMPurify from 'dompurify'
import type { Article, ArticleHighlight } from '../types/reading'
import { useReadingStore } from '../stores/useReadingStore'
import { useToast } from '../components/ui/toast'
import { useOfflineArticle } from '../hooks/useOfflineArticle'
import { useReadingProgress } from '../hooks/useReadingProgress'
import { ArticleCompletionDialog } from '../components/reading/ArticleCompletionDialog'

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateArticleStatus } = useReadingStore()
  const { addToast } = useToast()
  const { caching, downloadForOffline, isCached, getCachedImages } = useOfflineArticle()
  const { progress, restoreProgress } = useReadingProgress(id || '')

  const [article, setArticle] = useState<Article | null>(null)
  const [highlights, setHighlights] = useState<ArticleHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedText, setSelectedText] = useState('')
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [fontSize, setFontSize] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable')
  const [isOfflineCached, setIsOfflineCached] = useState(false)
  const [cachedImageUrls, setCachedImageUrls] = useState<Map<string, string>>(new Map())
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchArticle()
    checkOfflineStatus()
  }, [id])

  const fetchArticle = async () => {
    if (!id) return

    setLoading(true)
    try {
      const response = await fetch(`/api/reading?id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch article')

      const { article, highlights } = await response.json()
      setArticle(article)
      setHighlights(highlights || [])

      // Restore reading progress
      setTimeout(() => restoreProgress(), 100)
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to load article',
        variant: 'destructive',
      })
      navigate('/reading')
    } finally {
      setLoading(false)
    }
  }

  const checkOfflineStatus = async () => {
    if (!id) return
    const cached = await isCached(id)
    setIsOfflineCached(cached)

    if (cached) {
      const images = await getCachedImages(id)
      setCachedImageUrls(images)
    }
  }

  const handleDownloadOffline = async () => {
    if (!article) return

    try {
      await downloadForOffline(article)
      setIsOfflineCached(true)

      addToast({
        title: 'Saved for offline!',
        description: 'Article and images are now available offline',
        variant: 'success',
      })

      const images = await getCachedImages(article.id)
      setCachedImageUrls(images)
    } catch (error) {
      addToast({
        title: 'Download failed',
        description: 'Failed to cache article for offline reading',
        variant: 'destructive',
      })
    }
  }

  // Replace image URLs with cached blob URLs and sanitize
  const getContentWithCachedImages = (content: string): string => {
    let processedContent = content

    // Replace cached images
    if (cachedImageUrls.size > 0) {
      cachedImageUrls.forEach((blobUrl, originalUrl) => {
        processedContent = processedContent.replace(
          new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          blobUrl
        )
      })
    }

    // Sanitize HTML for security
    return DOMPurify.sanitize(processedContent, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
        'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
        'div', 'span'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
      ALLOW_DATA_ATTR: false
    })
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (text && text.length > 0) {
      setSelectedText(text)

      const range = selection?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()

      if (rect) {
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        })
        setShowHighlightMenu(true)
      }
    } else {
      setShowHighlightMenu(false)
    }
  }

  const handleHighlight = async (color: string = 'yellow') => {
    if (!selectedText || !article) return

    try {
      const response = await fetch('/api/reading?resource=highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          highlight_text: selectedText,
          color,
        }),
      })

      if (!response.ok) throw new Error('Failed to create highlight')

      const { highlight } = await response.json()
      setHighlights([...highlights, highlight])

      addToast({
        title: 'Highlighted!',
        description: 'Text saved to highlights',
        variant: 'success',
      })

      setShowHighlightMenu(false)
      window.getSelection()?.removeAllRanges()
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to save highlight',
        variant: 'destructive',
      })
    }
  }

  const handleSaveAsMemory = async () => {
    if (!selectedText) return

    try {
      await handleHighlight('blue')

      const response = await fetch('/api/memories?capture=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: `From article "${article?.title}": ${selectedText}`,
        }),
      })

      if (!response.ok) throw new Error('Failed to create memory')

      addToast({
        title: 'Saved to memories!',
        description: 'Highlight converted to memory',
        variant: 'success',
      })

      setShowHighlightMenu(false)
      window.getSelection()?.removeAllRanges()
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to save as memory',
        variant: 'destructive',
      })
    }
  }

  const handleArchive = async () => {
    if (!article) return
    setShowCompletionDialog(true)
  }

  const handleCaptureThought = async (data: { text?: string; audio?: Blob }) => {
    if (!article) return

    try {
      const source_reference = {
        type: 'article' as const,
        id: article.id,
        title: article.title || undefined,
        url: article.url
      }

      if (data.text) {
        const response = await fetch('/api/memories?action=capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: data.text,
            source_reference
          })
        })

        if (!response.ok) {
          throw new Error('Failed to create thought')
        }

        addToast({
          title: 'Thought captured!',
          description: 'Linked to this article',
          variant: 'success',
        })
      }

      await handleArchiveComplete()
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to capture thought',
        variant: 'destructive',
      })
      throw error
    }
  }

  const handleSkipThought = async () => {
    await handleArchiveComplete()
  }

  const handleArchiveComplete = async () => {
    if (!article) return

    try {
      await updateArticleStatus(article.id, 'archived')
      addToast({
        title: 'Archived',
        description: 'Article moved to archive',
        variant: 'success',
      })
      navigate('/reading')
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to archive',
        variant: 'destructive',
      })
    }
  }

  const fontSizeSettings = {
    compact: {
      article: 'text-[17px] leading-[1.6]',
      title: 'text-3xl sm:text-4xl',
      meta: 'text-sm'
    },
    comfortable: {
      article: 'text-[19px] leading-[1.7]',
      title: 'text-4xl sm:text-5xl',
      meta: 'text-sm'
    },
    spacious: {
      article: 'text-[21px] leading-[1.8]',
      title: 'text-5xl sm:text-6xl',
      meta: 'text-base'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--premium-blue)' }} />
      </div>
    )
  }

  if (!article) {
    return null
  }

  const settings = fontSizeSettings[fontSize]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
      {/* Sticky Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 premium-glass-strong border-b"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        {/* Progress Bar */}
        <div className="h-0.5" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
          <motion.div
            className="h-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--premium-emerald), var(--premium-blue))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Toolbar */}
        <div className="max-w-[800px] mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/reading')}
            className="p-2 rounded-lg hover:bg-white/5 transition-all"
            style={{ color: 'var(--premium-text-primary)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            {/* Offline Download */}
            <button
              onClick={handleDownloadOffline}
              disabled={caching || isOfflineCached}
              className="p-2 rounded-lg hover:bg-white/5 transition-all disabled:opacity-50"
              style={{
                color: isOfflineCached ? 'var(--premium-emerald)' : 'var(--premium-text-secondary)'
              }}
              title={isOfflineCached ? 'Available offline' : 'Download for offline'}
            >
              {caching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isOfflineCached ? (
                <WifiOff className="h-5 w-5" />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </button>

            {/* Font Size Selector */}
            <div className="flex items-center gap-1 premium-glass-subtle rounded-lg p-1">
              {(['compact', 'comfortable', 'spacious'] as const).map((size, index) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={`p-1.5 rounded transition-all ${
                    fontSize === size ? 'bg-white/10' : 'opacity-50 hover:opacity-100'
                  }`}
                  title={`${size.charAt(0).toUpperCase() + size.slice(1)} text`}
                  style={{ color: 'var(--premium-text-primary)' }}
                >
                  <Type className={`${index === 0 ? 'h-3.5 w-3.5' : index === 1 ? 'h-4 w-4' : 'h-4.5 w-4.5'}`} />
                </button>
              ))}
            </div>

            {/* Archive Button */}
            <button
              onClick={handleArchive}
              className="p-2 rounded-lg hover:bg-white/5 transition-all"
              style={{ color: 'var(--premium-text-secondary)' }}
              title="Finish & Archive"
            >
              <Check className="h-5 w-5" />
            </button>

            {/* Open Original */}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-white/5 transition-all"
              style={{ color: 'var(--premium-text-secondary)' }}
              title="Open original"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
        </div>
      </motion.header>

      {/* Article Content */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="max-w-[720px] mx-auto px-6 sm:px-8 md:px-12 py-12 sm:py-16 md:py-20"
      >
        {/* Article Header */}
        <header className="mb-12">
          {/* Title */}
          <h1
            className={`font-serif font-bold mb-6 ${settings.title}`}
            style={{
              color: 'var(--premium-text-platinum)',
              lineHeight: '1.2',
              letterSpacing: '-0.02em'
            }}
          >
            {article.title}
          </h1>

          {/* Metadata */}
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${settings.meta}`}
            style={{ color: 'var(--premium-text-tertiary)' }}
          >
            {article.author && (
              <span className="font-medium" style={{ color: 'var(--premium-text-secondary)' }}>
                {article.author}
              </span>
            )}
            {article.source && (
              <span>{article.source}</span>
            )}
            {article.published_date && (
              <span>
                {(() => {
                  try {
                    const date = new Date(article.published_date)
                    if (isNaN(date.getTime())) return null
                    return format(date, 'MMMM d, yyyy')
                  } catch {
                    return null
                  }
                })()}
              </span>
            )}
            {article.read_time_minutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {article.read_time_minutes} min
              </span>
            )}
          </div>
        </header>

        {/* Article Body */}
        <div
          className={`reader-content ${settings.article}`}
          onMouseUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
          dangerouslySetInnerHTML={{
            __html: article.content ? getContentWithCachedImages(article.content) : ''
          }}
          style={{
            color: 'var(--premium-text-primary)',
            fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
          }}
        />

        {/* Highlights Section */}
        {highlights.length > 0 && (
          <div className="mt-20 pt-12 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <h2 className="text-2xl font-bold mb-8" style={{ color: 'var(--premium-text-platinum)' }}>
              Your Highlights
            </h2>
            <div className="space-y-4">
              {highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className="p-5 rounded-xl border-l-4 premium-glass-subtle"
                  style={{
                    borderLeftColor: highlight.color === 'yellow'
                      ? 'var(--premium-gold)'
                      : highlight.color === 'blue'
                      ? 'var(--premium-blue)'
                      : highlight.color === 'green'
                      ? 'var(--premium-emerald)'
                      : 'var(--premium-red)'
                  }}
                >
                  <p className="text-base italic mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                    "{highlight.highlight_text}"
                  </p>
                  {highlight.notes && (
                    <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                      {highlight.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.article>

      {/* Highlight Menu */}
      <AnimatePresence>
        {showHighlightMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 premium-glass-strong rounded-xl shadow-2xl border p-2 flex gap-1"
            style={{
              left: `${menuPosition.x}px`,
              top: `${menuPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
            }}
          >
            <button
              onClick={() => handleHighlight('yellow')}
              className="p-2.5 hover:bg-white/10 rounded-lg transition-all"
              title="Highlight"
            >
              <Highlighter className="h-5 w-5" style={{ color: 'var(--premium-gold)' }} />
            </button>
            <button
              onClick={handleSaveAsMemory}
              className="p-2.5 hover:bg-white/10 rounded-lg transition-all"
              title="Save as memory"
            >
              <BookmarkPlus className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
            </button>
            <button
              onClick={() => {
                setShowHighlightMenu(false)
              }}
              className="p-2.5 hover:bg-white/10 rounded-lg transition-all"
              title="Add note"
            >
              <MessageSquare className="h-5 w-5" style={{ color: 'var(--premium-text-secondary)' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Dialog */}
      <ArticleCompletionDialog
        article={article}
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        onCapture={handleCaptureThought}
        onSkip={handleSkipThought}
      />

      {/* Bottom Safe Area */}
      <div className="h-24" />
    </div>
  )
}
