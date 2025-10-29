/**
 * MemoryCard Component - Stunning Visual Design
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Brain, Calendar, Link2, Sparkles, User, Tag, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './ui/button'
import type { Memory, Bridge } from '../types'
import { useMemoryStore } from '../stores/useMemoryStore'

interface MemoryCardProps {
  memory: Memory
  onEdit?: (memory: Memory) => void
  onDelete?: (memory: Memory) => void
}

export function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const [bridges, setBridges] = useState<Bridge[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const fetchBridgesForMemory = useMemoryStore((state) => state.fetchBridgesForMemory)

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
    { label: string; color: string; bg: string }
  > = {
    foundational: {
      label: 'Foundational',
      color: 'text-blue-700 bg-blue-100 border-blue-200',
      bg: 'bg-blue-50',
    },
    event: {
      label: 'Event',
      color: 'text-green-700 bg-green-100 border-green-200',
      bg: 'bg-green-50',
    },
    insight: {
      label: 'Insight',
      color: 'text-amber-700 bg-amber-100 border-amber-200',
      bg: 'bg-amber-50',
    },
  }

  const isManual = memory.audiopen_id?.startsWith('manual_')

  return (
    <Card className="group h-full flex flex-col relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/80 border-2 shadow-xl transition-all duration-300 hover:border-indigo-300 hover:shadow-2xl" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }} />
      {/* Accent gradient bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2" style={{ background: 'linear-gradient(90deg, #6366f1, #818cf8)' }} />

      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg font-semibold leading-tight flex-1" style={{ color: 'var(--premium-text-primary)' }}>
            {memory.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isManual && (
              <div className="px-2 py-1 rounded-md bg-blue-100 text-blue-950 text-xs font-medium border border-blue-200">
                Manual
              </div>
            )}
            {onEdit && (
              <Button
                onClick={() => onEdit(memory)}
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 text-gray-400 hover:text-blue-900 hover:bg-blue-50 touch-manipulation"
                aria-label="Edit memory"
              >
                <Edit className="h-5 w-5" />
              </Button>
            )}
            {onDelete && (
              <Button
                onClick={() => onDelete(memory)}
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 touch-manipulation"
                aria-label="Delete memory"
              >
                <Trash2 className="h-5 w-5" />
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
              className="mt-2 text-sm font-medium text-blue-900 hover:text-blue-950 transition-colors flex items-center gap-1 touch-manipulation"
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
              <div className={`px-3 py-1 rounded-md text-xs font-medium border ${memoryTypeConfig[memory.memory_type].color}`}>
                {memoryTypeConfig[memory.memory_type].label}
              </div>
            )}
            {memory.emotional_tone && (
              <div className="px-3 py-1 rounded-md bg-rose-100 text-rose-700 text-xs font-medium border border-rose-200">
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
                className="px-2 py-1 bg-blue-50 text-blue-950 rounded-md text-xs font-medium border border-blue-200 flex items-center gap-1"
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
                <User className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>People:</span>
                {memory.entities.people.slice(0, 3).map((person) => (
                  <span
                    key={person}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
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
                <Brain className="h-3 w-3 text-purple-600" />
                <span className="text-xs font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>Topics:</span>
                {memory.entities.topics.slice(0, 3).map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
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
              <Link2 className="h-4 w-4 text-cyan-600" />
              <span className="text-sm font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>
                {bridges.length} Connection{bridges.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1">
              {bridges.slice(0, 3).map((bridge) => (
                <div
                  key={bridge.id}
                  className="flex items-center justify-between text-xs bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg px-3 py-2 border border-cyan-100"
                >
                  <span className="capitalize" style={{ color: 'var(--premium-text-secondary)' }}>
                    {bridge.bridge_type.replace(/_/g, ' ')}
                  </span>
                  <div className="px-2 py-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full font-bold">
                    {Math.round(bridge.strength * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing Status */}
        {!memory.processed && (
          <div className="flex items-center gap-2 text-sm text-blue-900 bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-900 border-r-transparent"></div>
            <span className="font-medium">Processing...</span>
          </div>
        )}

        {/* Error Status */}
        {memory.error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
            <strong>Error:</strong> {memory.error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
