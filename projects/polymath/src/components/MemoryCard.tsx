import React, { useState, memo, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Edit, Trash2, Copy, Share2, Calendar } from 'lucide-react'
import { CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import type { Memory, BridgeWithMemories } from '../types'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useToast } from './ui/toast'
import { haptic } from '../utils/haptics'
import { ContextMenu, type ContextMenuItem } from './ui/context-menu'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { MemoryDetailModal } from './memories/MemoryDetailModal'
import { useConfirmDialog } from './ui/confirm-dialog'
import { motion } from 'framer-motion'

// Module-level cache for bridges remains, but will be managed by MemoryDetailModal
const bridgesCache = new Map<string, { bridges: BridgeWithMemories[]; timestamp: number }>()

import { PROJECT_COLORS } from './projects/ProjectCard'

const getTheme = (title: string, type: string = 'default') => {
  const t = type?.toLowerCase().trim() || ''

  let rgb = PROJECT_COLORS[t]

  // Deterministic fallback if type is unknown or missing
  if (!rgb) {
    const keys = Object.keys(PROJECT_COLORS).filter(k => k !== 'default')
    let hash = 0
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash)
    }
    rgb = PROJECT_COLORS[keys[Math.abs(hash) % keys.length]]
  }

  return { rgb }
}

interface MemoryCardProps {
  memory: Memory
  onEdit?: (memory: Memory) => void
  onDelete?: (memory: Memory) => void
}

import { OptimizedImage } from './ui/optimized-image'

export const MemoryCard = memo(function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const navigate = useNavigate()
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const { setContext, toggleSidebar } = useContextEngineStore()
  const deleteMemory = useMemoryStore((state) => state.deleteMemory)
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  const handleCopyText = useCallback(() => {
    const textToCopy = `${memory.title}\n\n${memory.body}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      haptic.success()
      addToast({
        title: 'Copied!',
        description: 'Thought text copied to clipboard',
        variant: 'success',
      })
    })
  }, [memory.title, memory.body, addToast])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: memory.title,
          text: memory.body,
        })
        haptic.success()
      } catch (error) {
        console.warn('Share cancelled or failed:', error)
      }
    } else {
      handleCopyText()
    }
  }, [memory.title, memory.body, handleCopyText])

  const handleAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // Set context for the side panel AI
    setContext('memory', memory.id, memory.title, `${memory.title}\n\n${memory.body}`)
    toggleSidebar(true)
  }

  const handleDelete = useCallback(async () => {
    if (!memory) return;

    const confirmed = await confirm({
      title: `Delete "${memory.title}"?`,
      description: 'This action cannot be undone. The thought will be permanently removed.',
      confirmText: 'Delete',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteMemory(memory.id);
        addToast({
          title: 'Thought deleted',
          description: `"${memory.title}" has been removed.`,
          variant: 'success',
        });
        onDelete?.(memory);
      } catch (error) {
        addToast({
          title: 'Failed to delete thought',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      }
    }
  }, [memory, deleteMemory, addToast, onDelete, confirm]);

  // Memoize icon elements
  const editIcon = useMemo(() => <Edit className="h-5 w-5" />, [])
  const copyIcon = useMemo(() => <Copy className="h-5 w-5" />, [])
  const shareIcon = useMemo(() => <Share2 className="h-5 w-5" />, [])
  const deleteIcon = useMemo(() => <Trash2 className="h-5 w-5" />, [])

  const contextMenuItems: ContextMenuItem[] = useMemo(() => [
    {
      label: 'Edit',
      icon: editIcon,
      onClick: () => setShowDetailModal(true),
    },
    {
      label: 'Copy Text',
      icon: copyIcon,
      onClick: handleCopyText,
    },
    {
      label: 'Share',
      icon: shareIcon,
      onClick: handleShare,
    },
    {
      label: 'Delete',
      icon: deleteIcon,
      onClick: handleDelete,
      variant: 'destructive' as const,
    },
  ], [editIcon, copyIcon, shareIcon, deleteIcon, handleCopyText, handleShare, handleDelete])

  return (
    <>
      <ContextMenu
        items={contextMenuItems}
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        title={memory.title}
      />

      <motion.div
        onClick={() => setShowDetailModal(true)}
        whileHover={{
          y: -2,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)'
        }}
        className="group block rounded-xl backdrop-blur-xl transition-all duration-300 break-inside-avoid border p-4 cursor-pointer relative"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
        }}
      >
        <CardHeader className="relative z-10 flex flex-row items-start justify-between p-0 pb-2">
          <h3 className="font-bold text-base leading-snug mb-1" style={{
            color: 'var(--premium-text-primary)'
          }}>
            {memory.title}
          </h3>
          <div className="flex items-center gap-1">
            {/* AI Analysis Dot (Interactive) */}
            <button
              onClick={handleAnalyze}
              className="w-2 h-2 rounded-full mr-2 transition-all duration-300 hover:scale-150 hover:shadow-[0_0_8px_rgba(6,182,212,0.6)] cursor-pointer"
              style={{
                backgroundColor: '#06b6d4', // Cyan-500
                opacity: 1
              }}
              title="Analyze with AI"
            />

            <Button
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(true);
              }}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 touch-manipulation hover:bg-white/10 transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
            </Button>
          </div>
        </CardHeader>

        <p className="text-sm leading-relaxed line-clamp-6 mb-3" style={{
          color: 'var(--premium-text-secondary)'
        }}>
          {memory.body}
        </p>

        {/* Attached Images */}
        {memory.image_urls && memory.image_urls.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg overflow-hidden h-24 relative">
            {memory.image_urls.slice(0, 2).map((url, i) => (
              <div key={url} className={`relative ${memory.image_urls!.length === 1 ? 'col-span-2' : ''} h-full`}>
                <OptimizedImage
                  src={url}
                  alt="Attachment"
                  className="w-full h-full"
                  aspectRatio="1/1"
                />
                {i === 1 && memory.image_urls!.length > 2 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                    <span className="text-white font-bold text-xs">+{memory.image_urls!.length - 2}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-xs pt-3 mt-3 border-t" style={{
          color: 'var(--premium-text-tertiary)',
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}>
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="h-3 w-3" />
            <span>{new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          {memory.tags && memory.tags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-hidden justify-end min-w-0">
              {memory.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap"
                  style={{
                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                    color: '#94a3b8'
                  }}
                >
                  {tag}
                </span>
              ))}
              {memory.tags.length > 2 && (
                <span className="text-[10px] opacity-40 shrink-0" style={{ color: '#94a3b8' }}>
                  +{memory.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <MemoryDetailModal
        memory={memory}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />
      {confirmDialog}
    </>
  )
})
