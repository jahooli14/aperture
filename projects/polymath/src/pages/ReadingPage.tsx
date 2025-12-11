/**
 * Reading Queue Page
 * Displays saved articles with filtering and save functionality
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Virtuoso } from 'react-virtuoso'
import { Plus, Loader2, BookOpen, Archive, List, Rss, RefreshCw, CheckSquare, Trash2, Tag, Check, Search, FileText, AlertCircle, RotateCw } from 'lucide-react'
import { useReadingStore } from '../stores/useReadingStore'
import { useReadingQueue } from '../hooks/useReadingQueue'
import { useOfflineArticle } from '../hooks/useOfflineArticle'
import { ArticleCard } from '../components/reading/ArticleCard'
import { SaveArticleDialog } from '../components/reading/SaveArticleDialog'
import { RSSFeedItem } from '../components/reading/RSSFeedItem'
import { ProcessingDebugPanel } from '../components/reading/ProcessingDebugPanel'
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
import { SubtleBackground } from '../components/SubtleBackground'
import type { ArticleStatus } from '../types/reading'
import type { RSSFeedItem as RSSItem } from '../types/rss'
import type { Article } from '../types/reading'

type FilterTab = 'queue' | 'updates' | ArticleStatus

export function ReadingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { articles, pendingArticles, loading, fetchArticles, currentFilter, setFilter, saveArticle, updateArticleStatus, deleteArticle } = useReadingStore()

  // Use React Query for data fetching
  const { isLoading: isQueryLoading } = useReadingQueue()
  const { downloadForOffline } = useOfflineArticle()
  const rssStoreData = useRSSStore() as any
  const { feeds = [], syncing = false, fetchFeeds, syncFeeds, autoSyncFeeds } = rssStoreData || {}
  const { suggestions, sourceId, sourceType, clearSuggestions } = useConnectionStore()
  const [activeTab, setActiveTab] = useState<FilterTab>('queue')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [rssItems, setRssItems] = useState<RSSItem[]>([])
  const [loadingRSS, setLoadingRSS] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [processingArticles, setProcessingArticles] = useState<Map<string, { status: string; url: string }>>(new Map())
  const processingRef = useRef<Set<string>>(new Set()) // Track processed URLs to prevent duplicates
  const autoRecoveryDone = useRef(false) // Track if we've done auto-recovery

  // Load lastKnownUpdatesCount from localStorage on mount
  const [lastKnownUpdatesCount, setLastKnownUpdatesCount] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('rss-last-known-count')
      return stored ? parseInt(stored, 10) : 0
    } catch {
      return 0
    }
  })

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
                feed_id: feed.id,
                feed_title: feed.title
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

      // Track the last known count based on total items (before filtering dismissals)
      // This persists even when all items are dismissed
      if (allItems.length > 0) {
        setLastKnownUpdatesCount(allItems.length)
        // Persist to localStorage so it survives navigation
        localStorage.setItem('rss-last-known-count', allItems.length.toString())
      }
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

  // React Query handles fetching now
  useEffect(() => {
    const loadData = async () => {
      await fetchArticles()
      await fetchFeeds()

      // Auto-sync RSS feeds in background (throttled to 2 hours)
      if (autoSyncFeeds) {
        autoSyncFeeds().catch(() => {
          // Silently fail - it's a background operation
        })
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]) // Re-run when navigating to this page

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

      await saveArticle({ url: item.link })

      addToast({
        title: 'Injecting Knowledge...',
        description: 'Adding article to your graph queue',
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
      setFilter(tab)
    }
  }

  // Memoize safe articles to prevent useMemo dependency issues
  const safeArticles = React.useMemo(() => {
    // Combine real articles with pending articles
    // Filter out duplicates (if any pending article is now in real articles)
    const realIds = new Set(articles.map(a => a.id))
    const uniquePending = pendingArticles.filter(a => !realIds.has(a.id))

    const allArticles = [...uniquePending, ...articles]
    return Array.isArray(allArticles) ? allArticles : []
  }, [articles, pendingArticles])

  const filteredArticles = React.useMemo(() => {
    if (!Array.isArray(safeArticles) || safeArticles.length === 0) return []

    if (activeTab === 'queue') {
      return safeArticles.filter((a) => a.status !== 'archived' && !(a.tags && a.tags.includes('rss')))
    } else if (activeTab === 'updates') {
      return [] // RSS items are handled separately
    } else {
      return safeArticles.filter((a) => a.status === activeTab)
    }
  }, [safeArticles, activeTab])

  // Count for tabs
  const getTabCount = (tab: FilterTab): number | string => {
    if (!Array.isArray(safeArticles)) return 0
    if (tab === 'queue') return safeArticles.filter(a => a.status !== 'archived' && !(a.tags && a.tags.includes('rss'))).length
    if (tab === 'updates') {
      const currentCount = Array.isArray(rssItems) ? rssItems.length : 0
      // Show current count if we have items
      // Show last known count with + if all items dismissed but we had items before
      // Always show with + to indicate there may be more on next reload
      if (currentCount > 0) {
        return `${currentCount}+`
      } else if (lastKnownUpdatesCount > 0) {
        return `${lastKnownUpdatesCount}+`
      }
      return 0
    }
    return safeArticles.filter(a => a.status === tab).length
  }

  const tabs = [
    { id: 'queue', label: 'Inbox', count: getTabCount('queue') },
    { id: 'updates', label: 'Updates', count: getTabCount('updates') },
    { id: 'archived', label: 'Archived', count: getTabCount('archived') },
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
      <div className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md" style={{
        backgroundColor: 'rgba(15, 24, 41, 0.7)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center" style={{
            color: 'var(--premium-blue)',
            opacity: 0.7
          }}>
            <FileText className="h-7 w-7" />
          </div>



          {/* Filter Tabs */}
          <PremiumTabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            className="flex-nowrap"
          />

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
              style={{
                color: 'var(--premium-blue)'
              }}
              title="New Article"
            >
              <Plus className="h-5 w-5" />
            </button>

            <button
              onClick={() => navigate('/search')}
              className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
              style={{
                color: 'var(--premium-blue)'
              }}
              title="Search everything"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-screen pb-24 relative z-10" style={{ paddingTop: '5.5rem' }}>

        {/* Processing Indicator */}
        {processingArticles.size > 0 && (
          <div className="fixed top-24 left-0 right-0 z-30 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              {Array.from(processingArticles.entries()).map(([articleId, { status, url }]) => (
                <div
                  key={articleId}
                  className="premium-glass rounded-xl p-4 mb-2 flex items-center gap-3"
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    borderColor: status === 'retrying' ? 'var(--premium-amber)' : 'var(--premium-blue)',
                    borderWidth: '1px',
                    borderStyle: 'solid'
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
                      articleProcessor.cancelProcessing(articleId)
                      setProcessingArticles(prev => {
                        const next = new Map(prev)
                        next.delete(articleId)
                        return next
                      })
                    }}
                    className="text-xs px-3 py-1 rounded-lg hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--premium-text-tertiary)' }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content - Outer Card Structure */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2" style={{ marginTop: processingArticles.size > 0 ? `${processingArticles.size * 72}px` : '0' }}>
          <div className="p-6 rounded-xl backdrop-blur-xl mb-6" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Title Section */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                {activeTab === 'updates' ? (
                  <>Your <span style={{ color: 'var(--premium-blue)' }}>news feeds</span></>
                ) : activeTab === 'archived' ? (
                  <>Your reading <span style={{ color: 'var(--premium-blue)' }}>archive</span></>
                ) : (
                  <>Your <span style={{ color: 'var(--premium-blue)' }}>reading material</span></>
                )}
              </h2>
            </div>

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
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                      {rssItems.map((item) => (
                        <div key={item.guid} className="break-inside-avoid mb-4" style={{ contain: 'content' }}>
                          <RSSFeedItem
                            item={item}
                            onSave={() => handleSaveRSSItem(item)}
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
                      title={activeTab === 'queue' ? 'No articles in your inbox yet' : `No ${activeTab} articles`}
                      description={
                        activeTab === 'queue'
                          ? 'Save your first article to start building your inbox'
                          : `You don't have any ${activeTab} articles yet`
                      }
                      action={
                        activeTab === 'queue' ? (
                          <button
                            onClick={() => setShowSaveDialog(true)}
                            className="premium-glass rounded-full px-6 py-3 font-medium inline-flex items-center gap-2 transition-all hover:bg-white/10"
                            style={{
                              color: 'var(--premium-blue)'
                            }}
                          >
                            <Plus className="h-5 w-5" />
                            Save Your First Article
                          </button>
                        ) : undefined
                      }
                    />
                  ) : (
                    <FocusableList>
                      <div className="columns-2 md:columns-2 lg:columns-3 gap-4 space-y-4">
                        {filteredArticles.map((article) => {
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
                                    // Allow drag events to pass through when not in selection mode
                                    pointerEvents: bulkSelection.isSelectionMode ? 'auto' : 'none',
                                    opacity: isPending ? 0.7 : 1
                                  }}
                                >
                                  {bulkSelection.isSelectionMode && (
                                    <div
                                      className="absolute top-4 left-4 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                                      style={{
                                        backgroundColor: isSelected ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.05)',
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
                    </FocusableList>
                  )}
                </>
              )}
            </div>
          </div>
        </div >

        {/* Save Article Dialog */}
        < SaveArticleDialog
          open={showSaveDialog}
          onClose={() => setShowSaveDialog(false)
          }
        />

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
      </div >
    </>
  )
}