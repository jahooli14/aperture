/**
 * Article Card Component
 * Displays a saved article in the reading queue with offline status
 */

import React, { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Clock, ExternalLink, Archive, Trash2, WifiOff, Link2, Check, Copy, Share2, Edit } from 'lucide-react'
import { format } from 'date-fns'
import type { Article } from '../../types/reading'
import { useReadingStore } from '../../stores/useReadingStore'
import { useToast } from '../ui/toast'
import { readingDb } from '../../lib/readingDb'
import { haptic } from '../../utils/haptics'
import { useLongPress } from '../../hooks/useLongPress'
import { ContextMenu, type ContextMenuItem } from '../ui/context-menu'
import { Thumbnail } from '../ui/optimized-image'
import { PinButton } from '../PinButton'
import { SuggestionBadge } from '../SuggestionBadge'
import { EditArticleDialog } from './EditArticleDialog'
import { ArticleConnectionsDialog } from './ArticleConnectionsDialog'

interface ArticleCardProps {
  article: Article
  onClick?: () => void
}

export const ArticleCard = React.memo(function ArticleCard({ article, onClick }: ArticleCardProps) {
  const { updateArticleStatus, deleteArticle } = useReadingStore()
  const { addToast } = useToast()
  const [isOffline, setIsOffline] = useState(false)
  const [progress, setProgress] = useState(0)
  const [connectionCount, setConnectionCount] = useState(0)
  const [exitX, setExitX] = useState(0)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false)

  // Clean excerpt by removing common metadata patterns and HTML/CSS
  const cleanExcerpt = (text: string | undefined | null): string | undefined => {
    if (!text) return undefined

    // Remove HTML/CSS that might have leaked through (for old articles saved before the fix)
    let cleaned = text
      // Remove style/script tags and their contents
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove all HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove CSS-like patterns (e.g., "img:is([sizes...")
      .replace(/\w+:is\([^\)]*\)\s*\{[^\}]*\}/g, '')
      .replace(/\w+\[[^\]]*\]\s*\{[^\}]*\}/g, '')
      // Remove common metadata patterns
      .replace(/^#\d+\s*\(no title\)\s*/i, '')
      .replace(/^[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*/, '')
      .replace(/^By\s+[^\.]+\s*/, '')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim()

    return cleaned || undefined
  }

  // Motion values for swipe gesture - stable references, no memoization needed
  const x = useMotionValue(0)
  const archiveIndicatorOpacity = useTransform(x, [0, 100], [0, 1])
  const deleteIndicatorOpacity = useTransform(x, [-100, 0], [1, 0])
  const backgroundColor = useTransform(
    x,
    [-150, 0, 150],
    ['rgba(239, 68, 68, 0.3)', 'rgba(20, 27, 38, 0.4)', 'rgba(16, 185, 129, 0.3)']
  )

  // Long-press for context menu
  const longPressHandlers = useLongPress(() => {
    setShowContextMenu(true)
  }, {
    threshold: 500,
  })

  useEffect(() => {
    // Batch checks to reduce re-renders
    const loadData = async () => {
      await Promise.all([
        checkOfflineStatus(),
        checkProgress(),
        fetchConnectionCount()
      ])
    }
    loadData()
  }, [article.id])

  const fetchConnectionCount = async () => {
    try {
      const response = await fetch(`/api/connections?action=list-sparks&id=${article.id}&type=article`)
      if (response.ok) {
        const data = await response.json()
        setConnectionCount(data.connections?.length || 0)
      } else {
        // Get error details from response
        const text = await response.text()
        const errorData = text.startsWith('{') ? JSON.parse(text) : {}
        console.error('[ArticleCard] Failed to fetch connections:', {
          status: response.status,
          contentType: response.headers.get('content-type'),
          responseBody: text.substring(0, 500),
          error: errorData.error,
          details: errorData.details
        })
      }
    } catch (error) {
      console.error('[ArticleCard] Failed to fetch connections:', error)
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
        console.log(`[ArticleCard] Progress for ${article.title}: ${savedProgress.scroll_percentage}%`)
        setProgress(savedProgress.scroll_percentage)
      } else {
        console.log(`[ArticleCard] No progress found for ${article.title}`)
        setProgress(0)
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
      // Show connections dialog after archiving
      setShowConnectionsDialog(true)
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

  const handleDragEnd = React.useCallback((_: any, info: any) => {
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
          // Show connections dialog after archiving
          setExitX(0)
          x.set(0)
          setShowConnectionsDialog(true)
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
    // Swipe left = Delete
    else if (offset < -100 || velocity < -500) {
      haptic.warning()
      setExitX(-1000)
      setTimeout(async () => {
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
          setExitX(0)
          x.set(0)
        }
      }, 200)
    }
  }, [article.id, updateArticleStatus, deleteArticle, addToast, x])

  const handleCopyLink = React.useCallback(() => {
    navigator.clipboard.writeText(article.url).then(() => {
      haptic.success()
      addToast({
        title: 'Copied!',
        description: 'Article link copied to clipboard',
        variant: 'success',
      })
    })
  }, [article.url, addToast])

  const handleShare = React.useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title || 'Article',
          text: article.excerpt || '',
          url: article.url,
        })
        haptic.success()
      } catch (error) {
        console.warn('Share cancelled or failed:', error)
      }
    } else {
      handleCopyLink()
    }
  }, [article.title, article.excerpt, article.url, handleCopyLink])

  // Memoize icon elements to prevent recreation (prevents flickering)
  const editIcon = React.useMemo(() => <Edit className="h-5 w-5" />, [])
  const externalLinkIcon = React.useMemo(() => <ExternalLink className="h-5 w-5" />, [])
  const copyIcon = React.useMemo(() => <Copy className="h-5 w-5" />, [])
  const shareIcon = React.useMemo(() => <Share2 className="h-5 w-5" />, [])
  const archiveIcon = React.useMemo(() => <Archive className="h-5 w-5" />, [])
  const deleteIcon = React.useMemo(() => <Trash2 className="h-5 w-5" />, [])

  const contextMenuItems: ContextMenuItem[] = React.useMemo(() => [
    {
      label: 'Edit',
      icon: editIcon,
      onClick: () => setShowEditDialog(true),
    },
    {
      label: 'Open Original',
      icon: externalLinkIcon,
      onClick: () => window.open(article.url, '_blank', 'noopener,noreferrer'),
    },
    {
      label: 'Copy Link',
      icon: copyIcon,
      onClick: handleCopyLink,
    },
    {
      label: 'Share',
      icon: shareIcon,
      onClick: handleShare,
    },
    {
      label: 'Archive',
      icon: archiveIcon,
      onClick: async () => {
        try {
          await updateArticleStatus(article.id, 'archived')
          addToast({
            title: 'Archived',
            description: 'Article moved to archive',
            variant: 'success',
          })
          // Show connections dialog after archiving
          setShowConnectionsDialog(true)
        } catch (error) {
          addToast({
            title: 'Error',
            description: 'Failed to archive article',
            variant: 'destructive',
          })
        }
      },
    },
    {
      label: 'Delete',
      icon: deleteIcon,
      onClick: async () => {
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
      },
      variant: 'destructive' as const,
    },
  ], [article.id, article.url, editIcon, externalLinkIcon, copyIcon, shareIcon, archiveIcon, deleteIcon, handleCopyLink, handleShare, updateArticleStatus, deleteArticle, addToast])

  return (
    <>
      <ContextMenu
        items={contextMenuItems}
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        title={article.title || 'Article'}
      />

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -200, right: 200 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={exitX !== 0 ? { x: exitX, opacity: 0 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative"
        {...longPressHandlers}
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

      {/* Delete Indicator (Swipe Left) */}
      <motion.div
        style={{ opacity: deleteIndicatorOpacity }}
        className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none z-10 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-red-500">DELETE</span>
          <Trash2 className="h-6 w-6 text-red-500" />
        </div>
      </motion.div>

      <motion.div
        style={{ backgroundColor }}
        className="rounded-xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -6, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 28,
          mass: 0.6,
          opacity: { duration: 0.3 },
          scale: { duration: 0.3 }
        }}
      >
        <div
          onClick={onClick}
          className="group premium-card rounded-xl p-4 sm:p-5 transition-all cursor-pointer relative overflow-hidden"
          style={{
            background: 'var(--premium-bg-2)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--premium-bg-3)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--premium-bg-2)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}
        >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
        {/* Thumbnail (if available) */}
        {article.thumbnail_url && (
          <div className="flex-shrink-0">
            <Thumbnail
              src={article.thumbnail_url}
              alt={article.title || 'Article thumbnail'}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg"
              aspectRatio="1/1"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Check if article is still loading (URL as title indicates extraction in progress) */}
          {article.title?.startsWith('http') ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-blue-500 border-r-transparent"></div>
                <h3 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>
                  Extracting article...
                </h3>
              </div>
              <div className="text-xs line-clamp-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                {article.url}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl sm:text-2xl font-bold line-clamp-2 mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                {article.title || 'Untitled'}
              </h3>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--premium-text-muted)' }}>
                {article.source && (
                  <span className="font-medium text-sm">{article.source}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <SuggestionBadge itemId={article.id} itemType="article" />
            <PinButton
              type="article"
              id={article.id}
              title={article.title || 'Article'}
              content={
                <div className="p-6">
                  <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--premium-text-primary)' }}>
                    {article.title}
                  </h2>
                  {article.excerpt && (
                    <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                      {article.excerpt}
                    </p>
                  )}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm"
                    style={{ color: 'var(--premium-blue)' }}
                  >
                    Open original →
                  </a>
                </div>
              }
            />
            {isOffline && (
              <div className="p-1.5 rounded-full flex items-center justify-center" style={{
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--premium-blue)'
              }} title="Saved for offline">
                <WifiOff className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
          {/* Connection Badge */}
          {connectionCount > 0 && (
            <div className="px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: 'var(--premium-blue)'
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

      {/* Visual Separator */}
      <div className="h-px my-4" style={{
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)'
      }} />

      {/* Excerpt */}
      {cleanExcerpt(article.excerpt) && (
        <p className="text-sm sm:text-base line-clamp-2 mb-3" style={{
          color: 'var(--premium-text-secondary)',
          lineHeight: '1.6'
        }}>
          {cleanExcerpt(article.excerpt)}
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
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--premium-blue)'
              }}
            >
              {tag}
            </span>
          ))}
          {article.tags.length > 3 && (
            <span className="px-2 py-1 text-xs rounded-full" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--premium-blue)'
            }}>
              +{article.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          {article.read_time_minutes && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--premium-blue)'
            }}>
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">{article.read_time_minutes} min</span>
            </div>
          )}
          {article.created_at && (
            <span className="px-2.5 py-1 rounded-full font-medium" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--premium-text-tertiary)'
            }}>
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
            onClick={(e) => {
              e.stopPropagation()
              setShowEditDialog(true)
            }}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--premium-text-secondary)' }}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
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

    {/* Edit Dialog */}
    <EditArticleDialog
      article={article}
      open={showEditDialog}
      onOpenChange={setShowEditDialog}
    />

    {/* Connections Dialog */}
    <ArticleConnectionsDialog
      article={{
        id: article.id,
        title: article.title || 'Untitled',
        content: article.content || '',
        excerpt: article.excerpt || undefined
      }}
      isOpen={showConnectionsDialog}
      onClose={() => setShowConnectionsDialog(false)}
      onConnectionsCreated={() => {
        // Refresh connection count if needed
        console.log('Connections created for article:', article.id)
      }}
    />
    </>
  )
})
