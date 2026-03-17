import React, { useState, memo, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Edit, Trash2, Copy, Share2, Calendar, Link2, Pin, Sprout, Film, Book, Music, MapPin, Gamepad2, Monitor, FileText, Box } from 'lucide-react'
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

/**
 * Collapse markdown into a single readable prose string for card previews.
 * - Bullet/list items → joined inline with " · "
 * - Headers, bold, italic markers stripped
 * - Blank lines collapsed to a single space
 * This lets line-clamp work on actual content, not list chrome.
 */
function toPreviewText(md: string): string {
  const lines = md.split('\n')
  const segments: string[] = []
  const bulletBuffer: string[] = []

  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      segments.push(bulletBuffer.join(' · '))
      bulletBuffer.length = 0
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Bullet list line: - item / * item / • item / · item
    const bulletMatch = line.match(/^[-*•·]\s+(.+)/)
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1].replace(/\*\*|__|\*|_/g, '').trim())
      continue
    }

    // Numbered list: 1. item
    const numberedMatch = line.match(/^\d+\.\s+(.+)/)
    if (numberedMatch) {
      bulletBuffer.push(numberedMatch[1].replace(/\*\*|__|\*|_/g, '').trim())
      continue
    }

    // Non-list line — flush any buffered bullets first
    flushBullets()

    // Strip markdown: headers, bold, italic, inline code
    const clean = line
      .replace(/^#{1,6}\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .trim()

    if (clean) segments.push(clean)
  }

  flushBullets()
  return segments.join(' ')
}

// List type → icon for provenance badge
const LIST_TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  film: Film, book: Book, music: Music, place: MapPin, game: Gamepad2,
  tech: Monitor, software: Monitor, article: FileText,
}
const getListIcon = (type?: string) => type ? (LIST_TYPE_ICON[type] || Box) : Box

// Memory type badge config — each has distinct, readable colors
const MEMORY_TYPE_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  foundational: {
    label: 'Core',
    bg: 'rgba(59,130,246,0.12)',
    border: '1px solid rgba(59,130,246,0.3)',
    text: 'rgba(147,197,253,0.9)',
  },
  insight: {
    label: 'Insight',
    bg: 'rgba(139,92,246,0.12)',
    border: '1px solid rgba(139,92,246,0.3)',
    text: 'rgba(196,181,253,0.9)',
  },
  event: {
    label: 'Event',
    bg: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    text: 'rgba(110,231,183,0.9)',
  },
  'quick-note': {
    label: 'Note',
    bg: 'rgba(148,163,184,0.08)',
    border: '1px solid rgba(148,163,184,0.2)',
    text: 'rgba(148,163,184,0.75)',
  },
}

// Module-level cache for bridges remains, but will be managed by MemoryDetailModal
const bridgesCache = new Map<string, { bridges: BridgeWithMemories[]; timestamp: number }>()

import { OptimizedImage } from './ui/optimized-image'
import { CreateProjectDialog } from './projects/CreateProjectDialog'

interface MemoryCardProps {
  memory: Memory
  onEdit?: (memory: Memory) => void
  onDelete?: (memory: Memory) => void
  connectionCount?: number
}

