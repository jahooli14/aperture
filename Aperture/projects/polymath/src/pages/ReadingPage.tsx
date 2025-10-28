/**
 * Reading Queue Page
 * Displays saved articles with filtering and save functionality
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Loader2, BookOpen, Archive, List } from 'lucide-react'
import { useReadingStore } from '../stores/useReadingStore'
import { ArticleCard } from '../components/reading/ArticleCard'
import { SaveArticleDialog } from '../components/reading/SaveArticleDialog'
import { PullToRefresh } from '../components/PullToRefresh'
import { useShareTarget } from '../hooks/useShareTarget'
import { useToast } from '../components/ui/toast'
import type { ArticleStatus } from '../types/reading'

type FilterTab = 'queue' | ArticleStatus

export function ReadingPage() {
  const navigate = useNavigate()
  const { articles, loading, fetchArticles, currentFilter, setFilter, saveArticle } = useReadingStore()
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
        className="bg-gradient-to-br from-blue-50 via-white to-purple-50 pb-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
      {/* Header */}
      <div className="backdrop-blur-xl bg-white/80 border-b-2 shadow-lg sticky top-0 z-10" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
                Reading Queue
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 mt-1">
                {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
              </p>
            </div>

            <button
              onClick={() => setShowSaveDialog(true)}
              className="backdrop-blur-xl bg-white/80 border-2 shadow-xl rounded-full px-4 py-2 font-medium transition-all hover:shadow-2xl inline-flex items-center gap-2 hover-lift"
              style={{
                borderColor: 'rgba(16, 185, 129, 0.5)',
                color: '#10b981'
              }}
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
                      ? 'backdrop-blur-xl bg-white/80 border-2 shadow-xl'
                      : 'backdrop-blur-xl bg-white/60 border-2 shadow-md hover:shadow-lg'
                  }`}
                  style={{
                    borderColor: activeTab === tab.key ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.2)',
                    color: activeTab === tab.key ? '#10b981' : '#6b7280'
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
            <Loader2 className="h-8 w-8 text-blue-900 animate-spin mb-4" />
            <p className="text-neutral-600">Loading articles...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/80 border-2 shadow-xl p-20 text-center" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div className="flex flex-col items-center justify-center">
              <BookOpen className="h-16 w-16 text-green-400 mb-4" />
              <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                {activeTab === 'queue'
                  ? 'No articles yet'
                  : `No ${activeTab} articles`}
              </h3>
              <p className="text-neutral-600 text-center max-w-md mb-6">
                {activeTab === 'queue'
                  ? 'Save your first article to start building your reading queue'
                  : `You don't have any ${activeTab} articles yet`}
              </p>
              {activeTab === 'queue' && (
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="backdrop-blur-xl bg-white/80 border-2 shadow-xl rounded-full px-6 py-3 font-medium transition-all hover:shadow-2xl inline-flex items-center gap-2 hover-lift"
                  style={{
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    color: '#10b981'
                  }}
                >
                  <Plus className="h-5 w-5" />
                  Save Your First Article
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() => navigate(`/reading/${article.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Save Article Dialog */}
      <SaveArticleDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
      />
      </motion.div>
    </PullToRefresh>
  )
}
