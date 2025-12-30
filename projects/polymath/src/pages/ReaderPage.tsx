/**
 * Reader View Page - Premium Reading Experience
 * Inspired by Readwise Reader and Omnivore
 */

import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ExternalLink,
  Archive,
  Loader2,
  Highlighter,
  Clock,
  Type,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { format } from 'date-fns'
import DOMPurify from 'dompurify'
import { useReadingStore } from '../stores/useReadingStore'
import { useArticle } from '../hooks/useArticle'
import { useScrollDirection } from '../hooks/useScrollDirection'
import { useToast } from '../components/ui/toast'
import { useOfflineArticle } from '../hooks/useOfflineArticle'
import { useReadingProgress } from '../hooks/useReadingProgress'
import { ArticleCompletionDialog } from '../components/reading/ArticleCompletionDialog'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { ConnectionsList } from '../components/connections/ConnectionsList'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { supabase } from '../lib/supabase'

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: articleData, isLoading: loading, refetch } = useArticle(id)
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
  const { progress } = useReadingProgress(id || '')
  const { setContext, clearContext } = useContextEngineStore()

  const [selectedText, setSelectedText] = useState('')
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [fontSize, setFontSize] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable')
  const [isOfflineCached, setIsOfflineCached] = useState(false)
  const [cachedImageUrls, setCachedImageUrls] = useState<Map<string, string>>(new Map())
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [showConnectionSuggestions, setShowConnectionSuggestions] = useState(true)
  const [suggestions, setSuggestions] = useState<any[]>([])

  const [isHighlighterMode, setIsHighlighterMode] = useState(false)

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
    fetchSuggestions()
    return () => {
      clearContext()
    }
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
      console.error('[Reader] Failed to fetch suggestions:', error)
    }
  }

  useEffect(() => {
    if (article) {
      setContext('article', article.id, article.title, { url: article.url })
    }
  }, [article, setContext])

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
      ALLOWED_ATTR: ['href', 'src', 'srcset', 'sizes', 'alt', 'title', 'class', 'width', 'height', 'loading', 'referrerpolicy'],
      FORBID_ATTR: ['style', 'id']
    })

    // 2. Parse and hydrate images (Proxy or Cache)
    const parser = new DOMParser()
    const doc = parser.parseFromString(cleanHtml, 'text/html')

    doc.querySelectorAll('img').forEach((img) => {
      const originalSrc = img.getAttribute('src')
      if (!originalSrc) return

      // Force no-referrer for privacy
      img.setAttribute('referrerpolicy', 'no-referrer')

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
        title: 'Error',
        description: 'Failed to save highlight',
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

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          handleArchive()
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        navigate('/reading')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [article, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-8 w-8 text-blue-500" />
        </motion.div>
      </div>
    )
  }

  if (!article) return null

  const settings = fontSizeSettings[fontSize]

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#e1e1e3] selection:bg-blue-500/30 selection:text-blue-200 relative overflow-x-hidden">
      {/* Subtle Stylish Character: Background Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 40, 0],
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0) 70%)',
            filter: 'blur(100px)',
          }}
        />
        <motion.div
          animate={{
            x: [0, -50, 0],
            y: [0, 60, 0],
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[20%] -right-[15%] w-[80vw] h-[80vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0) 70%)',
            filter: 'blur(120px)',
          }}
        />
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, 20, 0],
            scale: [0.8, 1, 0.8],
            opacity: [0.05, 0.15, 0.05]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[60vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      <div className="relative z-10">
        <style>{`
        .reader-content {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #d1d1d6;
        }
        .reader-content h1, .reader-content h2, .reader-content h3 {
          color: #f2f2f7;
          font-weight: 700;
          margin-top: 2.5rem;
          margin-bottom: 1.25rem;
          line-height: 1.3;
        }
        .reader-content p {
          margin-bottom: 1.5rem;
        }
        .reader-content blockquote {
          border-left: 3px solid #3b82f6;
          padding: 0.5rem 0 0.5rem 1.5rem;
          margin: 2rem 0;
          font-style: italic;
          color: #a1a1aa;
          background: rgba(59, 130, 246, 0.05);
          border-radius: 0 0.5rem 0.5rem 0;
        }
        .reader-content pre {
          background: #161618;
          padding: 1.5rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin: 2rem 0;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .reader-content code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9em;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
        }
        .reader-content img {
          border-radius: 1rem;
          margin: 3rem auto;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .reader-content a {
          color: #3b82f6;
          text-decoration: underline;
          text-underline-offset: 4px;
          transition: color 0.2s;
        }
        .reader-content a:hover {
          color: #60a5fa;
        }
        .reader-content ul, .reader-content ol {
          margin: 1.5rem 0;
          padding-left: 1.5rem;
        }
        .reader-content li {
          margin-bottom: 0.75rem;
        }
      `}</style>

        {/* Premium Sticky Toolbar */}
        <motion.nav
          initial={{ y: -100 }}
          animate={{ y: hideUI ? -100 : 0 }}
          className="fixed top-0 left-0 right-0 z-50 px-4 py-3"
        >
          <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-2 bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/reading')}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                {isOfflineCached ? (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <Wifi className="h-3 w-3" /> Available Offline
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsHighlighterMode(!isHighlighterMode)}
                className={`p-2 rounded-xl transition-all ${isHighlighterMode ? 'bg-blue-500 text-white' : 'hover:bg-white/5 text-zinc-400'}`}
                title="Highlighter Mode"
              >
                <Highlighter className="h-5 w-5" />
              </button>

              <div className="flex bg-white/5 rounded-xl p-1 mx-1">
                {(['compact', 'comfortable', 'spacious'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`px-3 py-1 rounded-lg text-xs transition-all ${fontSize === size ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Type className={size === 'compact' ? 'h-3 w-3' : size === 'comfortable' ? 'h-4 w-4' : 'h-5 w-5'} />
                  </button>
                ))}
              </div>

              <button
                onClick={handleArchive}
                className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors"
                title="Archive"
              >
                <Archive className="h-5 w-5" />
              </button>

              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Reading Progress Line */}
          <div className="max-w-3xl mx-auto mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </motion.nav>

        {/* Article Content */}
        <main className="max-w-2xl mx-auto px-6 pt-32 pb-24">
          <header className="mb-16">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`font-bold tracking-tight text-[#f2f2f7] mb-6 ${settings.title}`}
              style={{ lineHeight: 1.1 }}
            >
              {article.title}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`flex flex-wrap items-center gap-4 text-zinc-500 ${settings.meta}`}
            >
              {article.author && (
                <span className="text-zinc-300 font-medium">{article.author}</span>
              )}
              {article.source && <span>{article.source}</span>}
              {article.published_date && (
                <span>{format(new Date(article.published_date), 'MMM d, yyyy')}</span>
              )}
              {article.read_time_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {article.read_time_minutes} min read
                </span>
              )}
            </motion.div>
          </header>

          {processedContent ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className={`reader-content ${settings.article}`}
              onMouseUp={handleTextSelection}
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-6 opacity-40">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-t-2 border-blue-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full border-b-2 border-indigo-400 animate-spin" style={{ animationDirection: 'reverse' }} />
                </div>
              </div>
              <p className="text-sm font-bold tracking-widest uppercase animate-pulse">Extracting Intelligence...</p>
            </div>
          )}

          {/* Smart Connections Section */}
          <div className="mt-20 pt-12 border-t border-white/5">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Synthesized Insights</h3>
                <p className="text-sm text-zinc-500">Connections discovered by the Aperture Engine.</p>
              </div>
              <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-400">
                AI Connected
              </div>
            </div>

            <ConnectionsList
              itemType="article"
              itemId={article.id}
              content={article.title + ' ' + (article.excerpt || '')}
            />
          </div>
        </main>

        {/* Highlight Menu */}
        <AnimatePresence>
          {showHighlightMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="fixed z-[100] bg-[#161618] border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center gap-1"
              style={{
                left: menuPosition.x,
                top: menuPosition.y,
                transform: 'translateX(-50%) translateY(-100%)'
              }}
            >
              {['yellow', 'green', 'blue', 'pink', 'purple'].map((color) => (
                <button
                  key={color}
                  onClick={() => handleHighlight(color)}
                  className="w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color === 'yellow' ? '#fde047' : color === 'green' ? '#4ade80' : color === 'blue' ? '#60a5fa' : color === 'pink' ? '#f472b6' : '#c084fc' }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Suggestions */}
        {showConnectionSuggestions && suggestions.length > 0 && (
          <ConnectionSuggestion
            suggestions={suggestions}
            sourceId={article.id}
            sourceType="article"
            onDismiss={() => setShowConnectionSuggestions(false)}
          />
        )}

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
      </div>
    </div>
  )
}
