/**
 * MemoryCard Component - Stunning Visual Design
 */

import React, { useState, useEffect, memo, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Brain, Calendar, User, Tag, Edit, Trash2, ChevronDown, ChevronUp, Copy, Share2, Pin, MoreVertical } from 'lucide-react'
import { Button } from './ui/button'
import type { Memory, BridgeWithMemories } from '../types'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useToast } from './ui/toast'
import { haptic } from '../utils/haptics'
import { useLongPress } from '../hooks/useLongPress'
import { ContextMenu, type ContextMenuItem } from './ui/context-menu'
import { MemoryLinks } from './MemoryLinks'
import { PinButton } from './PinButton'
import { SuggestionBadge } from './SuggestionBadge'
import { ConnectionsList } from './connections/ConnectionsList'

// Module-level cache to prevent refetching bridges during Virtuoso scroll remounts
const bridgesCache = new Map<string, { bridges: BridgeWithMemories[]; timestamp: number }>()
const BRIDGE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface MemoryCardProps {
  memory: Memory
  onEdit?: (memory: Memory) => void
  onDelete?: (memory: Memory) => void
}

export const MemoryCard = memo(function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const navigate = useNavigate()
  const [bridges, setBridges] = useState<BridgeWithMemories[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [bridgesFetched, setBridgesFetched] = useState(false) // Track if we've fetched bridges
  const fetchBridgesForMemory = useMemoryStore((state) => state.fetchBridgesForMemory)
  const { addToast } = useToast()

  // Removed swipe gesture - deletion now requires confirmation only

  // Long-press for context menu
  const longPressHandlers = useLongPress(() => {
    setShowContextMenu(true)
  }, {
    threshold: 500,
  })

  // Load bridges only when memory.id changes, using module-level cache
  // This prevents constant refetching during Virtuoso scroll remounts
  useEffect(() => {
    if (memory.id.startsWith('temp_')) {
      setBridges([])
      setBridgesFetched(true)
      return
    }

    // Check cache first
    const cached = bridgesCache.get(memory.id)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < BRIDGE_CACHE_TTL) {
      // Use cached bridges - no network request!
      setBridges(cached.bridges)
      setBridgesFetched(true)
      return
    }

    // Fetch bridges and update cache
    fetchBridgesForMemory(memory.id).then((fetchedBridges) => {
      bridgesCache.set(memory.id, { bridges: fetchedBridges, timestamp: now })
      setBridges(fetchedBridges)
      setBridgesFetched(true)
    })
  }, [memory.id, fetchBridgesForMemory])

  // Callback for refreshing bridges after connections change
  const loadMemoryBridges = useCallback(() => {
    if (memory.id.startsWith('temp_')) {
      setBridges([])
      setBridgesFetched(true)
      return
    }
    // Invalidate cache and force refetch
    bridgesCache.delete(memory.id)
    fetchBridgesForMemory(memory.id).then((fetchedBridges) => {
      const now = Date.now()
      bridgesCache.set(memory.id, { bridges: fetchedBridges, timestamp: now })
      setBridges(fetchedBridges)
      setBridgesFetched(true)
    })
  }, [memory.id, fetchBridgesForMemory])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const memoryTypeConfig: Record<
    string,
    { label: string; style: React.CSSProperties }
  > = {
    foundational: {
      label: 'Foundational',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: 'var(--premium-blue)'
      }
    },
    event: {
      label: 'Event',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: 'var(--premium-blue)'
      }
    },
    insight: {
      label: 'Insight',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: 'var(--premium-blue)'
      }
    },
  }

  const isManual = memory.audiopen_id?.startsWith('manual_')

  // Swipe gesture removed - users must use explicit buttons

  // Memoize handlers to prevent recreation on every render (critical for preventing stack overflow)
  const handleCopyText = useCallback(() => {
    const textToCopy = `${memory.title}\n\n${memory.body}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      haptic.success()
    })
  }, [memory.title, memory.body])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: memory.title,
          text: memory.body,
        })
        haptic.success()
      } catch (error) {
        // User cancelled or error occurred
        console.warn('Share cancelled or failed:', error)
      }
    } else {
      // Fallback to copy
      handleCopyText()
    }
  }, [memory.title, memory.body, handleCopyText])

  // Memoize content string to prevent ConnectionsList from refetching on every render
  const memoryContent = useMemo(() => `${memory.title}\n\n${memory.body}`, [memory.title, memory.body])

  // Memoize icon elements to prevent recreation (THIS is what causes stack overflow)
  const editIcon = useMemo(() => <Edit className="h-5 w-5" />, [])
  const copyIcon = useMemo(() => <Copy className="h-5 w-5" />, [])
  const shareIcon = useMemo(() => <Share2 className="h-5 w-5" />, [])
  const deleteIcon = useMemo(() => <Trash2 className="h-5 w-5" />, [])

  const contextMenuItems: ContextMenuItem[] = useMemo(() => [
    ...(onEdit ? [{
      label: 'Edit',
      icon: editIcon,
      onClick: () => onEdit(memory),
    }] : []),
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
    ...(onDelete ? [{
      label: 'Delete',
      icon: deleteIcon,
      onClick: () => onDelete(memory),
      variant: 'destructive' as const,
    }] : []),
  ], [memory.id, onEdit, onDelete, handleCopyText, handleShare, editIcon, copyIcon, shareIcon, deleteIcon])

  return (
    <>
      <ContextMenu
        items={contextMenuItems}
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        title={memory.title}
      />

      <div className="relative" {...longPressHandlers}>
        <motion.div
          whileHover={{ y: -6, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 28,
            mass: 0.6
          }}
        >
          <Card className="group h-full flex flex-col relative overflow-hidden" style={{
            background: 'var(--premium-bg-2)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}>

            <CardHeader className="relative z-10">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg font-semibold leading-tight flex-1" style={{ color: 'var(--premium-text-primary)' }}>
                  {memory.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {isManual && (
                    <div className="px-2 py-1 rounded-md text-xs font-medium" style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--premium-blue)'
                    }}>
                      Manual
                    </div>
                  )}
                  <SuggestionBadge itemId={memory.id} itemType="thought" />
                  <PinButton
                    type="thought"
                    id={memory.id}
                    title={memory.title}
                    content={
                      <div className="p-6 overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--premium-text-primary)' }}>
                          {memory.title}
                        </h2>
                        <div className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                          {memory.body}
                        </div>
                        {memory.tags && memory.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {memory.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 rounded-md text-xs font-medium"
                                style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                  color: 'var(--premium-blue)'
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                  />
                  {(onEdit || onDelete) && (
                    <Button
                      onClick={() => setShowContextMenu(true)}
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0 touch-manipulation hover:bg-white/10 transition-colors"
                      aria-label="More options"
                    >
                      <MoreVertical className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative z-10 flex-1 space-y-4">
              {/* Body Text - Compact Preview */}
              <div>
                <CardDescription className={`text-sm leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`} style={{ color: 'var(--premium-text-secondary)' }}>
                  {memory.body}
                </CardDescription>

                {/* Show More/Less Button */}
                {memory.body && memory.body.length > 120 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-sm font-medium transition-colors flex items-center gap-1 touch-manipulation hover:opacity-80"
                      style={{ color: 'var(--premium-blue)' }}
                      aria-label={isExpanded ? 'Show less' : 'Show more'}
                    >
                      {isExpanded ? (
                        <>
                          Show less <ChevronUp className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Show more <ChevronDown className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>


              {/* AI Enrichment - Knowledge Nodes (The "So What") */}
              {memory.processed && (
                <div className="space-y-3 pt-3 mt-2 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--premium-emerald)' }}>
                        Knowledge Nodes Extracted
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-300/60">
                      Fueling your graph
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* People Nodes */}
                    {memory.entities?.people?.slice(0, 3).map((person) => (
                      <div
                        key={person}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-blue-500/20 bg-blue-500/10"
                      >
                        <User className="h-3 w-3 text-blue-400" />
                        <span className="text-xs font-medium text-blue-100">{person}</span>
                      </div>
                    ))}

                    {/* Topic Nodes */}
                    {memory.entities?.topics?.slice(0, 3).map((topic) => (
                      <div
                        key={topic}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-purple-500/20 bg-purple-500/10"
                      >
                        <Brain className="h-3 w-3 text-purple-400" />
                        <span className="text-xs font-medium text-purple-100">{topic}</span>
                      </div>
                    ))}

                    {/* Theme Nodes */}
                    {memory.themes?.slice(0, 2).map((theme) => (
                      <div
                        key={theme}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-500/20 bg-amber-500/10"
                      >
                        <Tag className="h-3 w-3 text-amber-400" />
                        <span className="text-xs font-medium text-amber-100">{theme}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bi-Directional Memory Links */}
              <MemoryLinks
                currentMemoryId={memory.id}
                bridges={bridges}
              />

              {/* AI Connection Discovery - Always show for processed thoughts */}
              {memory.processed && (
                <div className="mt-4 pt-4">
                  <ConnectionsList
                    itemType="thought"
                    itemId={memory.id}
                    content={memoryContent}
                    onConnectionCreated={loadMemoryBridges}
                    onConnectionDeleted={loadMemoryBridges}
                  />
                </div>
              )}

              {/* Timestamp at bottom */}
              <div className="flex items-center gap-2 text-xs pt-3 mt-3 border-t" style={{
                color: 'var(--premium-text-tertiary)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}>
                <Calendar className="h-3 w-3" />
                <span>{formatDate(memory.created_at)}</span>
              </div>

              {/* Processing Status */}
              {!memory.processed && (
                <div
                  className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 animate-pulse"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--premium-amber)'
                  }}
                >
                  <div
                    className="h-4 w-4 animate-spin rounded-full"
                    style={{
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderTopColor: 'var(--premium-amber)',
                      borderRightColor: 'transparent',
                      borderBottomColor: 'var(--premium-amber)',
                      borderLeftColor: 'var(--premium-amber)'
                    }}
                  ></div>
                  <span className="font-medium">AI analyzing...</span>
                </div>
              )}

              {/* Error Status */}
              {memory.error && (
                <div
                  className="text-sm rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444'
                  }}
                >
                  <strong>Error:</strong> {memory.error}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  )
})
