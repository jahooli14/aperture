/**
 * RSS Feeds Management Page
 * Subscribe to RSS feeds and auto-import articles to reading queue
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Rss, Plus, Loader2, Check, X, RefreshCw, Trash2, Power } from 'lucide-react'
import { useRSSStore } from '../stores/useRSSStore'
import { useToast } from '../components/ui/toast'
import { PRESET_FEEDS } from '../types/rss'
import type { RSSFeed } from '../types/rss'

export function RSSFeedsPage() {
  const { feeds, loading, syncing, fetchFeeds, subscribeFeed, updateFeed, unsubscribeFeed, syncFeeds } = useRSSStore()
  const { addToast } = useToast()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [customFeedUrl, setCustomFeedUrl] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    fetchFeeds()
  }, [fetchFeeds])

  const handleSubscribe = async (feedUrl: string) => {
    setSubscribing(true)
    try {
      await subscribeFeed({ feed_url: feedUrl })
      addToast({
        title: 'Subscribed!',
        description: 'New articles will be automatically added to your reading queue',
        variant: 'success',
      })
      setShowAddDialog(false)
      setCustomFeedUrl('')
    } catch (error) {
      addToast({
        title: 'Failed to subscribe',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSubscribing(false)
    }
  }

  const handleToggle = async (feed: RSSFeed) => {
    try {
      await updateFeed({ id: feed.id, enabled: !feed.enabled })
      addToast({
        title: feed.enabled ? 'Feed paused' : 'Feed enabled',
        description: feed.enabled ? 'Articles will no longer be imported' : 'Articles will be automatically imported',
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to update feed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleUnsubscribe = async (feed: RSSFeed) => {
    if (!confirm(`Unsubscribe from "${feed.title}"?`)) return

    try {
      await unsubscribeFeed(feed.id)
      addToast({
        title: 'Unsubscribed',
        description: `Removed ${feed.title} from your feeds`,
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to unsubscribe',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleSync = async () => {
    try {
      const result = await syncFeeds()
      addToast({
        title: 'Sync complete!',
        description: `${result.articlesAdded} new articles added to your reading queue`,
        variant: 'success',
      })
      // Optionally refresh feeds to update last_fetched_at
      fetchFeeds()
    } catch (error) {
      addToast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const subscribedFeedUrls = new Set(feeds.map(f => f.feed_url))
  const availablePresets = PRESET_FEEDS.filter(preset => !subscribedFeedUrls.has(preset.feed_url))

  return (
    <motion.div
      className="min-h-screen pb-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="premium-glass-strong border-b shadow-lg sticky top-0 z-10" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Rss className="h-8 w-8" style={{ color: 'var(--premium-amber)' }} />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold premium-text-platinum" style={{ letterSpacing: 'var(--premium-tracking-tight)' }}>
                  RSS Feeds
                </h1>
                <p className="text-sm sm:text-base mt-1" style={{ color: 'var(--premium-text-secondary)' }}>
                  {feeds.length} {feeds.length === 1 ? 'subscription' : 'subscriptions'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncing || feeds.length === 0}
                className="premium-glass border px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-white/5 transition-all disabled:opacity-50"
                style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} style={{ color: 'var(--premium-blue)' }} />
                <span className="premium-text-platinum text-sm font-medium hidden sm:inline">Sync</span>
              </button>

              <button
                onClick={() => setShowAddDialog(true)}
                className="premium-btn-primary rounded-full px-4 py-2 font-medium inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Feed</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {loading && feeds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: 'var(--premium-amber)' }} />
            <p style={{ color: 'var(--premium-text-secondary)' }}>Loading feeds...</p>
          </div>
        ) : feeds.length === 0 ? (
          <div className="premium-card p-20 text-center">
            <Rss className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--premium-amber)' }} />
            <h3 className="text-xl font-semibold premium-text-platinum mb-2">
              No RSS feeds yet
            </h3>
            <p className="text-center max-w-md mx-auto mb-6" style={{ color: 'var(--premium-text-secondary)' }}>
              Subscribe to RSS feeds to automatically import articles to your reading queue
            </p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="premium-btn-primary rounded-full px-6 py-3 font-medium inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Your First Feed
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="premium-card p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="premium-text-platinum font-bold text-lg">
                        {feed.title}
                      </h3>
                      {!feed.enabled && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{
                          background: 'rgba(156, 163, 175, 0.2)',
                          color: 'var(--premium-text-tertiary)'
                        }}>
                          Paused
                        </span>
                      )}
                    </div>
                    {feed.description && (
                      <p className="text-sm mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                        {feed.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                      <a
                        href={feed.feed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {feed.feed_url}
                      </a>
                      {feed.last_fetched_at && (
                        <span>
                          Last synced: {new Date(feed.last_fetched_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(feed)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      title={feed.enabled ? 'Pause feed' : 'Enable feed'}
                    >
                      <Power className="h-5 w-5" style={{
                        color: feed.enabled ? 'var(--premium-emerald)' : 'var(--premium-text-tertiary)'
                      }} />
                    </button>
                    <button
                      onClick={() => handleUnsubscribe(feed)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      title="Unsubscribe"
                    >
                      <Trash2 className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Feed Dialog */}
      {showAddDialog && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddDialog(false)}
        >
          <div
            className="premium-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="premium-text-platinum font-bold text-xl">
                Add RSS Feed
              </h3>
              <button
                onClick={() => setShowAddDialog(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" style={{ color: 'var(--premium-text-secondary)' }} />
              </button>
            </div>

            {/* Custom Feed URL */}
            <div className="mb-8">
              <label className="block text-sm font-semibold mb-3 premium-text-platinum">
                Custom Feed URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customFeedUrl}
                  onChange={(e) => setCustomFeedUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="flex-1 px-4 py-3 rounded-lg premium-glass border focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'var(--premium-text-primary)'
                  }}
                  disabled={subscribing}
                />
                <button
                  onClick={() => handleSubscribe(customFeedUrl)}
                  disabled={!customFeedUrl || subscribing}
                  className="premium-btn-primary px-6 py-3 rounded-lg disabled:opacity-50"
                >
                  {subscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add'}
                </button>
              </div>
            </div>

            {/* Preset Feeds */}
            {availablePresets.length > 0 && (
              <>
                <div className="mb-4">
                  <h4 className="text-sm font-semibold premium-text-platinum">
                    Popular Feeds
                  </h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                    Quick subscribe to curated feeds
                  </p>
                </div>

                <div className="space-y-3">
                  {availablePresets.map((preset) => (
                    <div
                      key={preset.feed_url}
                      className="premium-glass-subtle p-4 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="premium-text-platinum font-semibold">
                            {preset.title}
                          </h5>
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: 'var(--premium-blue)'
                          }}>
                            {preset.category}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--premium-text-secondary)' }}>
                          {preset.description}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSubscribe(preset.feed_url)}
                        disabled={subscribing}
                        className="ml-4 premium-glass border px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-white/5 transition-all disabled:opacity-50"
                        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
                      >
                        <Plus className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />
                        <span className="text-sm font-medium premium-text-platinum">Subscribe</span>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
