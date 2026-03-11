/**
 * Reading Queue Page
 * Displays saved articles with filtering and save functionality
 */

import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Loader2, BookOpen, Archive, List, Rss, RefreshCw, CheckSquare, Trash2, Tag, Check, Search, FileText, AlertCircle, RotateCw, Link as LinkIcon, Play, ChevronRight } from 'lucide-react'
import { useReadingStore } from '../stores/useReadingStore'
import { useOfflineArticle } from '../hooks/useOfflineArticle'
import { ArticleCard } from '../components/reading/ArticleCard'
import { ReadingProvocation } from '../components/reading/ReadingProvocation'
import { RSSFeedItem } from '../components/reading/RSSFeedItem'
import { useToast } from '../components/ui/toast'
import { useConnectionStore } from '../stores/useConnectionStore'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { useBulkSelection } from '../hooks/useBulkSelection'
import { BulkActionsBar } from '../components/BulkActionsBar'
import { PremiumTabs } from '../components/ui/premium-tabs'
import { EmptyState } from '../components/ui/empty-state'
import { SkeletonCard } from '../components/ui/skeleton-card'
import { articleProcessor } from '../lib/articleProcessor'
import { useRSSStore } from '../stores/useRSSStore'
import {
  consumeShareData,
  clearShareData
} from '../lib/shareHandler'
import { FocusableList, FocusableItem } from '../components/FocusableList'
import { PullToRefresh } from '../components/PullToRefresh'
import { SubtleBackground } from '../components/SubtleBackground'
import type { ArticleStatus } from '../types/reading'
import type { RSSFeedItem as RSSItem } from '../types/rss'
import type { Article } from '../types/reading'

// Lazy load heavy dialog components to reduce initial bundle size
const SaveArticleDialog = lazy(() => import('../components/reading/SaveArticleDialog').then(m => ({ default: m.SaveArticleDialog })))
const ProcessingDebugPanel = lazy(() => import('../components/reading/ProcessingDebugPanel').then(m => ({ default: m.ProcessingDebugPanel })))

type FilterTab = 'queue' | 'updates' | 'unread' | 'reading' | 'archived'

