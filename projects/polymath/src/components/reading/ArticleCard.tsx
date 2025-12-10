import React, { useState, useEffect, useMemo } from 'react'
import { Clock, ExternalLink, Archive, Trash2, WifiOff, Link2, Copy, Share2, Edit, Download, CheckCircle, MoreVertical } from 'lucide-react'
import { format } from 'date-fns'
import type { Article } from '../../types/reading'
import { useReadingStore } from '../../stores/useReadingStore'
import { useToast } from '../ui/toast'
import { readingDb } from '../../lib/db' // Keep for direct db access if needed for metadata check
import { haptic } from '../../utils/haptics'
import { ContextMenu, type ContextMenuItem } from '../ui/context-menu'
import { Thumbnail } from '../ui/optimized-image'
import { PinButton } from '../PinButton'
import { SuggestionBadge } from '../SuggestionBadge'
import { EditArticleDialog } from './EditArticleDialog'
import { ArticleConnectionsDialog } from './ArticleConnectionsDialog'
import { useOfflineArticle } from '../../hooks/useOfflineArticle'
import { GlassCard } from '../ui/GlassCard'
import { SmartActionDot } from '../SmartActionDot'
import { Button } from '../ui/button'

interface ArticleCardProps {
  article: Article
  onClick?: () => void
}

