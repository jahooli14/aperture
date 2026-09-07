/**
 * Reader — the article view.
 *
 * Three things make this page work, and everything else is in service of
 * them:
 *
 *  1. THE GIST. Three bullets above the piece saying what it actually
 *     claims, so the decision to read is made on the content rather than
 *     the headline. One Gemini call per article, cached forever after.
 *  2. THE TEXT. Literata at a size you chose, on a measure that doesn't
 *     make you track back, with nothing floating over it. Reading is the
 *     whole job — the global nav and FAB are hidden on this route.
 *  3. THE VERDICT. At the end, one question: was this good? That answer,
 *     and only that answer, is what lets an article influence the project
 *     ideas the app suggests (see api/_lib/reading-corpus.ts).
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ExternalLink, Loader2, Highlighter, Clock, Type, Mic, X, Check, WifiOff } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useReadingStore } from '../stores/useReadingStore'
import { useArticle } from '../hooks/useArticle'
import { useArticleGist } from '../hooks/useArticleGist'
import { useScrollDirection } from '../hooks/useScrollDirection'
import { useToast } from '../components/ui/toast'
import { useOfflineArticle } from '../hooks/useOfflineArticle'
import { useReadingProgress } from '../hooks/useReadingProgress'
import { VoiceInput } from '../components/VoiceInput'
import { ArticleGistCard } from '../components/reading/ArticleGistCard'
import { ArticleVerdict } from '../components/reading/ArticleVerdict'
import { ReaderSettingsSheet } from '../components/reading/ReaderSettingsSheet'
import { DateRule } from '../components/ui/DateRule'
import { loadPrefs, savePrefs, typeStyle, type ReaderPrefs } from '../lib/readerPrefs'
import type { ArticleResonance } from '../types/reading'
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

  const scrollDirection = useScrollDirection()
  const [hideUI, setHideUI] = useState(false)

  useEffect(() => {
    if (scrollDirection === 'down') setHideUI(true)
    else if (scrollDirection === 'up') setHideUI(false)
  }, [scrollDirection])

  // The global nav and voice FAB hide themselves for this whole route
  // (FloatingNav derives it from the path) — nothing floats over the text.
  // hideUI here only tucks the reader's own toolbar away on scroll-down.

  const { addToast } = useToast()
  const { caching, downloadForOffline, isCached, getCachedImages } = useOfflineArticle()
  const { progress, restoreProgress } = useReadingProgress(id || '')
  const { gist, loading: gistLoading } = useArticleGist(article)

  const [selectedText, setSelectedText] = useState('')
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [isOfflineCached, setIsOfflineCached] = useState(false)
  const [cachedImageUrls, setCachedImageUrls] = useState<Map<string, string>>(new Map())

  const [prefs, setPrefs] = useState<ReaderPrefs>(() => loadPrefs())
  const [showSettings, setShowSettings] = useState(false)
  const [isHighlighterMode, setIsHighlighterMode] = useState(false)
  const [showVoiceNote, setShowVoiceNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingVerdict, setSavingVerdict] = useState(false)
  // Optimistic: the verdict shows the moment it's tapped, so the end of the
  // article never sits there looking unresponsive on a slow connection.
  const [localResonance, setLocalResonance] = useState<ArticleResonance | null>(null)

  const resonance = localResonance ?? article?.resonance ?? null

  useEffect(() => {
    setLocalResonance(null)
  }, [article?.id])

  const updatePrefs = useCallback((next: ReaderPrefs) => {
    setPrefs(next)
    savePrefs(next)
  }, [])

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
        await downloadForOffline(article)
      }
      setIsOfflineCached(true)
      setCachedImageUrls(await getCachedImages(article.id))
    } catch (error) {
      console.warn('[Reader] Auto-sync failed:', error)
    }
  }

  useEffect(() => {
    const handleSelectStart = (event: Event) => {
      if (isHighlighterMode) event.preventDefault()
    }
    document.addEventListener('selectstart', handleSelectStart)
    return () => document.removeEventListener('selectstart', handleSelectStart)
  }, [isHighlighterMode])

  useEffect(() => {
    if (!id) return
    checkOfflineStatus()
  }, [id])

  // Clean up blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      cachedImageUrls.forEach((blobUrl) => URL.revokeObjectURL(blobUrl))
    }
  }, [cachedImageUrls])

  // Handle polling for unprocessed articles
  useEffect(() => {
    if (article && !article.processed) {
      const interval = setInterval(() => refetch(), 2000)
      return () => clearInterval(interval)
    }
  }, [article?.processed, refetch])

  const checkOfflineStatus = async () => {
    if (!id) return
    const cached = await isCached(id)
    setIsOfflineCached(cached)
    if (cached) setCachedImageUrls(await getCachedImages(id))
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

    // Tables and wide code blocks scroll inside themselves rather than
    // making the whole article slide sideways under your thumb.
    doc.querySelectorAll('table').forEach((table) => {
      const wrapper = doc.createElement('div')
      wrapper.className = 'reader-scroll-x'
      table.parentNode?.insertBefore(wrapper, table)
      wrapper.appendChild(table)
    })

    return doc.body.innerHTML
  }, [article?.content, cachedImageUrls])

  // Restore reading progress when article content is ready.
  // NOTE: must be defined AFTER processedContent to avoid a TDZ error.
  useEffect(() => {
    if (article?.content && processedContent) {
      const timer = setTimeout(() => restoreProgress(), 100)
      return () => clearTimeout(timer)
    }
  }, [article?.id, processedContent, restoreProgress])

  const handleTextSelection = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isHighlighterMode) return
    event.preventDefault()

    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (text && text.length > 0) {
      setSelectedText(text)
      const rect = selection?.getRangeAt(0)?.getBoundingClientRect()
      if (rect) {
        setMenuPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 })
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
        body: JSON.stringify({ article_id: article.id, highlight_text: selectedText, color }),
      })

      if (!response.ok) throw new Error('Failed to create highlight')

      refetch()
      addToast({ title: 'Highlighted', description: 'Saved to your highlights.', variant: 'success' })
      setShowHighlightMenu(false)
      window.getSelection()?.removeAllRanges()
    } catch {
      addToast({
        title: 'Couldn\'t save highlight',
        description: 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  /**
   * The verdict. "This was good" is what puts an article into the corpus —
   * it earns an embedding and starts counting towards project ideas. "Not
   * for me" locks it out permanently. Both file the article, so answering
   * the question is the whole of finishing it.
   */
  const handleVerdict = async (verdict: ArticleResonance | null) => {
    if (!article) return
    const previous = resonance
    setLocalResonance(verdict)
    setSavingVerdict(true)
    try {
      // The store owns the optimistic write, the offline cache and the
      // signal the home widget listens for; it rolls itself back and
      // rethrows if the server refuses.
      await useReadingStore.getState().setResonance(article.id, verdict)
    } catch {
      setLocalResonance(previous)
      addToast({
        title: 'Couldn\'t save that',
        description: 'You\'re offline, or the server said no. Try again.',
        variant: 'destructive',
      })
    } finally {
      setSavingVerdict(false)
    }
  }

  // Save a thought tied to this article. Goes through the memory store's
  // createMemory, which handles optimistic UI, the capture endpoint AND
  // offline queueing (carrying the article source_reference so the link
  // survives the sync).
  const handleSaveNote = async (text: string) => {
    const trimmed = text.trim()
    if (!article || !trimmed) return
    setSavingNote(true)
    try {
      const memory = await useMemoryStore.getState().createMemory({
        body: trimmed,
        tags: ['reading-thought'],
        source_reference: {
          type: 'article',
          id: article.id,
          title: article.title ?? undefined,
          url: article.url || undefined,
        },
      })

      const isOfflineQueued = typeof memory?.id === 'string' && memory.id.startsWith('offline_')

      addToast(
        isOfflineQueued
          ? {
              title: 'Saved offline',
              description: 'It’ll sync and link to this article when you’re back online.',
              variant: 'default',
            }
          : {
              title: 'Thought saved',
              description: `Linked to "${article.title}"`,
              variant: 'success',
            },
      )

      setNoteText('')
      setShowVoiceNote(false)
    } catch (error) {
      console.error('[ReaderPage] Failed to save thought:', error)
      addToast({
        title: 'Failed to save',
        description: 'Your text is still here — tap Save to try again.',
        variant: 'destructive',
      })
    } finally {
      setSavingNote(false)
    }
  }

  // Escape goes back.
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

  // Mobile: swipe right from the left edge goes back.
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

  const type = typeStyle(prefs)

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: 'var(--brand-bg)', color: 'var(--brand-text-secondary)' }}
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
          color: rgba(245, 245, 247, 0.9);
          font-weight: 400;
          text-wrap: pretty;
          overflow-wrap: break-word;
        }
        .reader-content > *:first-child { margin-top: 0; }
        .reader-content h1, .reader-content h2, .reader-content h3, .reader-content h4 {
          color: #f5f5f7;
          font-family: var(--brand-font-header);
          font-weight: 600;
          margin-top: 2.4rem;
          margin-bottom: 0.9rem;
          line-height: 1.25;
          letter-spacing: -0.014em;
          text-wrap: balance;
        }
        .reader-content h2 { font-size: 1.35em; }
        .reader-content h3 { font-size: 1.15em; }
        .reader-content h4 { font-size: 1.02em; }
        .reader-content p { margin-bottom: 1.35em; }
        .reader-content blockquote {
          border-left: 2px solid rgba(var(--brand-primary-rgb), 0.6);
          padding: 0.2rem 0 0.2rem 1.2rem;
          margin: 1.9em 0;
          color: rgba(255, 255, 255, 0.72);
        }
        .reader-content blockquote p:last-child { margin-bottom: 0; }
        .reader-scroll-x {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 1.75em 0;
        }
        .reader-content table {
          border-collapse: collapse;
          font-size: 0.88em;
          min-width: 100%;
        }
        .reader-content th, .reader-content td {
          border: 1px solid rgba(255,255,255,0.08);
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .reader-content pre {
          background: rgba(255, 255, 255, 0.04);
          padding: 1.1rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 1.6em 0;
          border: 1px solid rgba(255, 255, 255, 0.06);
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.82em;
          line-height: 1.6;
        }
        .reader-content code {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.86em;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.12rem 0.35rem;
          border-radius: 0.25rem;
        }
        .reader-content pre code { background: transparent; padding: 0; font-size: 1em; }
        .reader-content img {
          border-radius: 0.5rem;
          margin: 2em auto;
          box-shadow: 0 12px 28px -10px rgba(0,0,0,0.6);
          max-width: 100%;
          height: auto;
        }
        .reader-content figcaption {
          font-family: var(--brand-font-body);
          font-size: 0.78em;
          text-align: center;
          color: rgba(255,255,255,0.42);
          margin-top: -1.2em;
          margin-bottom: 2em;
        }
        .reader-content a {
          color: rgb(var(--brand-primary-rgb));
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
          text-decoration-color: rgba(var(--brand-primary-rgb), 0.4);
          transition: text-decoration-color 0.2s;
        }
        .reader-content a:hover { text-decoration-color: rgb(var(--brand-primary-rgb)); }
        .reader-content ul, .reader-content ol { margin: 1.3em 0; padding-left: 1.3em; }
        .reader-content li { margin-bottom: 0.5em; }
        .reader-content hr {
          border: none;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 2.4em auto;
          width: 30%;
        }
        /* Reading in highlighter mode: the cursor says what the tap does. */
        .reader-highlighting { cursor: crosshair; }
      `}</style>

        {/* Scrim behind the toolbar. Without it the article slides under a
            72%-opaque pill and the two sets of text fight each other. */}
        <div
          aria-hidden
          className="fixed left-0 right-0 z-40 pointer-events-none"
          style={{
            top: 'var(--global-banner-h, 0px)',
            height: '104px',
            background: 'linear-gradient(to bottom, var(--brand-bg) 38%, transparent)',
            opacity: hideUI ? 0 : 1,
            transition: 'opacity 0.25s ease',
          }}
        />

        {/* Toolbar. Back on the left, three controls on the right — the
            three type sizes that used to live here (identical "A" icons,
            impossible to hit) moved into the settings sheet. */}
        <motion.nav
          initial={{ y: -90 }}
          animate={{ y: hideUI ? -110 : 0 }}
          transition={spring.gentle}
          className="fixed left-0 right-0 z-50 px-4 pt-3"
          style={{ top: 'var(--global-banner-h, 0px)' }}
        >
          <div
            className="mx-auto flex items-center justify-between px-2 py-1.5 rounded-full"
            style={{
              maxWidth: '42rem',
              background: 'rgba(11, 16, 24, 0.82)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <button
              onClick={() => navigate(-1)}
              className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-white/[0.06] transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-[18px] w-[18px] opacity-80" />
            </button>

            {/* Source, centred — tells you where you are once the masthead
                has scrolled away. */}
            <span
              className="text-[11px] uppercase tracking-[0.22em] font-semibold truncate px-2 opacity-45"
              style={{ maxWidth: '45%' }}
            >
              {article.source || article.author || ''}
            </span>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setIsHighlighterMode(!isHighlighterMode)}
                className="h-10 w-10 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: isHighlighterMode ? 'rgba(var(--brand-primary-rgb), 0.18)' : 'transparent',
                  color: isHighlighterMode ? 'rgb(var(--brand-primary-rgb))' : 'rgba(255,255,255,0.7)',
                }}
                aria-pressed={isHighlighterMode}
                aria-label="Highlighter"
              >
                <Highlighter className="h-[18px] w-[18px]" />
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-white/[0.06] transition-colors"
                aria-label="Reading settings"
              >
                <Type className="h-[18px] w-[18px] opacity-75" />
              </button>

              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-white/[0.06] transition-colors"
                aria-label="Open the original"
              >
                <ExternalLink className="h-[18px] w-[18px] opacity-70" />
              </a>
            </div>
          </div>

          {/* Reading progress — single hairline */}
          <div
            className="mx-auto mt-2 h-px overflow-hidden"
            style={{ maxWidth: '42rem', background: 'rgba(255,255,255,0.05)' }}
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
        </motion.nav>

        <main
          className="mx-auto px-5 sm:px-6 pt-24 sm:pt-28 pb-20"
          style={{ maxWidth: type.maxWidth }}
        >
          <motion.header
            className="mb-10"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ease.editorial}
          >
            {/* Source masthead — small caps, hairline rule */}
            {(article.source || article.author) && (
              <div className="flex items-center gap-3 mb-5">
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
              className="mb-5"
              style={{
                fontFamily: 'var(--brand-font-serif)',
                fontSize: type.titleSize,
                fontWeight: 600,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                color: '#f5f5f7',
                textWrap: 'balance',
              }}
            >
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {article.author && article.source && (
                <span
                  className="text-[13px] italic"
                  style={{ fontFamily: 'var(--brand-font-reading)', color: 'rgba(255,255,255,0.65)' }}
                >
                  by {article.author}
                </span>
              )}
              {article.published_date && (
                <DateRule date={article.published_date} variant="full" ruleSide="none" />
              )}
              {article.read_time_minutes ? (
                <span
                  className="text-[10px] uppercase tracking-[0.32em] font-semibold flex items-center gap-1.5"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  <Clock className="h-3 w-3" /> {article.read_time_minutes} min
                </span>
              ) : null}
              {!isOfflineCached && caching && (
                <span
                  className="text-[10px] uppercase tracking-[0.28em] flex items-center gap-1.5 opacity-40"
                  title="Saving a copy so this works offline"
                >
                  <Loader2 className="h-3 w-3 animate-spin" /> saving offline
                </span>
              )}
            </div>
          </motion.header>

          {/* What the piece actually claims, before you commit to it. */}
          <ArticleGistCard gist={gist} loading={gistLoading} />

          {processedContent || article.content ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className={`reader-content ${isHighlighterMode ? 'reader-highlighting' : ''}`}
              style={{
                fontFamily: type.fontFamily,
                fontSize: type.fontSize,
                lineHeight: type.lineHeight,
                letterSpacing: type.letterSpacing,
              }}
              onMouseUp={handleTextSelection}
              onTouchEnd={handleTextSelection}
              dangerouslySetInnerHTML={{ __html: processedContent || article.content || '' }}
            />
          ) : (
            <div
              className="reader-content"
              style={{ fontFamily: type.fontFamily, fontSize: type.fontSize, lineHeight: type.lineHeight }}
            >
              {article.processed === false ? (
                <p className="flex items-center gap-2 opacity-60 text-[15px]" style={{ fontFamily: 'var(--brand-font-body)' }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Pulling the text out…
                </p>
              ) : (
                <p className="flex flex-wrap items-center gap-2 opacity-70 text-[15px]" style={{ fontFamily: 'var(--brand-font-body)' }}>
                  <WifiOff className="h-4 w-4" />
                  Couldn’t get the text for this one.
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--brand-primary)] underline"
                  >
                    Read it at the source
                  </a>
                </p>
              )}
            </div>
          )}

          {/* The one question that lets an article into the corpus. */}
          <ArticleVerdict
            resonance={resonance}
            saving={savingVerdict}
            onChoose={handleVerdict}
            onUndo={() => handleVerdict(null)}
            onCaptureThought={() => setShowVoiceNote(true)}
            onDone={() => navigate(-1)}
          />
        </main>

        <ReaderSettingsSheet
          open={showSettings}
          prefs={prefs}
          onChange={updatePrefs}
          onClose={() => setShowSettings(false)}
        />

        {/* Highlight menu */}
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
                  aria-label={`Highlight ${shade}`}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Capture a thought about this article. Reachable from the end of
            the piece; no floating button competing with the text. */}
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
                        What stuck?
                      </h3>
                      <p className="meta-serif mt-1 line-clamp-1">{article.title}</p>
                    </div>
                    <button
                      onClick={() => setShowVoiceNote(false)}
                      className="h-12 w-12 rounded-full bg-[var(--glass-surface)] hover:bg-[rgba(255,255,255,0.1)] flex items-center justify-center transition-all border border-[var(--glass-surface)]"
                      aria-label="Close"
                    >
                      <X className="h-6 w-6 text-brand-text-muted" />
                    </button>
                  </div>
                  <div className="px-8 pb-10 space-y-4">
                    {/* Type it or talk it. Voice transcribes into the same
                        box so you can read it back and edit before saving. */}
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      autoFocus
                      rows={4}
                      placeholder="What did this spark? Type, or tap the mic to talk."
                      className="w-full resize-none rounded-2xl p-4 text-[15px] leading-relaxed text-[var(--brand-text-primary)] bg-[var(--glass-surface)] placeholder:text-[var(--brand-text-muted)] focus:outline-none"
                      style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)' }}
                    />

                    <button
                      type="button"
                      onClick={() => handleSaveNote(noteText)}
                      disabled={savingNote || !noteText.trim()}
                      className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-white transition-all disabled:opacity-40"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                    >
                      {savingNote ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> Saving…</>
                      ) : (
                        <><Check className="h-5 w-5" /> Save thought</>
                      )}
                    </button>

                    <VoiceInput
                      maxDuration={60}
                      autoSubmit={true}
                      autoStart={false}
                      onTranscript={(t) =>
                        setNoteText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))
                      }
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
