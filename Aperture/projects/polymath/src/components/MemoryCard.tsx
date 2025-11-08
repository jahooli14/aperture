/**
 * MemoryCard Component - Stunning Visual Design
 */

import { useState, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Brain, Calendar, User, Tag, Edit, Trash2, ChevronDown, ChevronUp, Copy, Share2, Pin } from 'lucide-react'
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
  const fetchBridgesForMemory = useMemoryStore((state) => state.fetchBridgesForMemory)
  const { addToast } = useToast()

  // Removed swipe gesture - deletion now requires confirmation only

  // Long-press for context menu
  const longPressHandlers = useLongPress(() => {
    setShowContextMenu(true)
  }, {
    threshold: 500,
  })

  // Function to load memory bridges
  const loadMemoryBridges = () => {
    if (memory.id.startsWith('temp_')) {
      setBridges([])
      return
    }
    fetchBridgesForMemory(memory.id).then(setBridges)
  }

  useEffect(() => {
    loadMemoryBridges()
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
        color: 'var(--premium-blue)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      }
    },
    event: {
      label: 'Event',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: 'var(--premium-blue)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      }
    },
    insight: {
      label: 'Insight',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: 'var(--premium-blue)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      }
    },
  }

  const isManual = memory.audiopen_id?.startsWith('manual_')

  // Swipe gesture removed - users must use explicit buttons

  const handleCopyText = () => {
    const textToCopy = `${memory.title}\n\n${memory.body}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      haptic.success()
    })
  }

  const handleShare = async () => {
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
  }

  const contextMenuItems: ContextMenuItem[] = [
    ...(onEdit ? [{
      label: 'Edit',
      icon: <Edit className="h-5 w-5" />,
      onClick: () => onEdit(memory),
    }] : []),
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
    ...(onDelete ? [{
      label: 'Delete',
      icon: <Trash2 className="h-5 w-5" />,
      onClick: () => onDelete(memory),
      variant: 'destructive' as const,
    }] : []),
  ]

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
        <Card className="group h-full flex flex-col premium-card relative overflow-hidden" style={{
          boxShadow: !memory.processed
            ? '0 8px 32px rgba(245, 158, 11, 0.2)'
            : '0 8px 32px rgba(99, 102, 241, 0.2)'
        }}>
      {/* Ambient glow effect - stronger on hover */}
      <div
        className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500"
        style={{
          background: !memory.processed
            ? 'radial-gradient(circle at 30% 30%, rgba(245, 158, 11, 0.3), transparent 60%)'
            : 'radial-gradient(circle at 30% 30%, rgba(99, 102, 241, 0.3), transparent 60%)',
          pointerEvents: 'none'
        }}
      />

      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg font-semibold leading-tight flex-1" style={{ color: 'var(--premium-text-primary)' }}>
            {memory.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isManual && (
              <div className="px-2 py-1 rounded-md text-xs font-medium border" style={{
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--premium-blue)',
                borderColor: 'rgba(59, 130, 246, 0.3)'
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
                          className="px-2 py-1 rounded-md text-xs font-medium border"
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--premium-blue)',
                            borderColor: 'rgba(59, 130, 246, 0.3)'
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
            {onEdit && (
              <Button
                onClick={() => onEdit(memory)}
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 touch-manipulation hover:bg-white/10 transition-colors"
                aria-label="Edit memory"
              >
                <Edit className="h-5 w-5 hover:opacity-80" style={{ color: 'var(--premium-blue)' }} />
              </Button>
            )}
            {onDelete && (
              <Button
                onClick={() => onDelete(memory)}
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 touch-manipulation hover:bg-white/10 transition-colors"
                aria-label="Delete memory"
              >
                <Trash2 className="h-5 w-5 hover:opacity-80" style={{ color: '#ef4444' }} />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
          <Calendar className="h-3 w-3" />
          <span>{formatDate(memory.created_at)}</span>
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


        {/* AI Enrichment - Always show when processed */}
        {memory.processed && (
          <>
            {/* Memory Type & Emotional Tone */}
            {(memory.memory_type || memory.emotional_tone) && (
              <div className="flex flex-wrap gap-2">
                {memory.memory_type && (
                  <div className="px-3 py-1 rounded-md text-xs font-medium border" style={memoryTypeConfig[memory.memory_type].style}>
                    {memoryTypeConfig[memory.memory_type].label}
                  </div>
                )}
                {memory.emotional_tone && (
                  <div className="px-3 py-1 rounded-md text-xs font-medium border" style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--premium-blue)',
                    borderColor: 'rgba(59, 130, 246, 0.3)'
                  }}>
                    {memory.emotional_tone}
                  </div>
                )}
              </div>
            )}

            {/* Tags - Hidden (duplicative of topics, kept for backend processing) */}
            {false && memory.tags && memory.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {memory.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-md text-xs font-medium border flex items-center gap-1"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--premium-blue)',
                      borderColor: 'rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Entities */}
            {memory.entities && (
              <div className="space-y-2">
                {memory.entities.people && memory.entities.people.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <User className="h-3 w-3" style={{ color: 'var(--premium-blue)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>People:</span>
                    {memory.entities.people.slice(0, 3).map((person) => (
                      <span
                        key={person}
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: 'var(--premium-blue)'
                        }}
                      >
                        {person}
                      </span>
                    ))}
                    {memory.entities.people.length > 3 && (
                      <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                        +{memory.entities.people.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                {memory.entities.topics && memory.entities.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <Brain className="h-3 w-3" style={{ color: 'var(--premium-blue)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>Topics:</span>
                    {memory.entities.topics.slice(0, 3).map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: 'var(--premium-blue)'
                        }}
                      >
                        {topic}
                      </span>
                    ))}
                    {memory.entities.topics.length > 3 && (
                      <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                        +{memory.entities.topics.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Bi-Directional Memory Links */}
        <MemoryLinks
          currentMemoryId={memory.id}
          bridges={bridges}
        />

        {/* AI Connection Discovery - Always show for processed thoughts */}
        {memory.processed && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <ConnectionsList
              itemType="thought"
              itemId={memory.id}
              content={`${memory.title}\n\n${memory.body}`}
              onConnectionCreated={loadMemoryBridges}
              onConnectionDeleted={loadMemoryBridges}
            />
          </div>
        )}

        {/* Processing Status */}
        {!memory.processed && (
          <div
            className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 border animate-pulse"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--premium-amber)',
              borderColor: 'rgba(245, 158, 11, 0.4)'
            }}
          >
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-r-transparent"
              style={{ borderColor: 'var(--premium-amber)' }}
            ></div>
            <span className="font-medium">AI analyzing...</span>
          </div>
        )}

        {/* Error Status */}
        {memory.error && (
          <div
            className="text-sm rounded-lg px-3 py-2 border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              borderColor: 'rgba(239, 68, 68, 0.3)'
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
