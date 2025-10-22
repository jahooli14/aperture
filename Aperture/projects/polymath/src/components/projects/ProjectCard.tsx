/**
 * ProjectCard Component - Stunning Visual Design
 */

import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Clock, Zap, Edit, Trash2 } from 'lucide-react'
import type { ProjectCardProps } from '../../types'

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  showActions = true,
  compact = false
}: ProjectCardProps) {
  const relativeTime = formatRelativeTime(project.last_active)

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    active: {
      label: 'Active',
      color: 'text-green-700 bg-green-100 border-green-200',
      bg: 'bg-green-50'
    },
    dormant: {
      label: 'Dormant',
      color: 'text-gray-700 bg-gray-100 border-gray-200',
      bg: 'bg-gray-50'
    },
    completed: {
      label: 'Completed',
      color: 'text-blue-700 bg-blue-100 border-blue-200',
      bg: 'bg-blue-50'
    },
    archived: {
      label: 'Archived',
      color: 'text-purple-700 bg-purple-100 border-purple-200',
      bg: 'bg-purple-50'
    }
  }

  const typeConfig: Record<string, { label: string; color: string }> = {
    personal: { label: 'Personal', color: 'text-pink-700 bg-pink-100 border-pink-300' },
    technical: { label: 'Technical', color: 'text-cyan-700 bg-cyan-100 border-cyan-300' },
    meta: { label: 'Meta', color: 'text-orange-700 bg-orange-100 border-orange-300' },
    creative: { label: 'Creative', color: 'text-purple-700 bg-purple-100 border-purple-300' },
    learning: { label: 'Learning', color: 'text-blue-700 bg-blue-100 border-blue-300' }
  }

  return (
    <Card className="group h-full flex flex-col pro-card transition-smooth hover-lift border-2">
      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <CardTitle className="text-2xl font-bold text-neutral-900 flex-1">
            {project.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 ${typeConfig[project.type]?.color || typeConfig.personal.color}`}>
              {typeConfig[project.type]?.label || project.type}
            </div>
            {showActions && onEdit && (
              <Button
                onClick={() => onEdit(project.id)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-orange-600 hover:bg-orange-50"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {showActions && onDelete && (
              <Button
                onClick={() => onDelete(project.id)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {project.description && (
          <CardDescription className="line-clamp-3 text-base text-neutral-600 leading-relaxed">
            {project.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Clock className="h-4 w-4 text-orange-600" />
          <span title={new Date(project.last_active).toLocaleString()}>Last active <span className="font-semibold text-neutral-900">{relativeTime}</span></span>
        </div>

        <div className={`px-4 py-2 rounded-xl ${statusConfig[project.status].bg} border border-neutral-200`}>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-md text-xs font-medium border ${statusConfig[project.status].color}`}>
              {statusConfig[project.status].label}
            </div>
          </div>
        </div>

        {project.metadata?.tags && project.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.metadata.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {project.metadata?.energy_level && (
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-neutral-600">Energy:</span>
            <span className={`px-3 py-1 rounded-md text-xs font-medium border ${
              project.metadata.energy_level === 'high'
                ? 'bg-red-100 text-red-700 border-red-200'
                : project.metadata.energy_level === 'low'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
            }`}>
              {project.metadata.energy_level}
            </span>
          </div>
        )}
      </CardContent>
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
