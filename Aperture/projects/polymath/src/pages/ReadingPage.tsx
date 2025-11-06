/**
 * Reading Queue Page
 * Displays saved articles with filtering and save functionality
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Virtuoso } from 'react-virtuoso'
import { Plus, Loader2, BookOpen, Archive, List, Rss, RefreshCw, CheckSquare, Trash2, Tag, Check } from 'lucide-react'
import { useReadingStore } from '../stores/useReadingStore'
import { useRSSStore } from '../stores/useRSSStore'
import { ArticleCard } from '../components/reading/ArticleCard'
import { SaveArticleDialog } from '../components/reading/SaveArticleDialog'
import { RSSFeedItem } from '../components/reading/RSSFeedItem'
import { PullToRefresh } from '../components/PullToRefresh'
import { useShareTarget } from '../hooks/useShareTarget'
import { useToast } from '../components/ui/toast'
import { useConnectionStore } from '../stores/useConnectionStore'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { useBulkSelection } from '../hooks/useBulkSelection'
import { BulkActionsBar } from '../components/BulkActionsBar'
import type { ArticleStatus } from '../types/reading'
import type { RSSFeedItem as RSSItem } from '../types/rss'
import type { Article } from '../types/reading'

type FilterTab = 'queue' | 'updates' | ArticleStatus

export function ReadingPage() {
  const navigate = useNavigate()
  const { articles, loading, fetchArticles, currentFilter, setFilter, saveArticle, updateArticleStatus, deleteArticle } = useReadingStore()
  const { feeds, syncing, fetchFeeds, syncFeeds, autoSyncFeeds } = useRSSStore() as any
  const { suggestions, sourceId, sourceType, clearSuggestions } = useConnectionStore()
  const [activeTab, setActiveTab] = useState<FilterTab>('queue')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [rssItems, setRssItems] = useState<RSSItem[]>([])
  const [loadingRSS, setLoadingRSS] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
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

  useEffect(() => {
    fetchArticles()
    fetchFeeds()

    // Auto-sync RSS feeds in background (throttled to 2 hours)
    if (autoSyncFeeds) {
      autoSyncFeeds().catch(() => {
        // Silently fail - it's a background operation
      })
    }
  }, [fetchArticles, fetchFeeds, autoSyncFeeds])

  useEffect(() => {
    if (activeTab === 'updates') {
      fetchRSSItems()
    }
  }, [activeTab])

  // Fetch RSS feed items from all enabled feeds
  const fetchRSSItems = async () => {
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
  }

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
        title: 'Article saved!',
        description: 'Added to your reading queue',
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

  // Handle shared URLs from Android Share Sheet
  useShareTarget({
    onShareReceived: async (url: string) => {
      try {
        await saveArticle({ url })
        addToast({
          title: 'Article saved!',
          description: 'Added to your reading queue from share',
          variant: 'success',
        })
        fetchArticles() // Refresh list
      } catch (error) {
        addToast({
          title: 'Failed to save',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    }
  })

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab)
    if (tab !== 'queue' && tab !== 'updates') {
      setFilter(tab)
    }
  }

  const tabs: { key: FilterTab; label: string; icon: any }[] = [
    { key: 'queue', label: 'Queue', icon: List },
    { key: 'updates', label: 'Updates', icon: Rss },
    { key: 'archived', label: 'Archived', icon: Archive },
  ]

  const filteredArticles = activeTab === 'queue'
    ? articles.filter((a) => a.status !== 'archived' && !a.tags.includes('rss'))
    : activeTab === 'updates'
      ? [] // RSS items are handled separately
      : articles.filter((a) => a.status === activeTab)

  // Count for tabs
  const getTabCount = (tab: FilterTab) => {
    if (tab === 'queue') return articles.filter(a => a.status !== 'archived' && !a.tags.includes('rss')).length
    if (tab === 'updates') return rssItems.length
    return articles.filter(a => a.status === tab).length
  }

  const handleRefresh = async () => {
    await fetchArticles()
  }

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
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
      {/* Depth background with subtle gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-96 opacity-30" style={{
          background: 'radial-gradient(ellipse at top, rgba(59, 130, 246, 0.15), transparent 70%)'
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-96 opacity-20" style={{
          background: 'radial-gradient(ellipse at bottom, rgba(16, 185, 129, 0.1), transparent 70%)'
        }} />
      </div>
      <div className="min-h-screen pb-24 relative z-10">
      {/* Header */}
      <div className="premium-glass-strong border-b shadow-lg sticky top-0 z-10" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold premium-text-platinum" style={{ letterSpacing: 'var(--premium-tracking-tight)' }}>
                Reading Queue
              </h1>
              <p className="text-sm sm:text-base mt-1" style={{ color: 'var(--premium-text-secondary)' }}>
                {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeTab !== 'updates' && filteredArticles.length > 0 && (
                <button
                  onClick={() => bulkSelection.isSelectionMode ? bulkSelection.exitSelectionMode() : bulkSelection.enterSelectionMode()}
                  className="rounded-full px-4 py-2 font-medium inline-flex items-center gap-2 border transition-all"
                  style={{
                    borderColor: bulkSelection.isSelectionMode ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    color: bulkSelection.isSelectionMode ? 'var(--premium-purple)' : 'var(--premium-text-secondary)',
                    backgroundColor: bulkSelection.isSelectionMode ? 'rgba(168, 85, 247, 0.1)' : 'transparent'
                  }}
                >
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">{bulkSelection.isSelectionMode ? 'Cancel' : 'Select'}</span>
                </button>
              )}
              {activeTab === 'updates' && (
                <button
                  onClick={handleRSSSync}
                  disabled={syncing}
                  className="rounded-full px-4 py-2 font-medium inline-flex items-center gap-2 border transition-all"
                  style={{
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    color: syncing ? 'var(--premium-text-tertiary)' : 'var(--premium-blue)',
                    backgroundColor: syncing ? 'rgba(255, 255, 255, 0.03)' : 'transparent'
                  }}
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Feeds'}</span>
                </button>
              )}
              <button
                onClick={() => setShowSaveDialog(true)}
                className="premium-glass rounded-full px-4 py-2 font-medium inline-flex items-center gap-2 border transition-all hover:bg-white/10"
                style={{
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  color: 'var(--premium-blue)'
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Save Article</span>
                <span className="sm:hidden">Save</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const count = getTabCount(tab.key)

              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'premium-glass border shadow-xl'
                      : 'premium-glass-subtle border shadow-md hover:shadow-lg'
                  }`}
                  style={{
                    borderColor: activeTab === tab.key ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                    color: activeTab === tab.key ? 'var(--premium-blue)' : 'var(--premium-text-tertiary)'
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className="text-xs opacity-75">({count})</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Updates Tab - RSS Feed Items */}
        {activeTab === 'updates' && (
          <>
            {loadingRSS ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: 'var(--premium-blue)' }} />
                <p style={{ color: 'var(--premium-text-secondary)' }}>Loading RSS updates...</p>
              </div>
            ) : (!feeds || feeds.length === 0) ? (
              <div className="premium-card p-20 text-center">
                <div className="flex flex-col items-center justify-center">
                  <Rss className="h-16 w-16 mb-4" style={{ color: 'var(--premium-emerald)' }} />
                  <h3 className="text-xl font-semibold premium-text-platinum mb-2">No RSS feeds yet</h3>
                  <p className="text-center max-w-md mb-6" style={{ color: 'var(--premium-text-secondary)' }}>
                    Subscribe to RSS feeds in Settings to see updates here
                  </p>
                </div>
              </div>
            ) : rssItems.length === 0 ? (
              <div className="premium-card p-20 text-center">
                <div className="flex flex-col items-center justify-center">
                  <BookOpen className="h-16 w-16 mb-4" style={{ color: 'var(--premium-emerald)' }} />
                  <h3 className="text-xl font-semibold premium-text-platinum mb-2">No updates yet</h3>
                  <p className="text-center max-w-md mb-6" style={{ color: 'var(--premium-text-secondary)' }}>
                    Click "Sync Feeds" to fetch latest articles from your RSS feeds
                  </p>
                  <button
                    onClick={handleRSSSync}
                    disabled={syncing}
                    className="premium-glass rounded-full px-6 py-3 font-medium inline-flex items-center gap-2 border transition-all hover:bg-white/10"
                    style={{
                      borderColor: 'rgba(59, 130, 246, 0.3)',
                      color: syncing ? 'var(--premium-text-tertiary)' : 'var(--premium-blue)',
                      opacity: syncing ? 0.5 : 1
                    }}
                  >
                    <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Feeds'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {rssItems.map((item) => (
                  <RSSFeedItem
                    key={item.guid}
                    item={item}
                    onSave={() => handleSaveRSSItem(item)}
                    onDismiss={() => {
                      // Add to permanent dismissal log
                      addToDismissedLog(item.guid)
                      // Remove from local state
                      setRssItems(prev => prev.filter(i => i.guid !== item.guid))
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Regular Articles - Queue/Unread/Archived */}
        {activeTab !== 'updates' && (
          <>
            {loading && articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: 'var(--premium-blue)' }} />
                <p style={{ color: 'var(--premium-text-secondary)' }}>Loading articles...</p>
              </div>
            ) : filteredArticles.length === 0 ? (
          <div className="premium-card p-20 text-center">
            <div className="flex flex-col items-center justify-center">
              <BookOpen className="h-16 w-16 mb-4" style={{ color: 'var(--premium-emerald)' }} />
              <h3 className="text-xl font-semibold premium-text-platinum mb-2">
                {activeTab === 'queue'
                  ? 'No articles yet'
                  : `No ${activeTab} articles`}
              </h3>
              <p className="text-center max-w-md mb-6" style={{ color: 'var(--premium-text-secondary)' }}>
                {activeTab === 'queue'
                  ? 'Save your first article to start building your reading queue'
                  : `You don't have any ${activeTab} articles yet`}
              </p>
              {activeTab === 'queue' && (
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="premium-glass rounded-full px-6 py-3 font-medium inline-flex items-center gap-2 border transition-all hover:bg-white/10"
                  style={{
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    color: 'var(--premium-blue)'
                  }}
                >
                  <Plus className="h-5 w-5" />
                  Save Your First Article
                </button>
              )}
            </div>
          </div>
        ) : (
          <Virtuoso
            style={{ height: '800px' }}
            totalCount={filteredArticles.length}
            itemContent={(index) => {
              const article = filteredArticles[index]
              const isSelected = bulkSelection.isSelected(article.id)

              return (
                <div className="pb-4">
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
                      pointerEvents: bulkSelection.isSelectionMode ? 'auto' : 'none'
                    }}
                  >
                    {bulkSelection.isSelectionMode && (
                      <div
                        className="absolute top-4 left-4 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: isSelected ? 'var(--premium-purple)' : 'rgba(255, 255, 255, 0.05)',
                          borderColor: isSelected ? 'var(--premium-purple)' : 'rgba(255, 255, 255, 0.2)',
                          pointerEvents: 'auto'
                        }}
                      >
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </div>
                    )}
                    <div style={{ pointerEvents: 'auto' }}>
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onClick={() => !bulkSelection.isSelectionMode && navigate(`/reading/${article.id}`)}
                      />
                    </div>
                  </div>
                </div>
              )
            }}
            components={{
              List: React.forwardRef<HTMLDivElement, { style?: React.CSSProperties; children?: React.ReactNode }>(
                ({ style, children }, ref) => (
                  <div ref={ref} style={style} className="space-y-4">
                    {children}
                  </div>
                )
              )
            }}
          />
        )}
          </>
        )}
      </div>

      {/* Save Article Dialog */}
      <SaveArticleDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
      />

      {/* Connection Suggestions */}
      {suggestions.length > 0 && sourceType === 'article' && (
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
      )}

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
      </div>
    </PullToRefresh>
  )
}
