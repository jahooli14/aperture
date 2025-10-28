/**
 * ProjectCard Component - Stunning Visual Design
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Clock, Zap, Edit, Trash2 } from 'lucide-react'
import type { ProjectCardProps } from '../../types'

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  onClick,
  showActions = true,
  compact = false
}: ProjectCardProps) {
  const relativeTime = formatRelativeTime(project.last_active)

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onClick?.(project.id)
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    upcoming: {
      label: 'Upcoming',
      color: 'text-amber-700 bg-amber-100 border-amber-200',
      bg: 'bg-amber-50'
    },
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


  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
    <Card
      className="group h-full flex flex-col relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/80 border-2 shadow-xl transition-all duration-300 hover:border-blue-300 hover:shadow-2xl cursor-pointer"
      style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}
      onClick={handleCardClick}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }} />
      {/* Accent gradient bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2" style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />

      <CardHeader className="relative z-10 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <CardTitle className="text-2xl font-bold text-neutral-900 flex-1">
            {project.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showActions && onEdit && (
              <Button
                onClick={() => onEdit(project.id)}
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 text-gray-400 hover:text-blue-900 hover:bg-blue-50 touch-manipulation"
                aria-label="Edit project"
              >
                <Edit className="h-5 w-5" />
              </Button>
            )}
            {showActions && onDelete && (
              <Button
                onClick={() => onDelete(project.id)}
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 touch-manipulation"
                aria-label="Delete project"
              >
                <Trash2 className="h-5 w-5" />
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

      <CardContent className="relative z-10 flex-1 space-y-4">
        {/* Next Step - Prominent Display */}
        {project.metadata?.next_step && (
          <div className="bg-gradient-to-r from-blue-50 to-amber-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-2">
              Next Step
            </div>
            <p className="text-sm font-medium text-neutral-900 leading-relaxed">
              {project.metadata.next_step}
            </p>
          </div>
        )}

        {/* Progress Bar - Optional */}
        {typeof project.metadata?.progress === 'number' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600 uppercase tracking-wide">Progress</span>
              <span className="font-bold text-blue-900">{project.metadata.progress}%</span>
            </div>
            <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-900 transition-all duration-500"
                style={{ width: `${project.metadata.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Clock className="h-4 w-4 text-blue-900" />
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
    </motion.div>
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
