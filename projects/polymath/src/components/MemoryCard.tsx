import React, { useState, useEffect, memo, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import { CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import type { Memory, BridgeWithMemories } from '../types'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useToast } from './ui/toast'
import { haptic } from '../utils/haptics'
import { ContextMenu, type ContextMenuItem } from './ui/context-menu'
// import { MemoryLinks } from './MemoryLinks' // Moved to modal
// import { PinButton } from './PinButton' // Moved to modal or removed
// import { SuggestionBadge } from './SuggestionBadge' // Removed from card
// import { ConnectionsList } from './connections/ConnectionsList' // Moved to modal

import { GlassCard } from './ui/GlassCard'
import { SmartActionDot } from '../SmartActionDot'
import { MemoryDetailModal } from '../memories/MemoryDetailModal' // Import the new modal

// Module-level cache for bridges remains, but will be managed by MemoryDetailModal
const bridgesCache = new Map<string, { bridges: BridgeWithMemories[]; timestamp: number }>()
const BRIDGE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface MemoryCardProps {
  memory: Memory
  onEdit?: (memory: Memory) => void // Prop to trigger edit from outside
  onDelete?: (memory: Memory) => void // Prop to trigger delete from outside
}

export const MemoryCard = memo(function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const navigate = useNavigate()
  // const [bridges, setBridges] = useState<BridgeWithMemories[]>([]) // Moved to modal
  // const [bridgesFetched, setBridgesFetched] = useState(false) // Moved to modal
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false) // State for the detail modal
  
  const fetchBridgesForMemory = useMemoryStore((state) => state.fetchBridgesForMemory) // Still needed for context menu actions
  const deleteMemory = useMemoryStore((state) => state.deleteMemory)
  const { addToast } = useToast()

  // Removed long-press handlers as per new interaction model
  // Removed bridge fetching useEffect as it's now in the modal

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

  const handleDelete = useCallback(async () => {
    // This delete flow will bypass the modal's delete directly from the card's context menu
    if (!memory) return;

    const confirmed = await addToast({
      title: `Delete "${memory.title}"?`,
      description: 'This action cannot be undone. The thought will be permanently removed.',
      action: {
        label: 'Delete',
        onClick: () => true
      },
      variant: 'destructive',
    }).action.onClick(); // Fake promise resolve for confirm dialog

    if (confirmed) {
      try {
        await deleteMemory(memory.id);
        addToast({
          title: 'Thought deleted',
          description: `"${memory.title}" has been removed.`,
          variant: 'success',
        });
        // If onDelete prop exists, call it for external state updates (e.g., from MemoriesPage)
        onDelete?.(memory);
      } catch (error) {
        addToast({
          title: 'Failed to delete thought',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      }
    }
  }, [memory, deleteMemory, addToast, onDelete]);


  // Memoize icon elements to prevent recreation (THIS is what causes stack overflow)
  const editIcon = useMemo(() => <Edit className="h-5 w-5" />, [])
  const copyIcon = useMemo(() => <Copy className="h-5 w-5" />, [])
  const shareIcon = useMemo(() => <Share2 className="h-5 w-5" />, [])
  const deleteIcon = useMemo(() => <Trash2 className="h-5 w-5" />, [])

  const contextMenuItems: ContextMenuItem[] = useMemo(() => [
    {
      label: 'Edit',
      icon: editIcon,
      onClick: () => setShowDetailModal(true), // Open modal in edit mode or trigger edit from modal
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

      <GlassCard
        variant="muted"
        onClick={() => setShowDetailModal(true)} // Open detail modal on card click
      >
        <CardHeader className="relative z-10 flex flex-row items-start justify-between pb-2">
          <CardTitle className="text-lg font-semibold leading-tight flex-1 line-clamp-2 pr-8" style={{ color: 'var(--premium-text-primary)' }}>
            {memory.title}
          </CardTitle>
          <div className="flex items-center gap-1">
            {/* AI Analysis Dot */}
            <SmartActionDot color="var(--premium-indigo)" title="Analyze Thought" />
            {/* 3-dot menu */}
            <Button
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click from opening modal
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

        <CardDescription className="relative z-10 text-sm leading-relaxed line-clamp-3 px-6 pb-4" style={{ color: 'var(--premium-text-secondary)' }}>
          {memory.body}
        </CardDescription>

        {/* Footer with simplified date */}
        <div className="flex items-center gap-2 text-xs pt-3 mt-3 px-6 border-t" style={{
          color: 'var(--premium-text-tertiary)',
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}>
          <Calendar className="h-3 w-3" />
          <span>{new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </GlassCard>

      {/* Memory Detail Modal */}
      <MemoryDetailModal
        memory={memory}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />
    </>
  )
})

