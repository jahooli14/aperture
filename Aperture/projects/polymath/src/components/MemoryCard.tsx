/**
 * MemoryCard Component - Stunning Visual Design
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Brain, Calendar, Link2, Sparkles, User, Tag, Edit, Trash2 } from 'lucide-react'
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
    <Card className="group h-full flex flex-col pro-card transition-smooth hover-lift">
      {/* Subtle accent bar */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-40" />

      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg font-semibold text-neutral-900 leading-tight flex-1">
            {memory.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isManual && (
              <div className="px-2 py-1 rounded-md bg-orange-100 text-orange-700 text-xs font-medium border border-orange-200">
                Manual
              </div>
            )}
            {onEdit && (
              <Button
                onClick={() => onEdit(memory)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-orange-600 hover:bg-orange-50"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                onClick={() => onDelete(memory)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(memory.created_at)}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Body Text */}
        <CardDescription className="line-clamp-4 text-sm leading-relaxed">
          {memory.body}
        </CardDescription>

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
                className="px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium border border-orange-200 flex items-center gap-1"
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
                <span className="text-xs font-semibold text-gray-600">People:</span>
                {memory.entities.people.slice(0, 3).map((person) => (
                  <span
                    key={person}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {person}
                  </span>
                ))}
                {memory.entities.people.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{memory.entities.people.length - 3} more
                  </span>
                )}
              </div>
            )}
            {memory.entities.topics && memory.entities.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <Brain className="h-3 w-3 text-purple-600" />
                <span className="text-xs font-semibold text-gray-600">Topics:</span>
                {memory.entities.topics.slice(0, 3).map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                  >
                    {topic}
                  </span>
                ))}
                {memory.entities.topics.length > 3 && (
                  <span className="text-xs text-gray-500">
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
              <span className="text-sm font-semibold text-gray-700">
                {bridges.length} Connection{bridges.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1">
              {bridges.slice(0, 3).map((bridge) => (
                <div
                  key={bridge.id}
                  className="flex items-center justify-between text-xs bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg px-3 py-2 border border-cyan-100"
                >
                  <span className="text-gray-600 capitalize">
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
          <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-orange-600 border-r-transparent"></div>
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
