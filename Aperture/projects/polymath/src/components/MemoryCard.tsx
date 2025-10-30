/**
 * MemoryCard Component - Stunning Visual Design
 */

import { useState, useEffect, memo } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Brain, Calendar, Link2, User, Tag, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './ui/button'
import type { Memory, Bridge } from '../types'
import { useMemoryStore } from '../stores/useMemoryStore'
import { haptic } from '../utils/haptics'

interface MemoryCardProps {
  memory: Memory
  onEdit?: (memory: Memory) => void
  onDelete?: (memory: Memory) => void
}

export const MemoryCard = memo(function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const [bridges, setBridges] = useState<Bridge[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [exitX, setExitX] = useState(0)
  const fetchBridgesForMemory = useMemoryStore((state) => state.fetchBridgesForMemory)

  // Motion values for swipe gesture
  const x = useMotionValue(0)
  const deleteIndicatorOpacity = useTransform(x, [-100, 0], [1, 0])
  const editIndicatorOpacity = useTransform(x, [0, 100], [0, 1])
  const backgroundColor = useTransform(
    x,
    [-150, 0, 150],
    ['rgba(239, 68, 68, 0.3)', 'rgba(20, 27, 38, 0.4)', 'rgba(59, 130, 246, 0.3)']
  )

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

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x
    const velocity = info.velocity.x

    // Swipe left = Delete (threshold: -100px or fast velocity)
    if ((offset < -100 || velocity < -500) && onDelete) {
      haptic.warning()
      setExitX(-1000)
      setTimeout(() => onDelete(memory), 200)
    }
    // Swipe right = Edit (threshold: 100px or fast velocity)
    else if ((offset > 100 || velocity > 500) && onEdit) {
      haptic.light()
      onEdit(memory)
      // Reset position
      x.set(0)
    }
  }

  return (
    <motion.div
      style={{ x }}
      drag={(onDelete || onEdit) ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      animate={exitX !== 0 ? { x: exitX, opacity: 0 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative"
    >
      {/* Edit Indicator (Swipe Right) */}
      {onEdit && (
        <motion.div
          style={{ opacity: editIndicatorOpacity }}
          className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none z-10"
        >
          <div className="flex items-center gap-2">
            <Edit className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
            <span className="text-xl font-bold" style={{ color: 'var(--premium-blue)' }}>EDIT</span>
          </div>
        </motion.div>
      )}

      {/* Delete Indicator (Swipe Left) */}
      {onDelete && (
        <motion.div
          style={{ opacity: deleteIndicatorOpacity }}
          className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none z-10"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-red-400" />
            <span className="text-xl font-bold text-red-400">DELETE</span>
          </div>
        </motion.div>
      )}

      <motion.div style={{ backgroundColor }}>
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

        {/* Bridges/Connections */}
        {bridges.length > 0 && (
          <div className="pt-3 border-t border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>
                {bridges.length} Connection{bridges.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1">
              {bridges.slice(0, 3).map((bridge) => (
                <div
                  key={bridge.id}
                  className="flex items-center justify-between text-xs rounded-lg px-3 py-2 border"
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    borderColor: 'rgba(6, 182, 212, 0.3)'
                  }}
                >
                  <span className="capitalize" style={{ color: 'var(--premium-text-primary)' }}>
                    {bridge.bridge_type.replace(/_/g, ' ')}
                  </span>
                  <div
                    className="px-2 py-0.5 rounded-full font-bold text-xs"
                    style={{
                      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.8), rgba(59, 130, 246, 0.8))',
                      color: '#ffffff'
                    }}
                  >
                    {Math.round(bridge.strength * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
      </motion.div>
    </motion.div>
  )
})
