/**
 * Article Card Component
 * Displays a saved article in the reading queue with offline status
 */

import { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Clock, ExternalLink, Archive, Trash2, BookOpen, WifiOff, Link2, Check } from 'lucide-react'
import { format } from 'date-fns'
import type { Article } from '../../types/reading'
import { useReadingStore } from '../../stores/useReadingStore'
import { useToast } from '../ui/toast'
import { readingDb } from '../../lib/readingDb'
import { haptic } from '../../utils/haptics'

interface ArticleCardProps {
  article: Article
  onClick?: () => void
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  const { updateArticleStatus, deleteArticle } = useReadingStore()
  const { addToast } = useToast()
  const [isOffline, setIsOffline] = useState(false)
  const [progress, setProgress] = useState(0)
  const [connectionCount, setConnectionCount] = useState(0)
  const [exitX, setExitX] = useState(0)

  // Motion values for swipe gesture
  const x = useMotionValue(0)
  const archiveIndicatorOpacity = useTransform(x, [0, 100], [0, 1])
  const backgroundColor = useTransform(
    x,
    [0, 150],
    ['rgba(20, 27, 38, 0.4)', 'rgba(16, 185, 129, 0.3)']
  )

  useEffect(() => {
    checkOfflineStatus()
    checkProgress()
    fetchConnectionCount()
  }, [article.id])

  const fetchConnectionCount = async () => {
    try {
      const response = await fetch(`/api/related?source_type=article&source_id=${article.id}&connections=true`)
      if (response.ok) {
        const data = await response.json()
        setConnectionCount(data.connections?.length || 0)
      }
    } catch (error) {
      console.warn('[ArticleCard] Failed to fetch connections:', error)
    }
  }

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

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x
    const velocity = info.velocity.x

    // Swipe right = Mark as read/Archive
    if (offset > 100 || velocity > 500) {
      haptic.success()
      setExitX(1000)
      setTimeout(async () => {
        try {
          await updateArticleStatus(article.id, 'archived')
          addToast({
            title: 'Archived!',
            description: 'Article marked as read',
            variant: 'success',
          })
        } catch (error) {
          addToast({
            title: 'Error',
            description: 'Failed to archive article',
            variant: 'destructive',
          })
          setExitX(0)
          x.set(0)
        }
      }, 200)
    }
  }

  return (
    <motion.div
      style={{ x }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      animate={exitX !== 0 ? { x: exitX, opacity: 0 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative"
    >
      {/* Archive Indicator (Swipe Right) */}
      <motion.div
        style={{ opacity: archiveIndicatorOpacity }}
        className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none z-10 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Check className="h-6 w-6" style={{ color: 'var(--premium-emerald)' }} />
          <span className="text-xl font-bold" style={{ color: 'var(--premium-emerald)' }}>ARCHIVE</span>
        </div>
      </motion.div>

      <motion.div style={{ backgroundColor }} className="rounded-xl">
        <div
          onClick={onClick}
          className="group premium-card border rounded-xl p-4 sm:p-5 transition-all cursor-pointer hover:border-emerald-500/50"
          style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}
        >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl font-semibold line-clamp-2 mb-1" style={{ color: 'var(--premium-text-primary)' }}>
            {article.title || 'Untitled'}
          </h3>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
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
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {isOffline && (
              <div className="px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1" style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--premium-emerald)'
              }}>
                <WifiOff className="h-3 w-3" />
                Offline
              </div>
            )}
            {article.status === 'reading' && (
              <div className="px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1" style={{
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--premium-blue)'
              }}>
                <BookOpen className="h-3 w-3" />
                Reading
              </div>
            )}
          </div>
          {/* Connection Badge */}
          {connectionCount > 0 && (
            <div className="px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: 'var(--premium-blue)',
              borderColor: 'rgba(59, 130, 246, 0.4)',
              border: '1px solid'
            }}>
              <Link2 className="h-3 w-3" />
              {connectionCount} link{connectionCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Reading Progress Bar */}
      {progress > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>
            <span>Reading progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'var(--premium-blue)'
              }}
            />
          </div>
        </div>
      )}

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-sm sm:text-base line-clamp-2 mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
          {article.excerpt}
        </p>
      )}

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {article.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs rounded-full"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--premium-emerald)'
              }}
            >
              {tag}
            </span>
          ))}
          {article.tags.length > 3 && (
            <span className="px-2 py-1 text-xs rounded-full" style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--premium-emerald)'
            }}>
              +{article.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div className="flex items-center gap-4 text-xs sm:text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
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
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--premium-text-secondary)' }}
            title="Open original"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={handleMarkAsRead}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--premium-text-secondary)' }}
            title="Archive"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" style={{ color: '#ef4444' }} />
          </button>
        </div>
      </div>
      </div>
      </motion.div>
    </motion.div>
  )
}
