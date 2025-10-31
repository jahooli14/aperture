/**
 * MemoryCard Component - Stunning Visual Design
 */

import { useState, useEffect, memo } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Brain, Calendar, User, Tag, Edit, Trash2, ChevronDown, ChevronUp, Copy, Share2, Pin } from 'lucide-react'
import { Button } from './ui/button'
import type { Memory, BridgeWithMemories } from '../types'
import { useMemoryStore } from '../stores/useMemoryStore'
import { haptic } from '../utils/haptics'
import { useLongPress } from '../hooks/useLongPress'
import { ContextMenu, type ContextMenuItem } from './ui/context-menu'
import { MemoryLinks } from './MemoryLinks'
import { PinButton } from './PinButton'

interface MemoryCardProps {
  memory: Memory
  onEdit?: (memory: Memory) => void
  onDelete?: (memory: Memory) => void
}

export const MemoryCard = memo(function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const [bridges, setBridges] = useState<BridgeWithMemories[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [exitX, setExitX] = useState(0)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const fetchBridgesForMemory = useMemoryStore((state) => state.fetchBridgesForMemory)

  // Removed swipe gesture - deletion now requires confirmation only

  // Long-press for context menu
  const longPressHandlers = useLongPress(() => {
    setShowContextMenu(true)
  }, {
    threshold: 500,
  })

  useEffect(() => {
    fetchBridgesForMemory(memory.id).then(setBridges)
  }, [memory.id])

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
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        color: 'var(--premium-emerald)',
        borderColor: 'rgba(16, 185, 129, 0.3)'
      }
    },
    insight: {
      label: 'Insight',
      style: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: 'var(--premium-amber)',
        borderColor: 'rgba(245, 158, 11, 0.3)'
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
        <div>
        <Card className="group h-full flex flex-col premium-card">
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }} />
      {/* Accent gradient bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2" style={{ background: 'linear-gradient(90deg, var(--premium-indigo), #818cf8)' }} />

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
        {/* Body Text */}
        <div>
          <CardDescription className={`text-sm leading-relaxed ${!isExpanded ? 'line-clamp-4' : ''}`}>
            {memory.body}
          </CardDescription>

          {/* Show More/Less Button - only if text is long enough */}
          {memory.body && memory.body.length > 200 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-sm font-medium transition-colors flex items-center gap-1 touch-manipulation hover:opacity-80"
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
          )}
        </div>

        {/* Memory Type & Emotional Tone */}
        {memory.processed && (
          <div className="flex flex-wrap gap-2">
            {memory.memory_type && (
              <div className="px-3 py-1 rounded-md text-xs font-medium border" style={memoryTypeConfig[memory.memory_type].style}>
                {memoryTypeConfig[memory.memory_type].label}
              </div>
            )}
            {memory.emotional_tone && (
              <div className="px-3 py-1 rounded-md text-xs font-medium border" style={{
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                color: '#ec4899',
                borderColor: 'rgba(236, 72, 153, 0.3)'
              }}>
                {memory.emotional_tone}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
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
                <Brain className="h-3 w-3" style={{ color: 'var(--premium-indigo)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>Topics:</span>
                {memory.entities.topics.slice(0, 3).map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                      color: 'var(--premium-indigo)'
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

        {/* Bi-Directional Memory Links */}
        <MemoryLinks
          currentMemoryId={memory.id}
          bridges={bridges}
        />

        {/* Processing Status */}
        {!memory.processed && (
          <div
            className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 border"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--premium-blue)',
              borderColor: 'rgba(59, 130, 246, 0.3)'
            }}
          >
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-r-transparent"
              style={{ borderColor: 'var(--premium-blue)' }}
            ></div>
            <span className="font-medium">Processing...</span>
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
        </div>
      </div>
    </>
  )
})
