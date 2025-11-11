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
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'

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
  const [suggestions, setSuggestions] = useState<any[]>([])

  useEffect(() => {
    if (!id) return
    fetchArticle()
    checkOfflineStatus()
    fetchSuggestions()
  }, [id])

  const fetchSuggestions = async () => {
    if (!id) return

    try {
      const response = await fetch(`/api/connections?action=suggestions&id=${id}&type=article`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('[ReaderPage] Failed to fetch suggestions:', error)
    }
  }

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

    // Create a temporary DOM to clean content
    const parser = new DOMParser()
    const doc = parser.parseFromString(processedContent, 'text/html')

    // Clean metadata from first paragraph if it matches common patterns
    const firstParagraph = doc.querySelector('p')
    if (firstParagraph) {
      const firstParaText = firstParagraph.textContent || ''
      const hasMetadataPattern =
        /^#\d+\s*\([^)]*\)/.test(firstParaText) || // "#7246 (no title)"
        /^[A-Za-z]+\s+\d{1,2},\s+\d{4}\s+By\s+/.test(firstParaText) || // "October 24, 2025 By Author"
        /Tales from [A-Z]/.test(firstParaText) // "Tales from Toddlerhood"

      if (hasMetadataPattern) {
        // Clean the text by removing metadata patterns
        let cleanedText = firstParaText
          .replace(/^#\d+\s*\([^)]*\)\s*/i, '')
          .replace(/^Tales from [^A-Z]+/i, '')
          .replace(/^[A-Za-z]+\s+\d{1,2},\s+\d{4}\s+/i, '')
          .replace(/^By\s+[^\s]+\s+/i, '')
          .trim()

        if (cleanedText.length > 0) {
          firstParagraph.textContent = cleanedText
        } else {
          firstParagraph.remove()
        }
      }
    }

    // Remove ads and navigation elements
    const selectorsToRemove = [
      // Navigation
      'nav', '[role="navigation"]', '.navigation', '.nav', '.navbar', '.menu',
      // Ads and promotional content
      '[class*="ad-"]', '[class*="ads"]', '[id*="ad-"]', '[id*="ads"]',
      '.advertisement', '.sponsored', '.promo', '.promotion',
      // Social sharing buttons
      '[class*="share"]', '[class*="social"]', '.whatsapp-share', '.facebook-share',
      // App download prompts
      '[class*="download"]', '[class*="app-banner"]', '.install-app',
      // Footers and headers (often contain navigation)
      'header:not(article header)', 'footer',
      // Cookie banners and popups
      '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]',
      // Comments sections
      '[class*="comment"]', '[id*="comment"]',
      // Related articles (often promotional)
      '[class*="related"]', '[class*="recommended"]', '.sidebar',
      // Newsletter signup
      '[class*="newsletter"]', '[class*="subscribe"]',
      // Author bio boxes (often have links)
      '.author-bio', '[class*="author-box"]'
    ]

    selectorsToRemove.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove())
    })

    // Remove all inline styles (including color formatting)
    doc.querySelectorAll('[style]').forEach(el => {
      el.removeAttribute('style')
    })

    // Remove color/style classes
    doc.querySelectorAll('[class]').forEach(el => {
      el.removeAttribute('class')
    })

    // Remove data attributes from all elements
    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          el.removeAttribute(attr.name)
        }
      })
    })

    processedContent = doc.body.innerHTML

    // Sanitize HTML for security
    return DOMPurify.sanitize(processedContent, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
        'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
        'div', 'span'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
      ALLOW_DATA_ATTR: false,
      // Ensure no style attributes survive
      FORBID_ATTR: ['style', 'class', 'id']
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
        title: 'Saved to thoughts!',
        description: 'Highlight converted to thought',
        variant: 'success',
      })

      setShowHighlightMenu(false)
      window.getSelection()?.removeAllRanges()
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to save as thought',
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
        const response = await fetch('/api/memories?capture=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: data.text,
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
      article: 'text-[17px] leading-[1.65]',
      title: 'text-3xl sm:text-4xl',
      meta: 'text-sm'
    },
    comfortable: {
      article: 'text-[19px] leading-[1.75]',
      title: 'text-4xl sm:text-5xl',
      meta: 'text-sm'
    },
    spacious: {
      article: 'text-[21px] leading-[1.85]',
      title: 'text-5xl sm:text-6xl',
      meta: 'text-base'
    }
  }

  // Keyboard shortcuts for better UX
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Archive with 'a' key
      if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          handleArchive()
        }
      }
      // Back with Escape key
      if (e.key === 'Escape') {
        e.preventDefault()
        navigate('/reading')
      }
      // Font size shortcuts
      if (e.key === '1' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setFontSize('compact')
      }
      if (e.key === '2' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setFontSize('comfortable')
      }
      if (e.key === '3' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setFontSize('spacious')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [article])

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
    <div className="min-h-screen" style={{ backgroundColor: '#1a1f2e' }}>
      {/* Sticky Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 premium-glass-strong"
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
              <Archive className="h-5 w-5" />
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
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-[680px] mx-auto px-6 sm:px-8 md:px-12 py-12 sm:py-16 md:py-20"
        style={{
          backgroundColor: '#fefdfb',
          minHeight: '100vh',
          boxShadow: '0 0 80px rgba(0, 0, 0, 0.25), 0 20px 40px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Article Header */}
        <header className="mb-12">
          {/* Title */}
          <h1
            className={`font-serif font-bold mb-8 ${settings.title}`}
            style={{
              color: '#0a0a0a',
              lineHeight: '1.15',
              letterSpacing: '-0.025em',
              fontFamily: '"Charter", "Iowan Old Style", "Palatino Linotype", "URW Palladio L", Georgia, serif',
              fontWeight: 700
            }}
          >
            {article.title}
          </h1>

          {/* Metadata */}
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${settings.meta}`}
            style={{
              color: '#737373',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}
          >
            {article.author && (
              <span className="font-medium" style={{ color: '#404040' }}>
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
            color: '#1a1a1a',
            fontFamily: '"Charter", "Iowan Old Style", "Palatino Linotype", "URW Palladio L", Georgia, "Times New Roman", serif',
            fontFeatureSettings: '"liga" 1, "kern" 1',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}
        />

        {/* Highlights Section */}
        {highlights.length > 0 && (
          <div className="mt-20 pt-12">
            <h2 className="text-2xl font-bold mb-8" style={{ color: '#1a1a1a' }}>
              Your highlights
            </h2>
            <div className="space-y-4">
              {highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className="p-5 rounded-xl"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <p className="text-base italic mb-2" style={{ color: '#2a2a2a' }}>
                    "{highlight.highlight_text}"
                  </p>
                  {highlight.notes && (
                    <p className="text-sm" style={{ color: '#6b6b6b' }}>
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
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-50 premium-glass-strong rounded-xl shadow-2xl p-1.5 flex gap-1"
            style={{
              left: `${menuPosition.x}px`,
              top: `${menuPosition.y}px`,
              transform: 'translate(-50%, calc(-100% - 12px))',
              backdropFilter: 'blur(20px) saturate(180%)',
              backgroundColor: 'rgba(20, 27, 38, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)'
            }}
          >
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleHighlight('yellow')}
              className="p-2.5 rounded-lg transition-colors"
              title="Highlight"
              style={{ color: 'var(--premium-gold)' }}
            >
              <Highlighter className="h-5 w-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSaveAsMemory}
              className="p-2.5 rounded-lg transition-colors"
              title="Save as thought"
              style={{ color: 'var(--premium-blue)' }}
            >
              <BookmarkPlus className="h-5 w-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowHighlightMenu(false)
              }}
              className="p-2.5 rounded-lg transition-colors"
              title="Add note"
              style={{ color: 'var(--premium-text-secondary)' }}
            >
              <MessageSquare className="h-5 w-5" />
            </motion.button>
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

      {/* Connection Suggestions - Floating */}
      {suggestions.length > 0 && (
        <ConnectionSuggestion
          suggestions={suggestions}
          sourceId={article.id}
          sourceType="article"
          onLinkCreated={() => {
            fetchArticle()
            setSuggestions([]) // Clear suggestions after linking
          }}
          onDismiss={() => setSuggestions([])}
        />
      )}

      {/* Bottom Safe Area */}
      <div className="h-24" />
    </div>
  )
}
