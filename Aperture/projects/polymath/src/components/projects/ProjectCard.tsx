/**
 * ProjectCard Component - Stunning Visual Design
 */

import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Clock, Zap } from 'lucide-react'
import type { ProjectCardProps } from '../../types'

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  showActions = true,
  compact = false
}: ProjectCardProps) {
  const relativeTime = formatRelativeTime(project.last_active)

  const statusConfig: Record<string, { emoji: string; gradient: string; bg: string }> = {
    active: {
      emoji: '🚀',
      gradient: 'from-green-500 to-emerald-600',
      bg: 'bg-gradient-to-br from-green-50 to-emerald-50'
    },
    dormant: {
      emoji: '💤',
      gradient: 'from-gray-400 to-gray-600',
      bg: 'bg-gradient-to-br from-gray-50 to-slate-50'
    },
    completed: {
      emoji: '✅',
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'bg-gradient-to-br from-blue-50 to-indigo-50'
    },
    archived: {
      emoji: '📦',
      gradient: 'from-purple-500 to-violet-600',
      bg: 'bg-gradient-to-br from-purple-50 to-violet-50'
    }
  }

  const typeConfig: Record<string, { emoji: string; gradient: string }> = {
    personal: { emoji: '👤', gradient: 'from-pink-500 via-rose-500 to-purple-600' },
    technical: { emoji: '⚙️', gradient: 'from-blue-500 via-cyan-500 to-teal-600' },
    meta: { emoji: '🧠', gradient: 'from-amber-500 via-orange-500 to-red-600' }
  }

  return (
    <Card className="group h-full flex flex-col relative overflow-hidden backdrop-blur-xl bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 glow-hover">
      {/* Gradient overlay on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${typeConfig[project.type].gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${typeConfig[project.type].gradient}`} />

      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-xl font-bold group-hover:gradient-text transition-all duration-300">
            {project.title}
          </CardTitle>
          <div className={`relative px-3 py-1 rounded-full bg-gradient-to-r ${typeConfig[project.type].gradient} text-white text-xs font-bold shadow-lg`}>
            {typeConfig[project.type].emoji} {project.type}
          </div>
        </div>
        {project.description && (
          <CardDescription className="line-clamp-2 text-base">
            {project.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="h-4 w-4 text-purple-600" />
          <span>Last active <span className="font-semibold text-purple-600">{relativeTime}</span></span>
        </div>

        <div className={`px-4 py-2 rounded-xl ${statusConfig[project.status].bg} border border-white/40 shadow-inner`}>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${statusConfig[project.status].gradient} text-white text-xs font-bold shadow-md`}>
              {statusConfig[project.status].emoji} {project.status}
            </div>
          </div>
        </div>

        {project.metadata?.tags && project.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.metadata.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-xs font-semibold border border-purple-200/50 shadow-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {project.metadata?.energy_level && (
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-gray-600">Energy:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-md ${
              project.metadata.energy_level === 'high'
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
                : project.metadata.energy_level === 'low'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                  : 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white'
            }`}>
              {project.metadata.energy_level}
            </span>
          </div>
        )}
      </CardContent>

      {showActions && (onEdit || onDelete) && (
        <CardFooter className="flex gap-2 border-t border-white/20 pt-4 bg-gradient-to-b from-transparent to-gray-50/50">
          {onEdit && (
            <Button
              onClick={() => onEdit(project.id)}
              variant="outline"
              size="sm"
              className="flex-1 hover:scale-105 transition-transform duration-200"
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              onClick={() => onDelete(project.id)}
              variant="destructive"
              size="sm"
              className="flex-1 hover:scale-105 transition-transform duration-200"
            >
              Delete
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}w ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}mo ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years}y ago`
  }
}
