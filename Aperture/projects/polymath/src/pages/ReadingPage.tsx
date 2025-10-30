/**
 * Reading Queue Page
 * Displays saved articles with filtering and save functionality
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import { Plus, Loader2, BookOpen, Archive, List } from 'lucide-react'
import { useReadingStore } from '../stores/useReadingStore'
import { ArticleCard } from '../components/reading/ArticleCard'
import { SaveArticleDialog } from '../components/reading/SaveArticleDialog'
import { PullToRefresh } from '../components/PullToRefresh'
import { useShareTarget } from '../hooks/useShareTarget'
import { useToast } from '../components/ui/toast'
import { useConnectionStore } from '../stores/useConnectionStore'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import type { ArticleStatus } from '../types/reading'

type FilterTab = 'queue' | ArticleStatus

export function ReadingPage() {
  const navigate = useNavigate()
  const { articles, loading, fetchArticles, currentFilter, setFilter, saveArticle } = useReadingStore()
  const { suggestions, sourceId, sourceType, clearSuggestions } = useConnectionStore()
  const [activeTab, setActiveTab] = useState<FilterTab>('queue')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

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
    setFilter(tab === 'queue' ? 'all' : tab)
  }

  const tabs: { key: FilterTab; label: string; icon: any }[] = [
    { key: 'queue', label: 'Queue', icon: List },
    { key: 'unread', label: 'Unread', icon: BookOpen },
    { key: 'archived', label: 'Archived', icon: Archive },
  ]

  const filteredArticles = activeTab === 'queue'
    ? articles.filter((a) => a.status !== 'archived')
    : articles.filter((a) => a.status === activeTab)

  const handleRefresh = async () => {
    await fetchArticles()
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
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
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold premium-text-platinum" style={{ letterSpacing: 'var(--premium-tracking-tight)' }}>
                Reading Queue
              </h1>
              <p className="text-sm sm:text-base mt-1" style={{ color: 'var(--premium-text-secondary)' }}>
                {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
              </p>
            </div>

            <button
              onClick={() => setShowSaveDialog(true)}
              className="premium-btn-primary rounded-full px-4 py-2 font-medium inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Save Article</span>
              <span className="sm:hidden">Save</span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const count = tab.key === 'queue'
                ? articles.filter((a) => a.status !== 'archived').length
                : articles.filter((a) => a.status === tab.key).length

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
