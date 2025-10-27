/**
 * Article Card Component
 * Displays a saved article in the reading queue with offline status
 */

import { useState, useEffect } from 'react'
import { Clock, ExternalLink, Archive, Trash2, BookOpen, WifiOff } from 'lucide-react'
import { format } from 'date-fns'
import type { Article } from '../../types/reading'
import { useReadingStore } from '../../stores/useReadingStore'
import { useToast } from '../ui/toast'
import { readingDb } from '../../lib/readingDb'

interface ArticleCardProps {
  article: Article
  onClick?: () => void
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  const { updateArticleStatus, deleteArticle } = useReadingStore()
  const { addToast } = useToast()
  const [isOffline, setIsOffline] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    checkOfflineStatus()
    checkProgress()
  }, [article.id])

  const checkOfflineStatus = async () => {
    try {
      const cached = await readingDb.articles.get(article.id)
      setIsOffline(cached?.offline_available && cached?.images_cached || false)
    } catch (error) {
      console.warn('[ArticleCard] Failed to check offline status:', error)
      setIsOffline(false)
    }
  }

  const checkProgress = async () => {
    try {
      const savedProgress = await readingDb.getProgress(article.id)
      if (savedProgress) {
        setProgress(savedProgress.scroll_percentage)
      }
    } catch (error) {
      console.warn('[ArticleCard] Failed to check progress:', error)
      setProgress(0)
    }
  }

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updateArticleStatus(article.id, 'archived')
      addToast({
        title: 'Archived',
        description: 'Article moved to archive',
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to archive article',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Remove this article from your reading queue?')) return

    try {
      await deleteArticle(article.id)
      addToast({
        title: 'Deleted',
        description: 'Article removed from queue',
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to delete article',
        variant: 'destructive',
      })
    }
  }

  const openOriginal = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      onClick={onClick}
      className="group bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 line-clamp-2 mb-1">
            {article.title || 'Untitled'}
          </h3>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            {article.source && (
              <span className="font-medium">{article.source}</span>
            )}
            {article.author && (
              <>
                <span>•</span>
                <span>{article.author}</span>
              </>
            )}
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {isOffline && (
            <div className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              Offline
            </div>
          )}
          {article.status === 'reading' && (
            <div className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              Reading
            </div>
          )}
        </div>
      </div>

      {/* Reading Progress Bar */}
      {progress > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>Reading progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-900 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-neutral-600 text-sm sm:text-base line-clamp-2 mb-3">
          {article.excerpt}
        </p>
      )}

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {article.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
          {article.tags.length > 3 && (
            <span className="px-2 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full">
              +{article.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-4 text-xs sm:text-sm text-neutral-500">
          {article.read_time_minutes && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{article.read_time_minutes} min</span>
            </div>
          )}
          {article.created_at && (
            <span>
              {(() => {
                try {
                  const date = new Date(article.created_at)
                  if (isNaN(date.getTime())) return 'Recently'
                  return format(date, 'MMM d')
                } catch {
                  return 'Recently'
                }
              })()}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={openOriginal}
            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Open original"
          >
            <ExternalLink className="h-4 w-4 text-neutral-600" />
          </button>
          <button
            onClick={handleMarkAsRead}
            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Archive"
          >
            <Archive className="h-4 w-4 text-neutral-600" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  )
}
