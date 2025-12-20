import React, { useState, useEffect, useMemo } from 'react'
import { Clock, ExternalLink, Archive, Trash2, WifiOff, Link2, Copy, Share2, Edit, Download, CheckCircle, MoreVertical, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Article } from '../../types/reading'
import { useReadingStore } from '../../stores/useReadingStore'
import { useToast } from '../ui/toast'
import { readingDb } from '../../lib/db'
import { haptic } from '../../utils/haptics'
import { ContextMenu, type ContextMenuItem } from '../ui/context-menu'
import { Thumbnail } from '../ui/optimized-image'
import { PinButton } from '../PinButton'
import { SuggestionBadge } from '../SuggestionBadge'
import { EditArticleDialog } from './EditArticleDialog'
import { ArticleConnectionsDialog } from './ArticleConnectionsDialog'
import { useOfflineArticle } from '../../hooks/useOfflineArticle'
import { Button } from '../ui/button'

interface ArticleCardProps {
  article: Article & { is_rotting?: boolean }
  onClick?: () => void
}

export const ArticleCard = React.memo(function ArticleCard({ article, onClick }: ArticleCardProps) {
  const { updateArticleStatus, deleteArticle } = useReadingStore()
  const { addToast } = useToast()
  const [isMetadataCached, setIsMetadataCached] = useState(false)
  const [isContentFullyCached, setIsContentFullyCached] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false)

  const { isCached: isArticleFullyCached } = useOfflineArticle()
  const { is_rotting } = article

  // No more redundant cleaning needed as it's done on backend
  const excerpt = article.excerpt || ''

  useEffect(() => {
    readingDb.getProgress(article.id).then(p => {
      if (p) setProgress(p.scroll_percentage)
    })
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

      <div
        onClick={onClick}
        className="group block rounded-xl backdrop-blur-xl transition-all duration-300 break-inside-avoid border p-4 cursor-pointer relative shadow-lg"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
          filter: is_rotting ? 'grayscale(80%)' : 'none',
        }}
      >
        <div className="mb-3 relative z-10 block">
          <div className="float-right ml-2 -mr-2 -mt-1">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                setShowContextMenu(true)
              }}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-white/10 shrink-0"
            >
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </Button>
          </div>

          <div className="min-w-0">
            {article.title?.startsWith('http') ? (
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm font-medium text-blue-400">Extracting...</span>
              </div>
            ) : (
              <h3 className="text-lg font-bold leading-tight inline text-[#f2f2f7]">
                {article.title || 'Untitled'}
              </h3>
            )}
            {is_rotting && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium ml-2 align-middle">Rotting</span>
            )}
            <div className="text-xs truncate mt-1 text-zinc-500">
              {article.source || new URL(article.url).hostname.replace('www.', '')}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 mb-3">
          {article.thumbnail_url ? (
            <div className="flex-shrink-0">
              <Thumbnail
                src={article.thumbnail_url}
                alt={article.title || 'Article thumbnail'}
                className="w-16 h-16 rounded-lg object-cover"
                aspectRatio="1/1"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center">
              <div className="text-2xl opacity-20">📄</div>
            </div>
          )}

          <div className="flex-1 flex flex-col items-end justify-between h-16">
            <div className="flex items-center gap-1">
              <SuggestionBadge itemId={article.id} itemType="article" />
              {isContentFullyCached ? (
                <div className="p-1 rounded-full bg-emerald-500/10 text-emerald-400" title="Available offline">
                  <Download className="h-3 w-3" />
                </div>
              ) : isMetadataCached ? (
                <div className="p-1 rounded-full bg-amber-500/10 text-amber-400" title="Partially cached">
                  <WifiOff className="h-3 w-3" />
                </div>
              ) : null}
              <PinButton type="article" id={article.id} title={article.title || 'Article'} content={<></>} />
            </div>

            <div className="flex items-center gap-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
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
          </div>
        </div>

        {excerpt && (
          <p className="text-sm text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
            {excerpt}
          </p>
        )}

        {progress > 0 && (
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

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