export const MemoryCard = memo(function MemoryCard({ memory, onEdit, onDelete, connectionCount }: MemoryCardProps) {
  const navigate = useNavigate()
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [seedProjectOpen, setSeedProjectOpen] = useState(false)

  const handleCardClick = useCallback(() => {
    haptic.light()
    setShowDetailModal(true)
  }, [])

  const { setContext, toggleSidebar } = useContextEngineStore()
  const deleteMemory = useMemoryStore((state) => state.deleteMemory)
  const pinMemory = useMemoryStore((state) => state.pinMemory)
  const unpinMemory = useMemoryStore((state) => state.unpinMemory)
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

  const handleTogglePin = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (memory.is_pinned) {
      unpinMemory(memory.id)
    } else {
      pinMemory(memory.id)
      haptic.success()
    }
  }, [memory.id, memory.is_pinned, pinMemory, unpinMemory])

  const handleAnalyze = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setContext('memory', memory.id, memory.title, `${memory.title}\n\n${memory.body}`)
    toggleSidebar(true)
  }, [memory.id, memory.title, memory.body, setContext, toggleSidebar])

  const handleDelete = useCallback(async () => {
    if (!memory) return

    const confirmed = await confirm({
      title: `Delete "${memory.title}"?`,
      description: 'This action cannot be undone. The thought will be permanently removed.',
      confirmText: 'Delete',
      variant: 'destructive',
    })

    if (confirmed) {
      try {
        await deleteMemory(memory.id)
        addToast({
          title: 'Thought deleted',
          description: `"${memory.title}" has been removed.`,
          variant: 'success',
        })
        onDelete?.(memory)
      } catch (error) {
        addToast({
          title: 'Failed to delete thought',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        })
      }
    }
  }, [memory, deleteMemory, addToast, onDelete, confirm])

  const contextMenuItems: ContextMenuItem[] = useMemo(() => [
    {
      label: 'Edit',
      icon: <Edit className="h-5 w-5" />,
      onClick: () => setShowDetailModal(true),
    },
    {
      label: memory.is_pinned ? 'Unpin' : 'Pin',
      icon: <Pin className="h-5 w-5" />,
      onClick: (e?: React.MouseEvent) => {
        if (e) handleTogglePin(e as React.MouseEvent)
        else {
          memory.is_pinned ? unpinMemory(memory.id) : pinMemory(memory.id)
        }
      },
    },
    {
      label: 'Analyze with AI',
      icon: <span className="w-5 h-5 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-[#06b6d4] block" /></span>,
      onClick: () => {
        setContext('memory', memory.id, memory.title, `${memory.title}\n\n${memory.body}`)
        toggleSidebar(true)
      },
    },
    {
      label: 'Grow into project',
      icon: <Sprout className="h-5 w-5" />,
      onClick: () => setSeedProjectOpen(true),
    },
    {
      label: 'Copy Text',
      icon: <Copy className="h-5 w-5" />,
      onClick: handleCopyText,
    },
    {
      label: 'Share',
      icon: <Share2 className="h-5 w-5" />,
      onClick: handleShare,
    },
    {
      label: 'Delete',
      icon: <Trash2 className="h-5 w-5" />,
      onClick: handleDelete,
      variant: 'destructive' as const,
    },
  ], [memory, handleTogglePin, handleCopyText, handleShare, handleDelete, pinMemory, unpinMemory, setContext, toggleSidebar])

  const isOfflinePending = memory.id.startsWith('offline_') || memory.tags?.includes('offline-pending')

  const typeConfig = memory.memory_type ? MEMORY_TYPE_CONFIG[memory.memory_type] : null

  const displayDate = new Date(memory.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const firstTag = memory.tags?.find(t => t !== 'offline-pending')

  return (
    <>
      <ContextMenu
        items={contextMenuItems}
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        title={memory.title}
      />

      <motion.div
        layout
        onClick={handleCardClick}
        className="group block rounded-xl transition-colors duration-150 break-inside-avoid cursor-pointer relative"
        style={{
          background: '#111113',
          border: isOfflinePending
            ? '1px solid rgba(255,255,255,0.06)'
            : memory.is_pinned
              ? '1px solid rgba(251,191,36,0.35)'
              : '1px solid rgba(255,255,255,0.08)',
          boxShadow: memory.is_pinned
            ? '0 0 0 1px rgba(251,191,36,0.1), 0 2px 12px rgba(0,0,0,0.5)'
            : '0 2px 12px rgba(0,0,0,0.5)',
          opacity: isOfflinePending ? 0.55 : 1,
        }}
      >
        {/* Card header: title + actions */}
        <div className="flex items-start gap-2 px-3.5 pt-3.5 pb-0">
          <h3
            className="flex-1 min-w-0 font-semibold text-sm leading-snug line-clamp-2"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            {memory.title}
          </h3>

          <div className="flex items-center gap-0.5 flex-shrink-0 -mt-0.5">
            {/* Pin — shown filled when pinned, ghost on hover when unpinned */}
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg transition-all ${
                memory.is_pinned
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-40 active:opacity-80'
              }`}
              style={{ color: memory.is_pinned ? 'rgba(251,191,36,0.9)' : 'var(--brand-text-muted)' }}
              title={memory.is_pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="w-3 h-3" style={memory.is_pinned ? { fill: 'currentColor' } : undefined} />
            </button>

            {/* Context menu trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowContextMenu(true)
              }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-60 active:opacity-100 transition-opacity"
              style={{ color: 'var(--brand-text-muted)' }}
              aria-label="More options"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Source reference badge */}
        {memory.source_reference?.type === 'list_item' && memory.source_reference.title && (() => {
          const ListIcon = getListIcon(memory.source_reference?.list_type)
          return (
            <div className="px-3.5 pt-2">
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  color: 'rgba(251,191,36,0.7)',
                }}
              >
                <ListIcon className="w-2.5 h-2.5" />
                {memory.source_reference.title}
              </span>
            </div>
          )
        })()}

        {/* Body text — plain prose preview so line-clamp works on content, not list chrome */}
        <p
          className="px-3.5 pt-2 pb-0 text-xs leading-relaxed line-clamp-4"
          style={{ color: 'var(--brand-text-muted)' }}
        >
          {toPreviewText(memory.body)}
        </p>

        {/* Attached Images */}
        {memory.image_urls && memory.image_urls.length > 0 && (
          <div className="mx-3.5 mt-2.5 rounded-lg overflow-hidden relative" style={{ height: '100px' }}>
            <div className={`grid h-full gap-0.5 ${memory.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {memory.image_urls.slice(0, 2).map((url, i) => (
                <div key={url} className="relative h-full overflow-hidden">
                  <OptimizedImage
                    src={url}
                    alt="Attachment"
                    className="w-full h-full object-cover"
                    aspectRatio="1/1"
                  />
                  {i === 1 && memory.image_urls!.length > 2 && (
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                      <span className="text-white font-semibold text-xs">+{memory.image_urls!.length - 2}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer: date · tag · type badge */}
        <div
          className="flex items-center justify-between gap-2 px-3.5 pt-2.5 pb-3 mt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="h-2.5 w-2.5 flex-shrink-0" style={{ color: 'var(--brand-text-muted)', opacity: 0.5 }} />
            <span className="text-[10px] font-medium tabular-nums" style={{ color: 'var(--brand-text-muted)', opacity: 0.6 }}>
              {displayDate}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Connection count */}
            {connectionCount !== undefined && connectionCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                style={{
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  color: 'rgba(52,211,153,0.7)',
                }}
              >
                <Link2 className="w-2 h-2" />
                {connectionCount}
              </span>
            )}

            {/* Memory type badge */}
            {typeConfig && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                style={{
                  background: typeConfig.bg,
                  border: typeConfig.border,
                  color: typeConfig.text,
                }}
              >
                {typeConfig.label}
              </span>
            )}

            {/* First tag */}
            {firstTag && !typeConfig && (
              <span
                className="px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate max-w-[80px]"
                style={{
                  background: 'rgba(148,163,184,0.06)',
                  border: '1px solid rgba(148,163,184,0.15)',
                  color: 'rgba(148,163,184,0.6)',
                }}
              >
                {firstTag}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <MemoryDetailModal
        memory={memory}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />

      <CreateProjectDialog
        isOpen={seedProjectOpen}
        onOpenChange={setSeedProjectOpen}
        hideTrigger
        initialTitle={memory.title}
        initialDescription={memory.body?.slice(0, 500)}
        onCreated={async (projectId) => {
          addToast({
            title: 'Project created',
            description: 'Your thought has been grown into a project.',
            variant: 'success',
            action: {
              label: 'View project →',
              onClick: () => navigate(`/projects/${projectId}`)
            }
          })
          try {
            await fetch('/api/connections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_type: 'memory',
                source_id: memory.id,
                target_type: 'project',
                target_id: projectId,
                connection_type: 'inspired_by',
                created_by: 'user',
                reasoning: 'Project seeded from this thought'
              })
            })
          } catch (err) {
            // silent fail
          }
        }}
      />

      {confirmDialog}
    </>
  )
})
