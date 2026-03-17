import React, { useState, memo, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Edit, Trash2, Copy, Share2, Calendar, Link2, Pin, Sprout, Film, Book, Music, MapPin, Gamepad2, Monitor, FileText, Box } from 'lucide-react'
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
import { MarkdownRenderer } from './ui/MarkdownRenderer'

// List type → icon for provenance badge
const LIST_TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  film: Film, book: Book, music: Music, place: MapPin, game: Gamepad2,
  tech: Monitor, software: Monitor, article: FileText,
}
const getListIcon = (type?: string) => type ? (LIST_TYPE_ICON[type] || Box) : Box

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
import { CreateProjectDialog } from './projects/CreateProjectDialog'

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
        <CardHeader className="relative z-10 flex flex-row items-start justify-between gap-2 p-0 pb-2">
          <h3 className="font-bold text-base leading-snug mb-1 flex-1 min-w-0 line-clamp-2" style={{ color: "var(--brand-primary)" }}>
            {memory.title}
          </h3>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Pin Button */}
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg transition-all ${
                memory.is_pinned
                  ? 'text-brand-text-secondary'
                  : 'text-[var(--brand-text-muted)] opacity-30 active:opacity-80'
              }`}
              title={memory.is_pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="w-3.5 h-3.5" style={memory.is_pinned ? { fill: 'currentColor' } : undefined} />
            </button>

            {/* AI Analysis Dot (Interactive) */}
            <button
              onClick={handleAnalyze}
              className="w-5 h-5 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-[rgba(6,182,212,0.15)] cursor-pointer"
              title="Analyze with AI"
            >
              <span
                className="w-2 h-2 rounded-full block"
                style={{ backgroundColor: '#06b6d4' }}
              />
            </button>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(true);
              }}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 touch-manipulation hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
            </Button>
          </div>
        </CardHeader>

        {/* List-item provenance badge */}
        {memory.source_reference?.type === 'list_item' && memory.source_reference.title && (() => {
          const ListIcon = getListIcon(memory.source_reference?.list_type)
          return (
            <div className="flex items-center gap-1 mb-2">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide"
                style={{
                  background: 'rgba(251,191,36,0.1)',
                  border: '1.5px solid rgba(251,191,36,0.25)',
                  color: 'rgba(251,191,36,0.8)',
                }}
              >
                <ListIcon className="w-2.5 h-2.5" />
                {memory.source_reference.title}
              </span>
            </div>
          )
        })()}

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

        {/* Body text preview */}
        <MarkdownRenderer
          content={memory.body}
          className="text-sm mb-3 line-clamp-5"
          style={{ color: "var(--brand-primary)" }}
        />

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

        <div className="flex items-center justify-between gap-2 text-[10px] pt-3 mt-3 border-t font-semibold uppercase tracking-wider" style={{
          color: 'var(--brand-text-muted)',
          borderColor: 'var(--glass-surface-hover)'
        }}>
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="h-3 w-3" />
            <span>{new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {/* Seed as project — always-visible, low-profile */}
            <button
              onClick={(e) => { e.stopPropagation(); setSeedProjectOpen(true) }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded active:scale-95 transition-transform"
              style={{
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.2)',
                color: '#34d399',
                fontSize: '9px',
                fontWeight: 900,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
              title="Turn into a project"
            >
              <Sprout className="w-2.5 h-2.5" />
              Grow
            </button>
          </div>

          {memory.tags && memory.tags.length > 0 && (
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