export function ReadingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { articles, loading, fetchArticles, currentFilter, setFilter, saveArticle, updateArticle, updateArticleStatus, deleteArticle } = useReadingStore()

  // Sync processing articles with store deletions
  useEffect(() => {
    setProcessingArticles(prev => {
      const next = new Map(prev)
      let changed = false
      for (const id of next.keys()) {
        if (!articles.some(a => a.id === id)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [articles])

  const { downloadForOffline } = useOfflineArticle()
  const rssStoreData = useRSSStore() as any
  const { feeds = [], syncing = false, fetchFeeds, syncFeeds, autoSyncFeeds } = rssStoreData || {}
  const { suggestions, sourceId, sourceType, clearSuggestions } = useConnectionStore()
  const [activeTab, setActiveTab] = useState<FilterTab>('queue')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [inlineUrl, setInlineUrl] = useState('')
  const [inlineUrlFocused, setInlineUrlFocused] = useState(false)
  const [inlineSaving, setInlineSaving] = useState(false)
  const [rssItems, setRssItems] = useState<RSSItem[]>([])
  const [loadingRSS, setLoadingRSS] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [processingArticles, setProcessingArticles] = useState<Map<string, { status: string; url: string }>>(new Map())
  const processingRef = useRef<Set<string>>(new Set()) // Track processed URLs to prevent duplicates
  const autoRecoveryDone = useRef(false) // Track if we've done auto-recovery

  const { addToast } = useToast()

  const bulkSelection = useBulkSelection<Article>()

  // Dismissal log helpers
  const getDismissedItems = (): Set<string> => {
    try {
      const dismissed = localStorage.getItem('rss-dismissed-items')
      return dismissed ? new Set(JSON.parse(dismissed)) : new Set()
    } catch {
      return new Set()
    }
  }

  const addToDismissedLog = (guid: string) => {
    const dismissed = getDismissedItems()
    dismissed.add(guid)

    // Auto-cleanup: Remove items dismissed more than 90 days ago
    const now = Date.now()
    const dismissalTimestamps = JSON.parse(localStorage.getItem('rss-dismissed-timestamps') || '{}')
    dismissalTimestamps[guid] = now

    // Filter out old dismissals (90 days)
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000)
    const validGuids = Array.from(dismissed).filter(g => {
      const timestamp = dismissalTimestamps[g as string]
      return timestamp && timestamp > ninetyDaysAgo
    })

    // Keep only the last 1000 dismissed items to prevent localStorage bloat
    const trimmedGuids = validGuids.slice(-1000)

    localStorage.setItem('rss-dismissed-items', JSON.stringify(trimmedGuids))
    localStorage.setItem('rss-dismissed-timestamps', JSON.stringify(dismissalTimestamps))
  }

  // Fetch RSS feed items from all enabled feeds
  const fetchRSSItems = useCallback(async () => {
    setLoadingRSS(true)
    try {
      const allItems: RSSItem[] = []

      // Safely check if feeds exist and is an array
      if (!feeds || !Array.isArray(feeds)) {
        setRssItems([])
        setLoadingRSS(false)
        return
      }

      for (const feed of feeds.filter(f => f.enabled)) {
        try {
          // Fetch feed items using rss-parser via API
          const response = await fetch(`/api/reading?resource=rss&action=items&feed_id=${feed.id}`)
          if (response.ok) {
            const data = await response.json()
            if (data.items) {
              allItems.push(...data.items.map((item: any) => ({
                ...item,
                content: item.content || item.description || '', // Ensure content is populated
                feed_id: feed.id,
                feed_title: feed.title || 'Unknown Feed' // Fallback for title
              })))
            }
          }
        } catch (err) {
          console.error(`Failed to fetch items from feed ${feed.id}:`, err)
        }
      }

      // Sort by published date
      allItems.sort((a, b) => {
        const dateA = new Date(a.published_at || 0).getTime()
        const dateB = new Date(b.published_at || 0).getTime()
        return dateB - dateA
      })

      // Filter out dismissed items
      const dismissed = getDismissedItems()
      const filteredItems = allItems.filter(item => !dismissed.has(item.guid))

      setRssItems(filteredItems)
    } catch (error) {
      console.error('Failed to fetch RSS items:', error)
      addToast({
        title: 'Failed to load RSS updates',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoadingRSS(false)
    }
  }, [feeds, addToast])

  // Auto-recovery: Find and retry stuck articles on mount (excluding RSS)
  useEffect(() => {
    if (!autoRecoveryDone.current && articles.length > 0) {
      autoRecoveryDone.current = true

      // Filter out RSS articles - only auto-recover share sheet / manually saved articles
      const stuckArticles = articles.filter(a =>
        !a.processed &&
        !a.tags?.includes('rss') &&
        !a.tags?.includes('auto-imported')
      )

      if (stuckArticles.length > 0) {
        console.log(`[ReadingPage] Auto-recovery: Found ${stuckArticles.length} stuck share sheet article(s) (RSS filtered)`)

        stuckArticles.forEach(article => {
          const age = Date.now() - new Date(article.created_at).getTime()
          const ageMinutes = Math.floor(age / 60000)

          // Auto-recover all stuck articles (even if < 1min old, they're clearly stuck)
          // Zombie detection in ArticleProcessor will handle old articles immediately
          console.log(`[ReadingPage] Auto-recovery: Retrying ${article.id} (${ageMinutes}min old)`)

          setProcessingArticles(prev => new Map(prev).set(article.id, { status: 'extracting', url: article.url }))

          articleProcessor.startProcessing(article.id, article.url, (status, updatedArticle) => {
            setProcessingArticles(prev => {
              const next = new Map(prev)
              if (status === 'complete') {
                next.delete(article.id)
                addToast({
                  title: '✓ Graph Updated',
                  description: `Extracted ${updatedArticle?.entities?.length || 5} new knowledge nodes from "${updatedArticle?.title}"`,
                  variant: 'success',
                })
                fetchArticles(undefined, true) // Force refresh for auto-recovery
              } else if (status === 'retrying') {
                next.set(article.id, { status: 'retrying', url: article.url })
              } else if (status === 'failed') {
                next.delete(article.id)
                fetchArticles(undefined, true) // Force refresh for failed auto-recovery
              } else {
                next.set(article.id, { status, url: article.url })
              }
              return next
            })
          })
        })
      }
    }
  }, [articles, fetchArticles, addToast])

  // Data loading: show cached data instantly, background-revalidate from API
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    const loadData = async () => {
      // On back navigation, just revalidate in background — don't flash loading
      const isBackNav = hasInitializedRef.current && articles.length > 0
      await fetchArticles(undefined, isBackNav)

      // Only fetch feeds/sync once per mount, not on back navigation
      if (!hasInitializedRef.current) {
        await fetchFeeds()
        if (autoSyncFeeds) {
          autoSyncFeeds().catch(() => {})
        }
      }

      hasInitializedRef.current = true
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  useEffect(() => {
    if (activeTab === 'updates') {
      fetchRSSItems()
    }
  }, [activeTab]) // Only re-fetch when activeTab changes, fetchRSSItems is stable

  // Handle RSS sync
  const handleRSSSync = async () => {
    try {
      const result = await syncFeeds()
      addToast({
        title: 'Feeds synced!',
        description: `Added ${result.articlesAdded} new articles from ${result.feedsSynced} feeds`,
        variant: 'success',
      })
      fetchArticles() // Refresh articles
      fetchRSSItems() // Refresh RSS items
    } catch (error) {
      addToast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  // Handle saving RSS item to reading queue
  const handleSaveRSSItem = async (item: RSSItem) => {
    try {
      addToast({
        title: '📰 Fetching article...',
        description: 'Extracting content with Jina AI',
        variant: 'default',
      })

      const article = await saveArticle({ url: item.link })

      addToast({
        title: 'Injecting Knowledge...',
        description: `Added "${article.title || 'article'}" to your graph`,
        variant: 'success',
      })
      fetchArticles()
    } catch (error) {
      addToast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  // Handle reading RSS item - just open original link
  const handleReadRSSItem = async (item: RSSItem) => {
    // Simply open the original RSS article in a new tab
    // No need to extract/save - user can use "Save to Read Later" if they want offline access
    window.open(item.link, '_blank')
  }

  // Handle shared URLs from Web Share Target API with robust processing
  useEffect(() => {
    console.log('='.repeat(80))
    console.log('[ReadingPage] SHARE DETECTION START')
    console.log('[ReadingPage] Current URL:', location.pathname + location.search)

    const params = new URLSearchParams(location.search)

    // Check for 'shared', 'url', or 'text' parameters (robust fallback)
    let sharedParam = params.get('shared') || params.get('url')
    const textParam = params.get('text')

    // If no URL found yet, check if 'text' param contains a URL (common on Android)
    if (!sharedParam && textParam && (textParam.startsWith('http://') || textParam.startsWith('https://'))) {
      sharedParam = textParam
    }

    console.log('[ReadingPage] Extracted share URL:', sharedParam)

    const shareUrl: string | undefined = sharedParam || undefined

    if (shareUrl && !processingRef.current.has(shareUrl)) {
      console.log('[ReadingPage] ✓ Processing shared URL:', shareUrl)

      // Mark as processing to prevent duplicates
      processingRef.current.add(shareUrl)

      // Clean URL params to prevent re-processing on refresh
      if (window.location.search) {
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
        console.log('[ReadingPage] Cleaned URL params from address bar')
      }

      const handleShare = async () => {
        try {
          // Show loading toast
          addToast({
            title: '📰 Saving shared article...',
            description: 'Extracting content from ' + new URL(shareUrl).hostname,
            variant: 'default',
          })

          const article = await saveArticle({ url: shareUrl })
          console.log('[ReadingPage] Article saved successfully:', article.id)

          // Start robust background processing with retry
          setProcessingArticles(prev => new Map(prev).set(article.id, { status: 'extracting', url: shareUrl }))

          articleProcessor.startProcessing(article.id, shareUrl, (status, updatedArticle) => {
            setProcessingArticles(prev => {
              const next = new Map(prev)
              if (status === 'complete') {
                next.delete(article.id)
                addToast({
                  title: '✓ Article ready!',
                  description: updatedArticle?.title || 'Content extracted successfully',
                  variant: 'success',
                })

                // Auto-download for offline reading
                if (updatedArticle) {
                  downloadForOffline(updatedArticle).then(() => {
                    addToast({
                      title: 'Saved Offline',
                      description: 'Article and images available offline',
                      variant: 'success',
                    })
                  }).catch(err => console.warn('Failed to auto-download:', err))
                }

                fetchArticles(undefined, true) // Force refresh to show completed article (bypass cache)
              } else if (status === 'retrying') {
                next.set(article.id, { status: 'retrying', url: shareUrl })
                addToast({
                  title: '🔄 Retrying extraction...',
                  description: 'First attempt timed out, trying again',
                  variant: 'default',
                })
              } else if (status === 'failed') {
                next.delete(article.id)
                addToast({
                  title: 'Extraction failed',
                  description: 'Could not extract content. You can still view the original URL.',
                  variant: 'destructive',
                })
                fetchArticles(undefined, true) // Force refresh to show failed article status
              } else {
                next.set(article.id, { status, url: shareUrl })
              }
              return next
            })
          })

          addToast({
            title: '✓ Article saved!',
            description: 'Extracting content in background...',
            variant: 'success',
          })

          // Refresh list to show the new article
          await fetchArticles()
          console.log('[ReadingPage] Articles refreshed')
        } catch (error) {
          console.error('[ReadingPage] Failed to save shared article:', error)
          processingRef.current.delete(shareUrl)
          addToast({
            title: 'Failed to save',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          })
        }
      }

      handleShare()
    } else if (shareUrl) {
      console.log('[ReadingPage] URL already being processed, skipping duplicate')
    } else {
      console.log('[ReadingPage] No shared URL parameter found')
    }
    console.log('[ReadingPage] SHARE DETECTION END')
    console.log('='.repeat(80))
  }, [location.search, saveArticle, fetchArticles, addToast])

  // Listen for custom event from main.tsx when SW sends postMessage
  // This handles the case where the app is already on the reading page
  useEffect(() => {
    const handlePWAShare = (event: CustomEvent) => {
      const sharedUrl = event.detail?.shared
      if (sharedUrl && !processingRef.current.has(sharedUrl)) {
        console.log('[ReadingPage] Custom event received, processing shared URL:', sharedUrl)

        // Mark as processing to prevent duplicates
        processingRef.current.add(sharedUrl)

        const processShare = async () => {
          try {
            addToast({
              title: '📰 Saving shared article...',
              description: 'Extracting content from ' + new URL(sharedUrl).hostname,
              variant: 'default',
            })

            const article = await saveArticle({ url: sharedUrl })
            console.log('[ReadingPage] Article saved successfully:', article.id)

            // Start robust background processing with retry
            setProcessingArticles(prev => new Map(prev).set(article.id, { status: 'extracting', url: sharedUrl }))

            articleProcessor.startProcessing(article.id, sharedUrl, (status, updatedArticle) => {
              setProcessingArticles(prev => {
                const next = new Map(prev)
                if (status === 'complete') {
                  next.delete(article.id)
                  addToast({
                    title: '✓ Article ready!',
                    description: updatedArticle?.title || 'Content extracted successfully',
                    variant: 'success',
                  })

                  // Auto-download for offline reading
                  if (updatedArticle) {
                    downloadForOffline(updatedArticle).then(() => {
                      addToast({
                        title: 'Saved Offline',
                        description: 'Article and images available offline',
                        variant: 'success',
                      })
                    }).catch(err => console.warn('Failed to auto-download:', err))
                  }

                  fetchArticles(undefined, true) // Force refresh for postMessage share
                } else if (status === 'retrying') {
                  next.set(article.id, { status: 'retrying', url: sharedUrl })
                  addToast({
                    title: '🔄 Retrying extraction...',
                    description: 'First attempt timed out, trying again',
                    variant: 'default',
                  })
                } else if (status === 'failed') {
                  next.delete(article.id)
                  addToast({
                    title: 'Extraction failed',
                    description: 'Could not extract content. You can still view the original URL.',
                    variant: 'destructive',
                  })
                  fetchArticles(undefined, true) // Force refresh for failed postMessage share
                } else {
                  next.set(article.id, { status, url: sharedUrl })
                }
                return next
              })
            })

            addToast({
              title: '✓ Article saved!',
              description: 'Extracting content in background...',
              variant: 'success',
            })

            await fetchArticles()
            console.log('[ReadingPage] Articles refreshed')
          } catch (error) {
            console.error('[ReadingPage] Failed to save shared article:', error)
            processingRef.current.delete(sharedUrl)
            addToast({
              title: 'Failed to save',
              description: error instanceof Error ? error.message : 'Unknown error',
              variant: 'destructive',
            })
          }
        }

        processShare()
      } else if (sharedUrl) {
        console.log('[ReadingPage] Custom event URL already being processed, skipping duplicate')
      }
    }

    window.addEventListener('pwa-share', handlePWAShare as EventListener)
    return () => {
      window.removeEventListener('pwa-share', handlePWAShare as EventListener)
    }
  }, [saveArticle, fetchArticles, addToast])

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab)
    if (tab !== 'queue' && tab !== 'updates') {
      setFilter(tab as ArticleStatus)
    }
  }

  // Inline URL save handler
  const handleInlineSave = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const url = inlineUrl.trim()
    if (!url) return

    setInlineSaving(true)
    try {
      const article = await saveArticle({ url })
      addToast({
        title: 'Article saved!',
        description: 'Added to your queue',
        variant: 'success',
      })
      setInlineUrl('')

      // Background processing
      if (!article.id.startsWith('temp-')) {
        setProcessingArticles(prev => new Map(prev).set(article.id, { status: 'extracting', url }))
        articleProcessor.startProcessing(article.id, url, async (status, updatedArticle) => {
          setProcessingArticles(prev => {
            const next = new Map(prev)
            if (status === 'complete') {
              next.delete(article.id)
              addToast({
                title: 'Article ready!',
                description: updatedArticle?.title || 'Content extracted successfully',
                variant: 'success',
              })
              fetchArticles(undefined, true)
            } else if (status === 'failed') {
              next.delete(article.id)
              fetchArticles(undefined, true)
            } else {
              next.set(article.id, { status, url })
            }
            return next
          })
        })
      }

      await fetchArticles()
    } catch (error) {
      addToast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setInlineSaving(false)
    }
  }, [inlineUrl, saveArticle, fetchArticles, addToast])

  // Pull-to-refresh handler - forces a fresh fetch from API
  const handlePullToRefresh = useCallback(async () => {
    await fetchArticles(undefined, true)
    if (activeTab === 'updates') {
      await fetchRSSItems()
    }
  }, [fetchArticles, activeTab, fetchRSSItems])

  // Memoize safe articles to prevent useMemo dependency issues
  // NOTE: The store already merges pendingArticles with server articles,
  // so we don't need to merge them again here. Doing so causes duplicates
  // and flickering counts.
  const safeArticles = React.useMemo(() => {
    return Array.isArray(articles) ? articles : []
  }, [articles])

  const filteredArticles = React.useMemo(() => {
    if (!Array.isArray(safeArticles) || safeArticles.length === 0) return []

    if (activeTab === 'queue') {
      return safeArticles.filter((a) => a.status !== 'archived' && !(a.tags && a.tags.includes('rss')))
    } else if (activeTab === 'updates') {
      return [] // RSS items are handled separately
    } else if (activeTab === 'unread') {
      return safeArticles.filter((a) => a.status === 'unread' && !(a.tags && a.tags.includes('rss')))
    } else if (activeTab === 'reading') {
      return safeArticles.filter((a) => a.status === 'reading')
    } else {
      return safeArticles.filter((a) => a.status === activeTab)
    }
  }, [safeArticles, activeTab])

  // In-progress articles for "Continue Reading" section
  const continueReadingArticles = React.useMemo(() => {
    if (!Array.isArray(safeArticles)) return []
    return safeArticles.filter((a) => a.status === 'reading')
  }, [safeArticles])

  // Progressive rendering: show 20 articles at a time to avoid rendering 50+ DOM nodes
  const ARTICLES_PER_PAGE = 20
  const [visibleCount, setVisibleCount] = useState(ARTICLES_PER_PAGE)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Reset visible count when tab changes
  useEffect(() => {
    setVisibleCount(ARTICLES_PER_PAGE)
  }, [activeTab])

  // Intersection observer to load more articles as user scrolls
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || visibleCount >= filteredArticles.length) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(prev => Math.min(prev + ARTICLES_PER_PAGE, filteredArticles.length))
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, filteredArticles.length])

  const visibleArticles = React.useMemo(
    () => filteredArticles.slice(0, visibleCount),
    [filteredArticles, visibleCount]
  )

  // Count for tabs
  const getTabCount = (tab: FilterTab): number | string => {
    if (!Array.isArray(safeArticles)) return 0
    if (tab === 'queue') return safeArticles.filter(a => a.status !== 'archived' && !(a.tags && a.tags.includes('rss'))).length
    if (tab === 'unread') return safeArticles.filter(a => a.status === 'unread' && !(a.tags && a.tags.includes('rss'))).length
    if (tab === 'reading') return safeArticles.filter(a => a.status === 'reading').length
    if (tab === 'updates') {
      const currentCount = Array.isArray(rssItems) ? rssItems.length : 0
      // Show current count with + to indicate there may be more on next reload
      // Only show a count if there are actually visible items
      if (currentCount > 0) {
        return `${currentCount}+`
      }
      return 0
    }
    return safeArticles.filter(a => a.status === tab).length
  }

  const tabs = [
    { id: 'queue', label: 'All', count: getTabCount('queue') },
    { id: 'unread', label: 'Unread', count: getTabCount('unread') },
    { id: 'reading', label: 'Reading', count: getTabCount('reading') },
    { id: 'archived', label: 'Archived', count: getTabCount('archived') },
    { id: 'updates', label: 'RSS', count: getTabCount('updates') },
  ]

  // Bulk actions handlers
  const handleBulkArchive = async () => {
    setBulkActionLoading(true)
    try {
      const selected = bulkSelection.getSelectedItems(filteredArticles)
      await Promise.all(selected.map(article => updateArticleStatus(article.id, 'archived')))

      addToast({
        title: 'Archived!',
        description: `${selected.length} article${selected.length > 1 ? 's' : ''} archived`,
        variant: 'success',
      })

      bulkSelection.exitSelectionMode()
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to archive articles',
        variant: 'destructive',
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${bulkSelection.selectedCount} article${bulkSelection.selectedCount > 1 ? 's' : ''}?`)) {
      return
    }

    setBulkActionLoading(true)
    try {
      const selected = bulkSelection.getSelectedItems(filteredArticles)
      await Promise.all(selected.map(article => deleteArticle(article.id)))

      addToast({
        title: 'Deleted!',
        description: `${selected.length} article${selected.length > 1 ? 's' : ''} removed`,
        variant: 'success',
      })

      bulkSelection.exitSelectionMode()
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to delete articles',
        variant: 'destructive',
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  return (
    <>
      <SubtleBackground />
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40" style={{
        backgroundColor: '#0a0f1a',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 0 rgba(0,0,0,0.6)',
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 pb-2 flex flex-col gap-2">
          {/* Top row: icon + filter tabs + search */}
          <div className="flex items-center gap-3">
            <div className="flex items-center flex-shrink-0" style={{
              color: 'rgba(34, 211, 238, 0.8)',
              opacity: 0.8
            }}>
              <BookOpen className="h-6 w-6" />
            </div>

            {/* Filter Tabs */}
            <PremiumTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={handleTabChange}
              className="flex-nowrap flex-1 min-w-0"
            />

            <button
              onClick={() => navigate('/search')}
              className="h-9 w-9 rounded-sm flex items-center justify-center transition-all flex-shrink-0"
              style={{ color: 'rgba(34,211,238,0.8)', border: '2px solid rgba(34,211,238,0.25)', boxShadow: '2px 2px 0 rgba(0,0,0,0.5)' }}
              title="Search everything"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          {/* Inline URL save bar */}
          <form onSubmit={handleInlineSave} className="flex items-center gap-2 pb-1">
            <div
              className="flex items-center gap-2 flex-1 rounded-sm px-3 h-10 transition-all duration-200"
              style={{
                backgroundColor: '#111113',
                border: inlineUrlFocused ? '2px solid rgba(34,211,238,0.5)' : '2px solid rgba(255,255,255,0.12)',
                boxShadow: inlineUrlFocused ? '3px 3px 0 rgba(34,211,238,0.1)' : '3px 3px 0 rgba(0,0,0,0.6)',
              }}
            >
              <LinkIcon className="h-4 w-4 flex-shrink-0" style={{ color: inlineUrlFocused ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.25)' }} />
              <input
                type="url"
                placeholder="Paste a URL to save for later..."
                value={inlineUrl}
                onChange={(e) => setInlineUrl(e.target.value)}
                onFocus={() => setInlineUrlFocused(true)}
                onBlur={() => setInlineUrlFocused(false)}
                autoComplete="off"
                className="flex-1 h-full border-0 text-sm focus:outline-none focus:ring-0 placeholder:text-white/20 appearance-none bg-transparent"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              />
              {inlineUrl && (
                <button
                  type="button"
                  onClick={() => setInlineUrl('')}
                  className="text-xs flex-shrink-0 opacity-40 hover:opacity-70 transition-opacity px-1"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={inlineSaving || !inlineUrl.trim()}
              className="h-10 px-4 rounded-sm text-[11px] font-black uppercase tracking-wide flex-shrink-0 flex items-center gap-1.5 transition-all disabled:opacity-40"
              style={{
                backgroundColor: 'rgba(34, 211, 238, 0.1)',
                color: 'rgba(34, 211, 238, 0.95)',
                border: '2px solid rgba(34, 211, 238, 0.4)',
                boxShadow: '3px 3px 0 rgba(0,0,0,0.6)',
              }}
            >
              {inlineSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Save
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <PullToRefresh onRefresh={handlePullToRefresh} className="min-h-screen pb-24 relative z-10 pt-[7.5rem]">

        {/* Processing Indicator */}
        {processingArticles.size > 0 && (
          <div className="fixed top-24 left-0 right-0 z-30 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              {Array.from(processingArticles.entries()).map(([articleId, { status, url }]) => (
                <div
                  key={articleId}
                  className="rounded-sm p-4 mb-2 flex items-center gap-3"
                  style={{
                    backgroundColor: '#111113',
                    border: `2px solid ${status === 'retrying' ? 'rgba(251,191,36,0.5)' : 'rgba(99,179,237,0.5)'}`,
                    boxShadow: `3px 3px 0 ${status === 'retrying' ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.7)'}`,
                  }}
                >
                  {status === 'retrying' ? (
                    <RotateCw className="h-5 w-5 animate-spin" style={{ color: 'var(--premium-amber)' }} />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--premium-blue)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: 'var(--premium-text-primary)' }}>
                      {status === 'retrying' ? 'Retrying extraction...' : 'Extracting article...'}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--premium-text-tertiary)' }}>
                      {new URL(url).hostname}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // 1. Cancel local processing
                      articleProcessor.cancelProcessing(articleId)

                      // 2. Mark as processed & failed in DB so it doesn't auto-retry on reload
                      updateArticle(articleId, {
                        processed: true,
                        excerpt: 'Extraction cancelled by user.'
                      }).catch(console.error)

                      // 3. Remove from UI
                      setProcessingArticles(prev => {
                        const next = new Map(prev)
                        next.delete(articleId)
                        return next
                      })

                      addToast({
                        title: 'Cancelled',
                        description: 'Extraction stopped. You can retry later or view original.',
                        variant: 'default',
                      })
                    }}
                    className="text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-sm transition-colors"
                    style={{ color: 'rgba(255,255,255,0.45)', border: '1.5px solid rgba(255,255,255,0.12)' }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue Reading — Zeigarnik effect: surface in-progress articles prominently */}
        <AnimatePresence>
          {continueReadingArticles.length > 0 && activeTab !== 'reading' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 pt-2"
              style={{ marginTop: processingArticles.size > 0 ? `${processingArticles.size * 72}px` : '0' }}
            >
              <div
                className="rounded-sm p-4"
                style={{
                  background: '#111113',
                  border: '1.5px solid rgba(34,211,238,0.2)',
                  borderLeft: '4px solid rgba(34,211,238,0.7)',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.7)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Play className="h-4 w-4 fill-current" style={{ color: 'rgba(34,211,238,0.8)' }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'rgba(34,211,238,0.9)' }}>
                    Continue Reading
                  </span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(34,211,238,0.15)', color: 'rgba(34,211,238,0.8)', border: '1px solid rgba(34,211,238,0.25)' }}>
                    {continueReadingArticles.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {continueReadingArticles.slice(0, 3).map((article) => (
                    <button
                      key={article.id}
                      onClick={() => navigate(`/reading/${article.id}`)}
                      className="flex items-center gap-3 w-full text-left rounded-sm p-2.5 transition-all group"
                      style={{ border: '1.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {article.title || 'Untitled'}
                        </p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {article.source || (article.url ? new URL(article.url).hostname.replace('www.', '') : '')}
                          {article.read_time_minutes ? ` · ${article.read_time_minutes} min read` : ''}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity" style={{ color: 'rgba(34,211,238,0.7)' }} />
                    </button>
                  ))}
                  {continueReadingArticles.length > 3 && (
                    <button
                      onClick={() => handleTabChange('reading')}
                      className="text-xs font-medium transition-all hover:opacity-80 text-left pl-2.5 pt-1"
                      style={{ color: 'rgba(34,211,238,0.6)' }}
                    >
                      +{continueReadingArticles.length - 3} more in progress →
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content - Outer Card Structure */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2" style={{ marginTop: continueReadingArticles.length > 0 && activeTab !== 'reading' ? '0' : (processingArticles.size > 0 ? `${processingArticles.size * 72}px` : '0') }}>
          <div className="p-5 rounded-sm mb-6" style={{
            background: '#0d0f14',
            border: '2px solid rgba(255,255,255,0.1)',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.8)',
          }}>
            {/* Title Section */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 flex-shrink-0" style={{ background: 'rgba(34,211,238,0.7)' }} />
                <h2 className="text-[13px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {activeTab === 'updates' ? 'News feeds' :
                   activeTab === 'archived' ? 'Archive' :
                   activeTab === 'reading' ? 'In progress' :
                   activeTab === 'unread' ? 'Unread' :
                   'Reading queue'}
                </h2>
              </div>

              {activeTab === 'updates' && (
                <button
                  onClick={() => navigate('/rss')}
                  className="px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wide transition-all flex items-center gap-1.5"
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    border: '2px solid rgba(255,255,255,0.15)',
                    boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                  }}
                >
                  <Rss className="h-3.5 w-3.5" />
                  Manage feeds
                </button>
              )}
            </div>

            {/* Reading Provocation */}
            {activeTab === 'queue' && <ReadingProvocation />}

            {/* Inner Content */}
            <div>
              {/* Updates Tab - RSS Feed Items */}
              {activeTab === 'updates' && (
                <>
                  {loadingRSS && rssItems.length === 0 ? (
                    <SkeletonCard variant="list" count={5} />
                  ) : (!feeds || !Array.isArray(feeds) || feeds.length === 0) ? (
                    <EmptyState
                      icon={Rss}
                      title="No RSS feeds yet"
                      description="Subscribe to RSS feeds in Settings to see updates here"
                    />
                  ) : (!rssItems || !Array.isArray(rssItems) || rssItems.length === 0) ? (
                    <EmptyState
                      icon={BookOpen}
                      title="No updates yet"
                      description='Click "Sync Feeds" to fetch latest articles from your RSS feeds'
                      action={
                        <button
                          onClick={handleRSSSync}
                          disabled={syncing}
                          className="premium-glass rounded-full px-6 py-3 font-medium inline-flex items-center gap-2 transition-all hover:bg-white/10"
                          style={{
                            color: syncing ? 'var(--premium-text-tertiary)' : 'var(--premium-blue)',
                            opacity: syncing ? 0.5 : 1
                          }}
                        >
                          <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                          {syncing ? 'Syncing...' : 'Sync feeds'}
                        </button>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 space-y-0">
                      {rssItems.map((item) => (
                        <div key={item.guid} className="break-inside-avoid" style={{ contain: 'content' }}>
                          <RSSFeedItem
                            item={item}
                            onSave={() => handleSaveRSSItem(item)}
                            onRead={() => handleReadRSSItem(item)}
                            onDismiss={() => {
                              // Add to permanent dismissal log
                              addToDismissedLog(item.guid)
                              // Remove from local state
                              setRssItems(prev => prev.filter(i => i.guid !== item.guid))
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Regular Articles - Queue/Unread/Archived */}
              {activeTab !== 'updates' && (
                <>
                  {loading && articles.length === 0 ? (
                    <SkeletonCard variant="default" count={4} />
                  ) : filteredArticles.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title={
                        activeTab === 'queue' ? 'Your reading queue is empty' :
                        activeTab === 'unread' ? 'No unread articles' :
                        activeTab === 'reading' ? 'Nothing in progress' :
                        activeTab === 'archived' ? 'No archived articles' :
                        `No ${activeTab} articles`
                      }
                      description={
                        activeTab === 'queue'
                          ? 'Paste any URL in the bar above to save articles, blog posts, or essays for later reading'
                          : activeTab === 'unread'
                          ? 'All caught up! Articles you save will appear here'
                          : activeTab === 'reading'
                          ? 'Start reading an article and it will appear here so you can continue where you left off'
                          : `You don't have any ${activeTab} articles yet`
                      }
                      action={
                        activeTab === 'queue' ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex flex-wrap justify-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {['blog posts', 'essays', 'research papers', 'news articles', 'tutorials'].map(example => (
                                <span key={example} className="px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide" style={{ background: '#111113', border: '1.5px solid rgba(255,255,255,0.12)', boxShadow: '2px 2px 0 rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.4)' }}>
                                  {example}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : undefined
                      }
                    />
                  ) : (
                    <FocusableList>
                      <div className="columns-2 md:columns-2 lg:columns-3 gap-4 space-y-4">
                        {visibleArticles.map((article) => {
                          const isSelected = bulkSelection.isSelected(article.id)
                          const isPending = article.id.startsWith('temp-')

                          return (
                            <div key={article.id} className="mb-4 break-inside-avoid">
                              <FocusableItem id={article.id} type="article">
                                <div
                                  className={`relative ${bulkSelection.isSelectionMode ? 'cursor-pointer' : ''}`}
                                  onClick={(e) => {
                                    if (bulkSelection.isSelectionMode) {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      bulkSelection.toggleSelection(article.id)
                                    }
                                  }}
                                  style={{
                                    pointerEvents: bulkSelection.isSelectionMode ? 'auto' : 'none',
                                    opacity: isPending ? 0.7 : 1
                                  }}
                                >
                                  {bulkSelection.isSelectionMode && (
                                    <div
                                      className="absolute top-4 left-4 z-10 w-6 h-6 rounded-sm flex items-center justify-center transition-all"
                                      style={{
                                        backgroundColor: isSelected ? 'rgba(59,130,246,0.9)' : '#111113',
                                        border: isSelected ? '2px solid rgb(96,165,250)' : '2px solid rgba(255,255,255,0.2)',
                                        boxShadow: '2px 2px 0 rgba(0,0,0,0.6)',
                                        pointerEvents: 'auto'
                                      }}
                                    >
                                      {isSelected && <Check className="h-4 w-4 text-white" />}
                                    </div>
                                  )}
                                  <div style={{ pointerEvents: 'auto' }}>
                                    <ArticleCard
                                      article={article}
                                      onClick={() => !bulkSelection.isSelectionMode && navigate(`/reading/${article.id}`)}
                                    />
                                  </div>
                                </div>
                              </FocusableItem>
                            </div>
                          )
                        })}
                      </div>
                      {visibleCount < filteredArticles.length && (
                        <div ref={loadMoreRef} className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--premium-text-secondary)' }} />
                        </div>
                      )}
                    </FocusableList>
                  )}
                </>
              )}
            </div>
          </div>
        </div >

        {/* Save Article Dialog */}
        <Suspense fallback={null}>
          <SaveArticleDialog
            open={showSaveDialog}
            onClose={() => setShowSaveDialog(false)
            }
          />
        </Suspense>

        {/* Connection Suggestions */}
        {
          suggestions && Array.isArray(suggestions) && suggestions.length > 0 && sourceType === 'article' && (
            <ConnectionSuggestion
              suggestions={suggestions}
              sourceType={sourceType}
              sourceId={sourceId!}
              onLinkCreated={(targetId, targetType) => {
                addToast({
                  title: 'Connection created!',
                  description: `Linked to ${targetType}`,
                  variant: 'success',
                })
              }}
              onDismiss={clearSuggestions}
            />
          )
        }

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={bulkSelection.selectedCount}
          onCancel={bulkSelection.exitSelectionMode}
          actions={[
            {
              label: 'Archive',
              icon: <Archive className="h-4 w-4" />,
              onClick: handleBulkArchive,
              loading: bulkActionLoading,
            },
            {
              label: 'Delete',
              icon: <Trash2 className="h-4 w-4" />,
              onClick: handleBulkDelete,
              variant: 'destructive' as const,
              loading: bulkActionLoading,
            },
          ]}
        />

        {/* Processing Debug Panel */}
        <Suspense fallback={null}>
          <ProcessingDebugPanel
            articles={safeArticles}
            onRetry={(articleId, url) => {
            setProcessingArticles(prev => new Map(prev).set(articleId, { status: 'extracting', url }))

            articleProcessor.startProcessing(articleId, url, (status, updatedArticle) => {
              setProcessingArticles(prev => {
                const next = new Map(prev)
                if (status === 'complete') {
                  next.delete(articleId)
                  addToast({
                    title: '✓ Article ready!',
                    description: updatedArticle?.title || 'Content extracted successfully',
                    variant: 'success',
                  })
                  fetchArticles()
                } else if (status === 'retrying') {
                  next.set(articleId, { status: 'retrying', url })
                } else if (status === 'failed') {
                  next.delete(articleId)
                  addToast({
                    title: 'Extraction failed',
                    description: 'Could not extract content after retries',
                    variant: 'destructive',
                  })
                  fetchArticles()
                } else {
                  next.set(articleId, { status, url })
                }
                return next
              })
            })
          }}
          onFlushAll={async () => {
            const stuckArticles = safeArticles.filter(a =>
              !a.processed &&
              !a.tags?.includes('rss') &&
              !a.tags?.includes('auto-imported')
            )

            addToast({
              title: 'Flushing stuck articles...',
              description: `Deleting ${stuckArticles.length} article(s)`,
              variant: 'default',
            })

            try {
              await Promise.all(
                stuckArticles.map(article => deleteArticle(article.id))
              )

              addToast({
                title: '✓ Queue flushed!',
                description: `Deleted ${stuckArticles.length} stuck article(s)`,
                variant: 'success',
              })

              await fetchArticles()
            } catch (error) {
              addToast({
                title: 'Failed to flush',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
              })
            }
          }}
          />
        </Suspense>
      </PullToRefresh>
    </>
  )
}