/**
 * Reading Queue Page
 * Displays saved articles with filtering and save functionality
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import { Plus, Loader2, BookOpen, Archive, List, Rss, RefreshCw } from 'lucide-react'
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
import type { ArticleStatus } from '../types/reading'
import type { RSSFeedItem as RSSItem } from '../types/rss'

type FilterTab = 'queue' | 'updates' | ArticleStatus

export function ReadingPage() {
  const navigate = useNavigate()
  const { articles, loading, fetchArticles, currentFilter, setFilter, saveArticle } = useReadingStore()
  const { feeds, syncing, fetchFeeds, syncFeeds } = useRSSStore()
  const { suggestions, sourceId, sourceType, clearSuggestions } = useConnectionStore()
  const [activeTab, setActiveTab] = useState<FilterTab>('queue')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [rssItems, setRssItems] = useState<RSSItem[]>([])
  const [loadingRSS, setLoadingRSS] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    fetchArticles()
    fetchFeeds()
  }, [fetchArticles, fetchFeeds])

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

      setRssItems(allItems)
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
    { key: 'unread', label: 'Unread', icon: BookOpen },
    { key: 'archived', label: 'Archived', icon: Archive },
  ]

  const filteredArticles = activeTab === 'queue'
    ? articles.filter((a) => a.status !== 'archived')
    : activeTab === 'updates'
      ? [] // RSS items are handled separately
      : articles.filter((a) => a.status === activeTab)

  // Count for tabs
  const getTabCount = (tab: FilterTab) => {
    if (tab === 'queue') return articles.filter(a => a.status !== 'archived').length
    if (tab === 'updates') return rssItems.length
    return articles.filter(a => a.status === tab).length
  }

  const handleRefresh = async () => {
    await fetchArticles()
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
      <motion.div
        className="min-h-screen pb-24"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
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
                className="premium-btn-primary rounded-full px-4 py-2 font-medium inline-flex items-center gap-2"
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
            ) : feeds.length === 0 ? (
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
                    className="premium-btn-primary rounded-full px-6 py-3 font-medium inline-flex items-center gap-2"
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
                  className="premium-btn-primary rounded-full px-6 py-3 font-medium inline-flex items-center gap-2"
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
            itemContent={(index) => (
              <div className="pb-4">
                <ArticleCard
                  key={filteredArticles[index].id}
                  article={filteredArticles[index]}
                  onClick={() => navigate(`/reading/${filteredArticles[index].id}`)}
                />
              </div>
            )}
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
      </motion.div>
    </PullToRefresh>
  )
}
