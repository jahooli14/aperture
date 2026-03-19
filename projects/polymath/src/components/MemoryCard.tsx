import React, { useState, memo, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Trash2, Copy, Share2, Link2, Pin, Sprout, Film, Book, Music, MapPin, Gamepad2, Monitor, FileText, Box } from 'lucide-react'
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

    const bulletMatch = line.match(/^[-*•·]\s+(.+)/)
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1].replace(/\*\*|__|\*|_/g, '').trim())
      continue
    }

    const numberedMatch = line.match(/^\d+\.\s+(.+)/)
    if (numberedMatch) {
      bulletBuffer.push(numberedMatch[1].replace(/\*\*|__|\*|_/g, '').trim())
      continue
    }

    flushBullets()

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

// Memory type badge config
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

// Unused but keep for bridgesCache compat with MemoryDetailModal
const bridgesCache = new Map<string, { bridges: BridgeWithMemories[]; timestamp: number }>()

import { OptimizedImage } from './ui/optimized-image'
import { CreateProjectDialog } from './projects/CreateProjectDialog'

const LONG_PRESS_MS = 450

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
  const [pressing, setPressing] = useState(false)

  // Long press refs — avoid stale closures and prevent state thrashing
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)
  const pointerMoved = useRef(false)
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)

  const { setContext, toggleSidebar } = useContextEngineStore()
  const deleteMemory = useMemoryStore((state) => state.deleteMemory)
  const pinMemory = useMemoryStore((state) => state.pinMemory)
  const unpinMemory = useMemoryStore((state) => state.unpinMemory)
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setPressing(false)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only primary button / touch
    if (e.pointerType === 'mouse' && e.button !== 0) return
    didLongPress.current = false
    pointerMoved.current = false
    pressOrigin.current = { x: e.clientX, y: e.clientY }
    setPressing(true)

    longPressTimer.current = setTimeout(() => {
      if (pointerMoved.current) return
      didLongPress.current = true
      setPressing(false)
      haptic.medium?.() ?? haptic.light()
      setShowContextMenu(true)
    }, LONG_PRESS_MS)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pressOrigin.current) return
    const dx = Math.abs(e.clientX - pressOrigin.current.x)
    const dy = Math.abs(e.clientY - pressOrigin.current.y)
    if (dx > 6 || dy > 6) {
      pointerMoved.current = true
      cancelLongPress()
    }
  }, [cancelLongPress])

  const handlePointerUp = useCallback(() => {
    cancelLongPress()
  }, [cancelLongPress])

  const handleClick = useCallback(() => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    haptic.light()
    setShowDetailModal(true)
  }, [])

  const handleTogglePin = useCallback(() => {
    if (memory.is_pinned) {
      unpinMemory(memory.id)
    } else {
      pinMemory(memory.id)
      haptic.success()
    }
  }, [memory.id, memory.is_pinned, pinMemory, unpinMemory])

  const handleCopyText = useCallback(() => {
    const textToCopy = `${memory.title}\n\n${memory.body}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      haptic.success()
      addToast({ title: 'Copied!', description: 'Thought text copied to clipboard', variant: 'success' })
    })
  }, [memory.title, memory.body, addToast])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: memory.title, text: memory.body })
        haptic.success()
      } catch {
        // cancelled
      }
    } else {
      handleCopyText()
    }
  }, [memory.title, memory.body, handleCopyText])

  const handleDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: `Delete "${memory.title}"?`,
      description: 'This action cannot be undone. The thought will be permanently removed.',
      confirmText: 'Delete',
      variant: 'destructive',
    })
    if (confirmed) {
      try {
        await deleteMemory(memory.id)
        addToast({ title: 'Thought deleted', description: `"${memory.title}" has been removed.`, variant: 'success' })
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
      label: 'Open',
      icon: <Edit className="h-5 w-5" />,
      onClick: () => setShowDetailModal(true),
    },
    {
      label: memory.is_pinned ? 'Unpin' : 'Pin',
      icon: <Pin className="h-5 w-5" />,
      onClick: handleTogglePin,
    },
    {
      label: 'Analyse with AI',
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
      label: 'Copy text',
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
  ], [memory, handleTogglePin, handleCopyText, handleShare, handleDelete, setContext, toggleSidebar])

  const isOfflinePending = memory.id.startsWith('offline_') || memory.tags?.includes('offline-pending')
  const typeConfig = memory.memory_type ? MEMORY_TYPE_CONFIG[memory.memory_type] : null
  const displayDate = new Date(memory.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
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
        animate={{ scale: pressing ? 0.97 : 1, opacity: pressing ? 0.85 : isOfflinePending ? 0.55 : 1 }}
        transition={{ duration: 0.12 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        className="rounded-xl break-inside-avoid cursor-pointer select-none touch-pan-y"
        style={{
          background: '#111113',
          border: isOfflinePending
            ? '1px solid rgba(255,255,255,0.06)'
            : memory.is_pinned
              ? '1px solid rgba(251,191,36,0.35)'
              : '1px solid rgba(255,255,255,0.08)',
          boxShadow: memory.is_pinned
            ? '0 0 0 1px rgba(251,191,36,0.08), 0 2px 12px rgba(0,0,0,0.5)'
            : '0 2px 12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Title row — pin dot when pinned, no buttons */}
        <div className="flex items-start gap-1.5 px-3 pt-3 pb-0">
          <h3
            className="flex-1 min-w-0 font-semibold text-[10px] leading-snug line-clamp-1"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            {memory.title}
          </h3>
          {memory.is_pinned && (
            <Pin
              className="w-2 h-2 flex-shrink-0 mt-0.5"
              style={{ color: 'rgba(251,191,36,0.7)', fill: 'rgba(251,191,36,0.7)' }}
            />
          )}
        </div>

        {/* Source reference badge */}
        {memory.source_reference?.type === 'list_item' && memory.source_reference.title && (() => {
          const ListIcon = getListIcon(memory.source_reference?.list_type)
          return (
            <div className="px-3 pt-1">
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

        {/* Body preview — plain prose so line-clamp uses real content */}
        <p
          className="px-3 pt-1.5 pb-0 text-[11px] leading-relaxed line-clamp-4"
          style={{ color: 'var(--brand-text-muted)' }}
        >
          {toPreviewText(memory.body)}
        </p>

        {/* Attached Images */}
        {memory.image_urls && memory.image_urls.length > 0 && (
          <div className="mx-3 mt-2 rounded-lg overflow-hidden">
            <div className={`grid gap-0.5 ${memory.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {memory.image_urls.slice(0, 2).map((url, i) => (
                <div key={url} className="relative aspect-[4/3] overflow-hidden">
                  <OptimizedImage src={url} alt="Attachment" className="w-full h-full object-cover" aspectRatio="4/3" />
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

        {/* Footer: date + badges */}
        <div
          className="flex items-center justify-between gap-2 px-3 pt-1.5 pb-2.5 mt-1.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span
            className="text-[10px] tabular-nums"
            style={{ color: 'var(--brand-text-muted)', opacity: 0.5 }}
          >
            {displayDate}
          </span>

          <div className="flex items-center gap-1.5 flex-shrink-0">
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

            {typeConfig ? (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                style={{ background: typeConfig.bg, border: typeConfig.border, color: typeConfig.text }}
              >
                {typeConfig.label}
              </span>
            ) : firstTag ? (
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
            ) : null}
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
            action: { label: 'View project →', onClick: () => navigate(`/projects/${projectId}`) },
          })
          try {
            await fetch('/api/connections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_type: 'memory', source_id: memory.id,
                target_type: 'project', target_id: projectId,
                connection_type: 'inspired_by', created_by: 'user',
                reasoning: 'Project seeded from this thought',
              }),
            })
          } catch {
            // silent fail
          }
        }}
      />

      {confirmDialog}
    </>
  )
})