export const ArticleCard = React.memo(function ArticleCard({ article, onClick }: ArticleCardProps) {
  const { updateArticleStatus, deleteArticle } = useReadingStore()
  const { addToast } = useToast()
  const [isMetadataCached, setIsMetadataCached] = useState(false)
  const [isContentFullyCached, setIsContentFullyCached] = useState(false)
  const [progress, setProgress] = useState(0) // Reading progress
  const [connectionCount, setConnectionCount] = useState(0)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false)

  const { isCached: isArticleFullyCached } = useOfflineArticle()

  // Clean excerpt logic
  const cleanExcerpt = (text: string | undefined | null): string | undefined => {
    if (!text) return undefined
    let cleaned = text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\w+:is\([^\)]*\)\s*\{[^\}]*\}/g, '')
      .replace(/\w+\[[^\]]*\]\s*\{[^\}]*\}/g, '')
      .replace(/^#\d+\s*\(no title\)\s*/i, '')
      .replace(/^[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*/, '')
      .replace(/^By\s+[^\.]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned || undefined
  }

  // Load progress
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const p = await readingDb.getProgress(article.id)
        if (p) setProgress(p.scroll_percentage)
      } catch (e) {
        // ignore
      }
    }
    loadProgress()
  }, [article.id])

  const handleMarkAsRead = async () => {
    try {
      await updateArticleStatus(article.id, 'archived')
      addToast({
        title: 'Archived',
        description: 'Article moved to archive',
        variant: 'success',
      })
      setShowConnectionsDialog(true)
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to archive article',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
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

  const openOriginal = () => {
    window.open(article.url, '_blank', 'noopener,noreferrer')
  }

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

  const checkCacheStatus = async () => {
    if (!article.id) return
    try {
      const cached = await readingDb.articles.get(article.id)
      setIsMetadataCached(!!cached?.offline_available)
      const fullyCached = await isArticleFullyCached(article.id)
      setIsContentFullyCached(fullyCached)
    } catch (error) {
      console.warn('[ArticleCard] Failed to check offline status:', error)
      setIsMetadataCached(false)
      setIsContentFullyCached(false)
    }
  }

  useEffect(() => {
    checkCacheStatus()
  }, [article.id, isArticleFullyCached])

  // Context Menu Items
  const contextMenuItems: ContextMenuItem[] = useMemo(() => [
    { label: 'Edit', icon: <Edit className="h-5 w-5" />, onClick: () => setShowEditDialog(true) },
    { label: 'Open Original', icon: <ExternalLink className="h-5 w-5" />, onClick: openOriginal },
    { label: 'Copy Link', icon: <Copy className="h-5 w-5" />, onClick: handleCopyLink },
    { label: 'Share', icon: <Share2 className="h-5 w-5" />, onClick: handleShare },
    { label: 'Archive', icon: <Archive className="h-5 w-5" />, onClick: handleMarkAsRead },
    { label: 'Delete', icon: <Trash2 className="h-5 w-5" />, onClick: handleDelete, variant: 'destructive' as const },
  ], [article.url, handleCopyLink, handleShare])

  return (
    <>
      <ContextMenu
        items={contextMenuItems}
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        title={article.title || 'Article'}
      />

      <GlassCard variant="muted" onClick={onClick}>
        {/* Header: Thumbnail + Title + Actions */}
        <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
          {/* Thumbnail */}
          {article.thumbnail_url && (
            <div className="flex-shrink-0">
              <Thumbnail
                src={article.thumbnail_url}
                alt={article.title || 'Article thumbnail'}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover"
                aspectRatio="1/1"
              />
            </div>
          )}

          {/* Title & Source */}
          <div className="flex-1 min-w-0">
            {article.title?.startsWith('http') ? (
              <div className="flex items-center gap-2 mb-1">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-500 border-r-transparent"></div>
                <span className="text-sm font-medium text-blue-400">Extracting...</span>
              </div>
            ) : (
              <h3 className="text-lg font-bold leading-tight line-clamp-2 mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                {article.title || 'Untitled'}
              </h3>
            )}
            <div className="text-xs truncate" style={{ color: 'var(--premium-text-tertiary)' }}>
              {article.source || new URL(article.url).hostname.replace('www.', '')}
            </div>
          </div>

          {/* Actions & Status */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1">
              <SuggestionBadge itemId={article.id} itemType="article" />
              
              {/* Offline Status */}
              {isContentFullyCached ? (
                <div className="p-1 rounded-full bg-blue-500/10 text-blue-400" title="Fully available offline">
                  <Download className="h-3 w-3" />
                </div>
              ) : isMetadataCached ? (
                <div className="p-1 rounded-full bg-amber-500/10 text-amber-400" title="Metadata only">
                  <WifiOff className="h-3 w-3" />
                </div>
              ) : null}

              {/* Pin */}
              <PinButton type="article" id={article.id} title={article.title || 'Article'} content={<></>} />

              {/* Smart Dot */}
              <SmartActionDot color="var(--premium-blue)" title="AI Analysis" />

              {/* 3-Dot Menu */}
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowContextMenu(true)
                }}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-white/10"
              >
                <MoreVertical className="h-4 w-4 text-gray-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px w-full my-3" style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* Excerpt */}
        {cleanExcerpt(article.excerpt) && (
          <p className="text-sm line-clamp-3 mb-4 leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
            {cleanExcerpt(article.excerpt)}
          </p>
        )}

        {/* Footer: Progress & Metadata */}
        <div className="space-y-3">
          {/* Progress Bar */}
          {progress > 0 && (
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${progress}%` }} 
              />
            </div>
          )}

          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
            <div className="flex items-center gap-3">
              {article.read_time_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {article.read_time_minutes} min
                </span>
              )}
              <span>
                {article.created_at ? format(new Date(article.created_at), 'MMM d') : 'Recent'}
              </span>
            </div>
            {/* Tags could go here if needed, but keeping it clean for now */}
          </div>
        </div>
      </GlassCard>

      <EditArticleDialog
        article={article}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <ArticleConnectionsDialog
        article={{
          id: article.id,
          title: article.title || 'Untitled',
          content: article.content || '',
          excerpt: article.excerpt || undefined
        }}
        isOpen={showConnectionsDialog}
        onClose={() => setShowConnectionsDialog(false)}
        onConnectionsCreated={() => { console.log('Connections created') }}
        initialStage="discovering"
      />
    </>
  )
})
