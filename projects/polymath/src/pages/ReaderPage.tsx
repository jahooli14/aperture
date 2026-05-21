/**
 * Reader View Page - Premium Reading Experience
 * Inspired by Readwise Reader and Omnivore
 */

import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ExternalLink, Archive, Loader2, Highlighter, Clock, Type, Mic, X } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useReadingStore } from '../stores/useReadingStore'
import { useArticle } from '../hooks/useArticle'
import { useScrollDirection } from '../hooks/useScrollDirection'
import { useToast } from '../components/ui/toast'
import { useOfflineArticle } from '../hooks/useOfflineArticle'
import { useReadingProgress } from '../hooks/useReadingProgress'
import { ArticleCompletionDialog } from '../components/reading/ArticleCompletionDialog'
import { VoiceInput } from '../components/VoiceInput'
import { DateRule } from '../components/ui/DateRule'
import { spring, ease } from '../lib/motion'

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // ?no_promote=true is set by the home Consuming widget when Saved is at
  // cap. Honoring it keeps the saved list a tidy 20 instead of silently
  // growing as the user taps headlines to read.
  const noPromote = searchParams.get('no_promote') === 'true'
  const { data: articleData, isLoading: loading, refetch } = useArticle(id, { noPromote })
  const article = articleData?.article || null
  const highlights = articleData?.highlights || []

  const scrollDirection = useScrollDirection()
  const [hideUI, setHideUI] = useState(false)

  useEffect(() => {
    if (scrollDirection === 'down') {
      setHideUI(true)
    } else if (scrollDirection === 'up') {
      setHideUI(false)
    }
  }, [scrollDirection])

  // Broadcast hideUI state for FloatingNav
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-nav', { detail: { hidden: hideUI } }))
  }, [hideUI])

  const { addToast } = useToast()
  const { caching, downloadForOffline, isCached, getCachedImages } = useOfflineArticle()
  const { progress, restoreProgress } = useReadingProgress(id || '')

  const [selectedText, setSelectedText] = useState('')
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [fontSize, setFontSize] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable')
  const [isOfflineCached, setIsOfflineCached] = useState(false)
  const [cachedImageUrls, setCachedImageUrls] = useState<Map<string, string>>(new Map())
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)

  const [isHighlighterMode, setIsHighlighterMode] = useState(false)
  const [showVoiceNote, setShowVoiceNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

  // Automatic offline caching
  useEffect(() => {
    if (article && !isOfflineCached && !caching) {
      handleAutoSync()
    }
  }, [article, isOfflineCached])

  const handleAutoSync = async () => {
    if (!article) return
    try {
      const cached = await isCached(article.id)
      if (!cached) {
        console.log('[Reader] Auto-syncing for offline...')
        await downloadForOffline(article)
        setIsOfflineCached(true)
        const images = await getCachedImages(article.id)
        setCachedImageUrls(images)
      } else {
        setIsOfflineCached(true)
        const images = await getCachedImages(article.id)
        setCachedImageUrls(images)
      }
    } catch (error) {
      console.warn('[Reader] Auto-sync failed:', error)
    }
  }

  useEffect(() => {
    const handleSelectStart = (event: Event) => {
      if (isHighlighterMode) {
        event.preventDefault()
      }
    }

    document.addEventListener('selectstart', handleSelectStart)
    return () => {
      document.removeEventListener('selectstart', handleSelectStart)
    }
  }, [isHighlighterMode])

  useEffect(() => {
    if (!id) return
    checkOfflineStatus()
  }, [id])

  // Clean up blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      // Revoke all blob URLs when component unmounts or cachedImageUrls changes
      cachedImageUrls.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl)
      })
    }
  }, [cachedImageUrls])

  // Handle polling for unprocessed articles
  useEffect(() => {
    if (article && !article.processed) {
      console.log('[ReaderPage] Article not processed, starting polling...')
      const interval = setInterval(() => {
        refetch()
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [article?.processed, refetch])

  const checkOfflineStatus = async () => {
    if (!id) return
    const cached = await isCached(id)
    setIsOfflineCached(cached)

    if (cached) {
      const images = await getCachedImages(id)
      setCachedImageUrls(images)
    }
  }

  const processedContent = useMemo(() => {
    if (!article?.content) return ''

    // 1. Sanitize first to ensure safety
    const cleanHtml = DOMPurify.sanitize(article.content, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
        'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
        'div', 'span'
      ],
      ALLOWED_ATTR: ['href', 'src', 'srcset', 'sizes', 'alt', 'title', 'class', 'width', 'height', 'loading', 'decoding', 'referrerpolicy'],
      FORBID_ATTR: ['style', 'id']
    })

    // 2. Parse and hydrate images (Proxy or Cache)
    const parser = new DOMParser()
    const doc = parser.parseFromString(cleanHtml, 'text/html')

    doc.querySelectorAll('img').forEach((img) => {
      const originalSrc = img.getAttribute('src')
      if (!originalSrc) return

      // Force no-referrer for privacy and enable lazy loading
      img.setAttribute('referrerpolicy', 'no-referrer')
      img.setAttribute('loading', 'lazy')
      img.setAttribute('decoding', 'async')

      // 1. Use cached blob if available (Offline mode)
      if (cachedImageUrls.has(originalSrc)) {
        img.setAttribute('src', cachedImageUrls.get(originalSrc)!)
        // Remove srcset to prevent browser from picking original
        img.removeAttribute('srcset')
        img.removeAttribute('sizes')
      }
      // 2. Else use Proxy (Online mode - bypass CORS/Hotlinking)
      else if (originalSrc.startsWith('http')) {
        const proxyUrl = `/api/reading?resource=proxy&url=${encodeURIComponent(originalSrc)}`
        img.setAttribute('src', proxyUrl)
        img.removeAttribute('srcset')
        img.removeAttribute('sizes')
      }
    })

    return doc.body.innerHTML
  }, [article?.content, cachedImageUrls])

  // Restore reading progress when article content is ready
  // NOTE: This effect must be defined AFTER processedContent useMemo to avoid TDZ error
  useEffect(() => {
    if (article?.content && processedContent) {
      // Small delay to ensure DOM is fully rendered before scrolling
      const timer = setTimeout(() => {
        restoreProgress()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [article?.id, processedContent, restoreProgress])

  // Auto-trigger completion dialog when user reaches end of article
  const hasTriggeredCompletion = useRef(false)
  useEffect(() => {
    if (
      progress >= 95 &&
      !hasTriggeredCompletion.current &&
      !showCompletionDialog &&
      article?.status !== 'archived'
    ) {
      hasTriggeredCompletion.current = true
      // Small delay so the user sees they've reached the bottom
      const timer = setTimeout(() => setShowCompletionDialog(true), 800)
      return () => clearTimeout(timer)
    }
  }, [progress, showCompletionDialog, article?.status])

  const handleTextSelection = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isHighlighterMode) return
    event.preventDefault()

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

      refetch()
      addToast({
        title: 'Highlighted!',
        description: 'Text saved to highlights',
        variant: 'success',
      })

      setShowHighlightMenu(false)
      window.getSelection()?.removeAllRanges()
    } catch (error) {
      addToast({
        title: 'Couldn\'t save highlight',
        description: 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  const handleArchive = async () => {
    if (!article) return
    setShowCompletionDialog(true)
  }

  const handleArchiveComplete = async () => {
    if (!article) return
    try {
      await useReadingStore.getState().updateArticleStatus(article.id, 'archived')
      addToast({
        title: 'Archived',
        description: 'Article moved to archive',
        variant: 'success',
      })
      navigate(-1)
    } catch (error) {
      addToast({
        title: 'Couldn\'t archive',
        description: 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  const handleVoiceNote = async (text: string) => {
    if (!article || !text.trim()) return
    setSavingNote(true)
    try {
      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Thought on: ${article.title}`,
          body: text,
          tags: ['reading-thought'],
          source_reference: { type: 'article', id: article.id }
        })
      })
      addToast({
        title: 'Thought captured',
        description: 'Saved to your thoughts',
        variant: 'success',
      })
      setShowVoiceNote(false)
    } catch {
      addToast({
        title: 'Failed to save',
        description: 'Could not save your thought. Try again.',
        variant: 'destructive',
      })
    } finally {
      setSavingNote(false)
    }
  }

  // Reading sizes — leaning Dia / Day One. Serif body, generous leading.
  // Compact for dense / journalistic, comfortable default, spacious for
  // long-form essays.
  const fontSizeSettings = {
    compact: {
      article: 'text-[17px] leading-[1.7]',
      title: 'text-[32px] sm:text-[38px]',
      meta: 'text-sm'
    },
    comfortable: {
      article: 'text-[19px] leading-[1.8]',
      title: 'text-[38px] sm:text-[46px]',
      meta: 'text-sm'
    },
    spacious: {
      article: 'text-[21px] leading-[1.9]',
      title: 'text-[44px] sm:text-[54px]',
      meta: 'text-base'
    }
  }

  // Minimal keyboard support (Escape to go back)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        navigate(-1)
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [navigate])

  // Mobile: Swipe right from left edge to go back
  useEffect(() => {
    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartX = touch.clientX
      touchStartY = touch.clientY
      touchStartTime = Date.now()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartX
      const deltaY = Math.abs(touch.clientY - touchStartY)
      const deltaTime = Date.now() - touchStartTime

      // Swipe right from left edge (within 50px of left edge, fast swipe, mostly horizontal)
      if (touchStartX < 50 && deltaX > 100 && deltaY < 100 && deltaTime < 300) {
        navigate(-1)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-8 w-8 text-[var(--brand-primary)]" />
        </motion.div>
      </div>
    )
  }

  if (!article) return null

  const settings = fontSizeSettings[fontSize]

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background: 'var(--brand-bg)',
        color: 'var(--brand-text-secondary)',
      }}
    >
      {/* Single, calm wash. Reading is sacred — no parallax orbs. */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(var(--brand-primary-rgb), 0.06), transparent 70%)',
        }}
      />

      <div className="relative z-10">
        <style>{`
        .reader-content {
          font-family: var(--brand-font-serif);
          color: rgba(245, 245, 247, 0.92);
          font-weight: 400;
          letter-spacing: -0.003em;
        }
        .reader-content h1, .reader-content h2, .reader-content h3 {
          color: #f5f5f7;
          font-family: var(--brand-font-serif);
          font-weight: 600;
          margin-top: 2.5rem;
          margin-bottom: 1.1rem;
          line-height: 1.25;
          letter-spacing: -0.018em;
        }
        .reader-content h2 { font-size: 1.5em; }
        .reader-content h3 { font-size: 1.2em; }
        .reader-content p {
          margin-bottom: 1.4rem;
        }
        .reader-content blockquote {
          border-left: 2px solid rgba(var(--brand-primary-rgb), 0.6);
          padding: 0.4rem 0 0.4rem 1.4rem;
          margin: 2rem 0;
          font-style: italic;
          color: rgba(255, 255, 255, 0.7);
          font-family: var(--brand-font-serif);
        }
        .reader-content pre {
          background: rgba(255, 255, 255, 0.04);
          padding: 1.25rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin: 1.75rem 0;
          border: 1px solid rgba(255, 255, 255, 0.06);
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
        .reader-content code {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.88em;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.15rem 0.4rem;
          border-radius: 0.25rem;
        }
        .reader-content pre code { background: transparent; padding: 0; }
        .reader-content img {
          border-radius: 0.5rem;
          margin: 2.25rem auto;
          box-shadow: 0 12px 28px -10px rgba(0,0,0,0.6);
          max-width: 100%;
        }
        .reader-content a {
          color: rgb(var(--brand-primary-rgb));
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 4px;
          transition: opacity 0.2s;
        }
        .reader-content a:hover { opacity: 0.7; }
        .reader-content ul, .reader-content ol {
          margin: 1.4rem 0;
          padding-left: 1.4rem;
        }
        .reader-content li { margin-bottom: 0.55rem; }
        .reader-content hr {
          border: none;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 2.5rem auto;
          width: 30%;
        }
      `}</style>

        {/* Soft sticky toolbar — Dia-leaning. Refined glass, no heavy shadow. */}
        <motion.nav
          initial={{ y: -80 }}
          animate={{ y: hideUI ? -80 : 0 }}
          transition={spring.gentle}
          className="fixed top-0 left-0 right-0 z-50 px-4 pt-3"
        >
          <div
            className="max-w-2xl mx-auto flex items-center justify-between px-3 py-2 rounded-full"
            style={{
              background: 'rgba(11, 16, 24, 0.72)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <button
              onClick={() => navigate(-1)}
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/[0.04] transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4 opacity-80" />
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsHighlighterMode(!isHighlighterMode)}
                className="h-9 w-9 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: isHighlighterMode ? 'rgba(var(--brand-primary-rgb), 0.18)' : 'transparent',
                  color: isHighlighterMode ? 'rgb(var(--brand-primary-rgb))' : 'rgba(255,255,255,0.7)',
                }}
                title="Highlight"
              >
                <Highlighter className="h-4 w-4" />
              </button>

              <div className="flex items-center mx-1">
                {(['compact', 'comfortable', 'spacious'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className="h-9 w-7 rounded-full flex items-center justify-center transition-all"
                    style={{
                      color: fontSize === size ? 'rgb(var(--brand-primary-rgb))' : 'rgba(255,255,255,0.45)',
                    }}
                    aria-label={`Font ${size}`}
                  >
                    <Type className={size === 'compact' ? 'h-[11px] w-[11px]' : size === 'comfortable' ? 'h-[13px] w-[13px]' : 'h-4 w-4'} />
                  </button>
                ))}
              </div>

              <button
                onClick={handleArchive}
                className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/[0.04] transition-colors"
                title="Archive"
              >
                <Archive className="h-4 w-4 opacity-70" />
              </button>

              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/[0.04] transition-colors"
                title="Open original"
              >
                <ExternalLink className="h-4 w-4 opacity-70" />
              </a>
            </div>
          </div>

          {/* Reading Progress — single hairline */}
          <div
            className="max-w-2xl mx-auto mt-2 h-px overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <motion.div
              className="h-full"
              style={{
                background: 'linear-gradient(90deg, rgba(var(--brand-primary-rgb),0.4), rgb(var(--brand-primary-rgb)))',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={ease.quick}
            />
          </div>

          {/* Offline indicator — quietly tucked below */}
          {!isOfflineCached && (
            <div className="max-w-2xl mx-auto mt-2 flex justify-center">
              <span className="text-[10px] uppercase tracking-[0.28em] flex items-center gap-1.5 opacity-50">
                <Loader2 className="h-3 w-3 animate-spin" /> caching for offline
              </span>
            </div>
          )}
        </motion.nav>

        {/* Article — serif body, magazine-grade hierarchy */}
        <main className="max-w-2xl mx-auto px-5 sm:px-6 pt-28 sm:pt-32 pb-24">
          <motion.header
            className="mb-14"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ease.editorial}
          >
            {/* Source masthead — small caps, hairline rule */}
            {(article.source || article.author) && (
              <div className="flex items-center gap-3 mb-6">
                <span
                  className="text-[10px] uppercase tracking-[0.32em] font-semibold"
                  style={{ color: 'rgba(var(--brand-primary-rgb), 0.7)' }}
                >
                  {article.source || article.author}
                </span>
                <span
                  className="h-px flex-1 max-w-24"
                  style={{ background: 'linear-gradient(to right, rgba(var(--brand-primary-rgb), 0.45), transparent)' }}
                  aria-hidden
                />
              </div>
            )}

            <h1
              className={`mb-7 ${settings.title}`}
              style={{
                fontFamily: 'var(--brand-font-serif)',
                fontWeight: 600,
                lineHeight: 1.08,
                letterSpacing: '-0.022em',
                color: '#f5f5f7',
              }}
            >
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {article.author && article.source && (
                <span className="text-[13px] italic" style={{ fontFamily: 'var(--brand-font-serif)', color: 'rgba(255,255,255,0.7)' }}>
                  by {article.author}
                </span>
              )}
              {article.published_date && (
                <DateRule date={article.published_date} variant="full" ruleSide="none" />
              )}
              {article.read_time_minutes && (
                <span
                  className="text-[10px] uppercase tracking-[0.32em] font-semibold flex items-center gap-1.5"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  <Clock className="h-3 w-3" /> {article.read_time_minutes} min
                </span>
              )}
            </div>
          </motion.header>

          {processedContent || article.content ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className={`reader-content ${settings.article}`}
              onMouseUp={handleTextSelection}
              dangerouslySetInnerHTML={{ __html: processedContent || article.content || '' }}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className={`reader-content ${settings.article}`}
            >
              <p className="text-brand-text-muted italic">
                No content available for this article.{' '}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--brand-primary)] underline"
                >
                  View Original
                </a>
              </p>
            </motion.div>
          )}
        </main>

        {/* Highlight Menu */}
        <AnimatePresence>
          {showHighlightMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="fixed z-[100] bg-[#161618] border border-[var(--glass-surface-hover)] rounded-2xl p-2 shadow-2xl flex items-center gap-1"
              style={{
                left: menuPosition.x,
                top: menuPosition.y,
                transform: 'translateX(-50%) translateY(-100%)'
              }}
            >
              {['light', 'medium', 'dark'].map((shade) => (
                <button
                  key={shade}
                  onClick={() => handleHighlight(shade)}
                  className="w-8 h-8 rounded-full border border-[var(--glass-surface-hover)] hover:scale-110 transition-transform"
                  style={{ backgroundColor: shade === 'light' ? 'rgba(var(--color-accent-light-rgb), 0.5)' : shade === 'medium' ? 'rgba(var(--brand-primary-rgb), 0.5)' : 'rgba(var(--color-accent-dark-rgb), 0.5)' }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>


        <ArticleCompletionDialog
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          article={article}
          onCapture={async ({ text }) => {
            if (text) {
              // Create a thought from the capture
              await fetch('/api/memories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: `Learned from: ${article.title}`,
                  body: text,
                  tags: ['reading-thought']
                })
              })
            }
            await handleArchiveComplete()
          }}
          onSkip={handleArchiveComplete}
        />

        {/* Voice Note FAB — consistent with global VoiceFAB design */}
        <AnimatePresence>
          {!hideUI && !showCompletionDialog && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              onClick={() => setShowVoiceNote(true)}
              className="fixed z-[25001] bottom-28 md:bottom-12 right-6 md:right-12 h-14 w-14 md:h-16 md:w-16 rounded-full flex items-center justify-center touch-none"
              style={{
                backgroundColor: 'var(--brand-primary)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 10px var(--glass-surface)',
              }}
              aria-label="Record a thought about this article"
            >
              <Mic className="h-6 w-6 text-white" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Voice Note Modal */}
        <AnimatePresence>
          {showVoiceNote && (
            <div className="fixed inset-0 z-[21000] flex items-end md:items-center md:justify-center">
              <motion.div
                key="voice-note-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={() => setShowVoiceNote(false)}
              />
              <motion.div
                key="voice-note-modal"
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full md:w-[500px] bg-[#0A0A0B] border border-[var(--glass-surface-hover)] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl z-10 overflow-hidden mb-0 md:mb-12"
              >
                <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
                  <div className="flex justify-center pt-4 pb-2 md:hidden">
                    <div className="w-12 h-1.5 rounded-full bg-[rgba(255,255,255,0.1)]" />
                  </div>
                  <div className="flex items-center justify-between px-8 py-8">
                    <div>
                      <h3 className="page-hero-sm flex items-center gap-2" style={{ fontSize: 'clamp(1.5rem, 4vw, 1.75rem)' }}>
                        <Mic className="h-5 w-5 text-brand-primary" />
                        Capture a thought
                      </h3>
                      <p className="meta-serif mt-1 line-clamp-1">{article.title}</p>
                    </div>
                    <button
                      onClick={() => setShowVoiceNote(false)}
                      className="h-12 w-12 rounded-full bg-[var(--glass-surface)] hover:bg-[rgba(255,255,255,0.1)] flex items-center justify-center transition-all border border-[var(--glass-surface)]"
                    >
                      <X className="h-6 w-6 text-brand-text-muted" />
                    </button>
                  </div>
                  <div className="px-8 pb-10">
                    <VoiceInput
                      onTranscript={handleVoiceNote}
                      maxDuration={60}
                      autoSubmit={true}
                      autoStart={true}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
