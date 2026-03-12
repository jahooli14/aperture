import React, { useState, memo, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Edit, Trash2, Copy, Share2, Calendar, Zap, Link2, Pin, Maximize2, CheckSquare } from 'lucide-react'
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
import { motion, AnimatePresence } from 'framer-motion'

// Memory type badge config
const MEMORY_TYPE_CONFIG = {
  foundational: { emoji: '', label: 'FOUNDATIONAL', color: "var(--brand-text-secondary)" },
  insight: { emoji: '', label: 'INSIGHT', color: "var(--brand-text-secondary)" },
  event: { emoji: '', label: 'EVENT', color: "var(--brand-text-secondary)" },
  'quick-note': { emoji: '', label: 'NOTE', color: "var(--brand-text-secondary)" },
} as const

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
  connectionCount?: number
}

import { OptimizedImage } from './ui/optimized-image'

export const MemoryCard = memo(function MemoryCard({ memory, onEdit, onDelete, connectionCount }: MemoryCardProps) {
  const navigate = useNavigate()
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Long-press detection: hold > 400ms opens full modal
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      haptic.medium()
      setShowDetailModal(true)
    }, 400)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleCardClick = useCallback(() => {
    // If long press already fired, don't also toggle expand
    if (didLongPress.current) return
    setExpanded(prev => !prev)
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

  // Detect if this is an offline/pending memory
  const isOfflinePending = memory.id.startsWith('offline_') || memory.tags?.includes('offline-pending')

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
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="group block rounded-lg transition-all duration-200 break-inside-avoid p-4 cursor-pointer relative"
        style={{
          background: '#111113',
          border: isOfflinePending
            ? '2px solid var(--glass-surface)'
            : memory.is_pinned
              ? '2px solid rgba(251,191,36,0.4)'
              : '2px solid rgba(255,255,255,0.1)',
          boxShadow: memory.is_pinned
            ? '3px 3px 0 rgba(251,191,36,0.2)'
            : '3px 3px 0 rgba(0,0,0,0.8)',
          opacity: isOfflinePending ? 0.6 : 1
        }}
      >
        <CardHeader className="relative z-10 flex flex-row items-start justify-between p-0 pb-2">
          <h3 className="font-bold text-base leading-snug mb-1" style={{ color: "var(--brand-primary)" }}>
            {memory.title}
          </h3>
          <div className="flex items-center gap-1">
            {/* Pin Button */}
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg transition-all ${
                memory.is_pinned
                  ? 'text-brand-text-secondary hover:bg-brand-primary/10'
                  : 'text-brand-text-primary0 hover:text-brand-text-secondary hover:bg-brand-surface/80 opacity-0 group-hover:opacity-100'
              }`}
              title={memory.is_pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="w-3.5 h-3.5" style={memory.is_pinned ? { fill: 'currentColor' } : undefined} />
            </button>

            {/* Find Similar Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/search?similar=${memory.id}`)
              }}
              className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.1)] text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)] transition-all"
              title="Find similar"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>

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
              className="h-8 w-8 p-0 touch-manipulation hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
            </Button>
          </div>
        </CardHeader>

        {/* Memory type badge + connection count */}
        {(memory.memory_type || (connectionCount !== undefined && connectionCount > 0)) && (
          <div className="flex items-center gap-2 mb-2">
            {memory.memory_type && MEMORY_TYPE_CONFIG[memory.memory_type] && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide"
                style={{
                  backgroundColor: MEMORY_TYPE_CONFIG[memory.memory_type].color,
                  border: MEMORY_TYPE_CONFIG[memory.memory_type].border,
                  color: MEMORY_TYPE_CONFIG[memory.memory_type].text,
                }}
              >
                <span>{MEMORY_TYPE_CONFIG[memory.memory_type].emoji}</span>
                {MEMORY_TYPE_CONFIG[memory.memory_type].label}
              </span>
            )}
            {connectionCount !== undefined && connectionCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide"
                style={{
                  backgroundColor: 'rgba(52,211,153,0.1)',
                  border: '1.5px solid rgba(52,211,153,0.3)',
                  color: "var(--brand-text-secondary)",
                }}
              >
                <Link2 className="w-2.5 h-2.5" />
                {connectionCount}
              </span>
            )}
          </div>
        )}

        <motion.p
          layout="position"
          className={`text-sm leading-relaxed mb-3 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-6'}`}
          style={{ color: "var(--brand-primary)" }}
        >
          {memory.body}
        </motion.p>

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
                    <span className="text-[var(--brand-text-primary)] font-bold text-xs">+{memory.image_urls!.length - 2}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Expanded: show all tags + themes + quick actions */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Themes */}
              {memory.themes && memory.themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {memory.themes.map((theme) => (
                    <span
                      key={theme}
                      className="px-2 py-0.5 text-[10px] font-medium rounded-lg uppercase tracking-wide"
                      style={{
                        backgroundColor: 'rgba(139,92,246,0.1)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        color: "var(--brand-text-secondary)",
                      }}
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              )}

              {/* All tags when expanded */}
              {memory.tags && memory.tags.length > 2 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {memory.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg uppercase tracking-wide whitespace-nowrap"
                      style={{
                        backgroundColor: 'rgba(148,163,184,0.08)',
                        border: '1px solid rgba(148,163,184,0.2)',
                        color: "var(--brand-text-secondary)"
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick actions row */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDetailModal(true) }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-lg transition-colors hover:bg-brand-surface/80"
                  style={{ color: "var(--brand-primary)" }}
                >
                  <Maximize2 className="w-3 h-3" />
                  Open
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyText() }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-lg transition-colors hover:bg-brand-surface/80"
                  style={{ color: "var(--brand-primary)" }}
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
                <button
                  onClick={handleTogglePin}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-lg transition-colors hover:bg-brand-surface/80 ${
                    memory.is_pinned ? 'text-brand-text-secondary' : ''
                  }`}
                  style={memory.is_pinned ? undefined : { color: 'var(--brand-text-secondary)' }}
                >
                  <Pin className="w-3 h-3" style={memory.is_pinned ? { fill: 'currentColor' } : undefined} />
                  {memory.is_pinned ? 'Unpin' : 'Pin'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-2 text-[10px] pt-3 mt-3 border-t font-semibold uppercase tracking-wider" style={{
          color: 'var(--brand-text-muted)',
          borderColor: 'var(--glass-surface-hover)'
        }}>
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="h-3 w-3" />
            <span>{new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          {!expanded && memory.tags && memory.tags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-hidden justify-end min-w-0">
              {memory.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-lg uppercase tracking-wide whitespace-nowrap"
                  style={{
                    backgroundColor: 'rgba(148,163,184,0.08)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    color: "var(--brand-text-secondary)"
                  }}
                >
                  {tag}
                </span>
              ))}
              {memory.tags.length > 2 && (
                <span className="text-[10px] opacity-40 shrink-0" style={{ color: "var(--brand-primary)" }}>
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
