/**
 * Reader View Page
 * Distraction-free article reading with highlighting
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  Moon,
  Sun,
  Download,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { format } from 'date-fns'
import type { Article, ArticleHighlight } from '../types/reading'
import { useReadingStore } from '../stores/useReadingStore'
import { useToast } from '../components/ui/toast'
import { useOfflineArticle } from '../hooks/useOfflineArticle'
import { useReadingProgress } from '../hooks/useReadingProgress'
import ReactMarkdown from 'react-markdown'

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
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [darkMode, setDarkMode] = useState(false)
  const [isOfflineCached, setIsOfflineCached] = useState(false)
  const [cachedImageUrls, setCachedImageUrls] = useState<Map<string, string>>(new Map())

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

      // Load cached images
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

  // Replace image URLs with cached blob URLs
  const getContentWithCachedImages = (content: string): string => {
    if (cachedImageUrls.size === 0) return content

    let processedContent = content

    cachedImageUrls.forEach((blobUrl, originalUrl) => {
      processedContent = processedContent.replace(
        new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        blobUrl
      )
    })

    return processedContent
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (text && text.length > 0) {
      setSelectedText(text)

      // Get selection position
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
      // First create highlight
      await handleHighlight('blue')

      // Then create memory from the highlight
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

  const fontSizeClasses = {
    small: 'text-base leading-relaxed',
    medium: 'text-lg leading-loose',
    large: 'text-xl leading-loose',
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  if (!article) {
    return null
  }

  return (
    <div
      className={`min-h-screen transition-colors ${
        darkMode
          ? 'bg-neutral-900 text-neutral-100'
          : 'bg-white text-neutral-900'
      }`}
    >
      {/* Header Bar */}
      <div
        className={`sticky top-0 z-50 backdrop-blur-md border-b ${
          darkMode
            ? 'bg-neutral-900/90 border-neutral-800'
            : 'bg-white/90 border-neutral-200'
        }`}
      >
        {/* Progress bar */}
        <div className="h-1 bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full bg-orange-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/reading')}
            className={`p-2 rounded-lg hover:bg-neutral-100 ${
              darkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            {/* Offline Download Button */}
            <button
              onClick={handleDownloadOffline}
              disabled={caching || isOfflineCached}
              className={`p-2 rounded-lg ${
                isOfflineCached
                  ? 'text-green-600'
                  : darkMode
                  ? 'hover:bg-neutral-800'
                  : 'hover:bg-neutral-100'
              } disabled:opacity-50`}
              title={
                isOfflineCached
                  ? 'Available offline'
                  : 'Download for offline reading'
              }
            >
              {caching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isOfflineCached ? (
                <WifiOff className="h-5 w-5" />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </button>
            {/* Font Size */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => setFontSize('small')}
                className={`p-1.5 rounded ${
                  fontSize === 'small'
                    ? 'bg-white dark:bg-neutral-700'
                    : 'opacity-60'
                }`}
                title="Small font"
              >
                <Type className="h-3 w-3" />
              </button>
              <button
                onClick={() => setFontSize('medium')}
                className={`p-1.5 rounded ${
                  fontSize === 'medium'
                    ? 'bg-white dark:bg-neutral-700'
                    : 'opacity-60'
                }`}
                title="Medium font"
              >
                <Type className="h-4 w-4" />
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`p-1.5 rounded ${
                  fontSize === 'large'
                    ? 'bg-white dark:bg-neutral-700'
                    : 'opacity-60'
                }`}
                title="Large font"
              >
                <Type className="h-5 w-5" />
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${
                darkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
              }`}
              title="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            {/* Archive */}
            <button
              onClick={handleArchive}
              className={`p-2 rounded-lg ${
                darkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
              }`}
              title="Archive article"
            >
              <Archive className="h-5 w-5" />
            </button>

            {/* Open Original */}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-lg ${
                darkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
              }`}
              title="Open original"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-6 sm:px-8 py-12">
        {/* Header */}
        <header className="mb-12">
          <h1
            className={`font-serif font-bold mb-4 ${
              fontSize === 'small'
                ? 'text-3xl'
                : fontSize === 'medium'
                ? 'text-4xl'
                : 'text-5xl'
            }`}
          >
            {article.title}
          </h1>

          <div
            className={`flex flex-wrap items-center gap-4 text-sm ${
              darkMode ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            {article.author && (
              <span className="font-medium">{article.author}</span>
            )}
            {article.source && <span>{article.source}</span>}
            {article.published_date && (
              <span>{format(new Date(article.published_date), 'MMMM d, yyyy')}</span>
            )}
            {article.read_time_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {article.read_time_minutes} min read
              </span>
            )}
          </div>
        </header>

        {/* Content */}
        <div
          className={`prose prose-neutral max-w-none ${fontSizeClasses[fontSize]} ${
            darkMode ? 'prose-invert' : ''
          }`}
          onMouseUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
          dangerouslySetInnerHTML={{
            __html: article.content ? getContentWithCachedImages(article.content) : ''
          }}
        />

        {/* Highlights Section */}
        {highlights.length > 0 && (
          <div className="mt-16 pt-8 border-t border-neutral-200 dark:border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">Your Highlights</h2>
            <div className="space-y-4">
              {highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    highlight.color === 'yellow'
                      ? 'bg-yellow-50 border-yellow-400 dark:bg-yellow-900/20'
                      : highlight.color === 'blue'
                      ? 'bg-blue-50 border-blue-400 dark:bg-blue-900/20'
                      : highlight.color === 'green'
                      ? 'bg-green-50 border-green-400 dark:bg-green-900/20'
                      : 'bg-red-50 border-red-400 dark:bg-red-900/20'
                  }`}
                >
                  <p className="text-base italic mb-2">"{highlight.highlight_text}"</p>
                  {highlight.notes && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {highlight.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Highlight Menu */}
      {showHighlightMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 p-2 flex gap-2"
          style={{
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <button
            onClick={() => handleHighlight('yellow')}
            className="p-2 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
            title="Highlight (yellow)"
          >
            <Highlighter className="h-5 w-5 text-yellow-600" />
          </button>
          <button
            onClick={handleSaveAsMemory}
            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Save as memory"
          >
            <BookmarkPlus className="h-5 w-5 text-blue-600" />
          </button>
          <button
            onClick={() => {
              setShowHighlightMenu(false)
              // TODO: Add notes to highlight
            }}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            title="Add note"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}
