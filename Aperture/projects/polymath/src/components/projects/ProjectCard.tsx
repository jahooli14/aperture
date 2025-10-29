/**
 * ProjectCard Component - Stunning Visual Design
 */

import React, { memo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Clock, Zap, Edit, Trash2, Link2 } from 'lucide-react'
import type { ProjectCardProps } from '../../types'

export const ProjectCard = memo(function ProjectCard({
  project,
  onEdit,
  onDelete,
  onClick,
  showActions = true,
  compact = false
}: ProjectCardProps) {
  const relativeTime = formatRelativeTime(project.last_active)
  const [connectionCount, setConnectionCount] = useState(0)

  useEffect(() => {
    fetchConnectionCount()
  }, [project.id])

  const fetchConnectionCount = async () => {
    try {
      const response = await fetch(`/api/related?source_type=project&source_id=${project.id}&connections=true`)
      if (response.ok) {
        const data = await response.json()
        setConnectionCount(data.connections?.length || 0)
      }
    } catch (error) {
      console.warn('[ProjectCard] Failed to fetch connections:', error)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onClick?.(project.id)
  }

  const statusConfig: Record<string, { label: string; style: React.CSSProperties; bgStyle: React.CSSProperties }> = {
    upcoming: {
      label: 'Upcoming',
      style: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        color: '#fbbf24',
        borderColor: 'rgba(251, 191, 36, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderColor: 'rgba(251, 191, 36, 0.2)'
      }
    },
    active: {
      label: 'Active',
      style: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        color: 'var(--premium-emerald)',
        borderColor: 'rgba(16, 185, 129, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.2)'
      }
    },
    dormant: {
      label: 'Dormant',
      style: {
        backgroundColor: 'rgba(156, 163, 175, 0.2)',
        color: '#9ca3af',
        borderColor: 'rgba(156, 163, 175, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 0.2)'
      }
    },
    completed: {
      label: 'Completed',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--premium-blue)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 0.2)'
      }
    },
    archived: {
      label: 'Archived',
      style: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        color: 'var(--premium-indigo)',
        borderColor: 'rgba(139, 92, 246, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderColor: 'rgba(139, 92, 246, 0.2)'
      }
    }
  }


  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
    <Card
      className="group h-full flex flex-col premium-card cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }} />
      {/* Accent gradient bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2" style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />

      <CardHeader className="relative z-10 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <CardTitle className="text-2xl font-bold flex-1" style={{ color: 'var(--premium-text-primary)' }}>
            {project.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showActions && onEdit && (
              <Button
                onClick={() => onEdit(project.id)}
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 touch-manipulation"
                style={{ color: 'var(--premium-text-tertiary)' }}
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
                className="h-11 w-11 p-0 touch-manipulation"
                style={{ color: 'var(--premium-text-tertiary)' }}
                aria-label="Delete project"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
        {project.description && (
          <CardDescription className="line-clamp-3 text-base leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
            {project.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="relative z-10 flex-1 space-y-4">
        {/* Next Step - Prominent Display */}
        {project.metadata?.next_step && (
          <div
            className="border-2 rounded-xl p-4"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              borderColor: 'rgba(59, 130, 246, 0.3)'
            }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--premium-amber)' }}
            >
              Next Step
            </div>
            <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--premium-text-primary)' }}>
              {project.metadata.next_step}
            </p>
          </div>
        )}

        {/* Progress Bar - Optional */}
        {typeof project.metadata?.progress === 'number' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--premium-text-secondary)' }}>Progress</span>
              <span className="font-bold" style={{ color: 'var(--premium-blue)' }}>{project.metadata.progress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${project.metadata.progress}%`,
                  background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-indigo))'
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
          <Clock className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />
          <span title={new Date(project.last_active).toLocaleString()}>Last active <span className="font-semibold" style={{ color: 'var(--premium-text-primary)' }}>{relativeTime}</span></span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="px-4 py-2 rounded-xl border flex-1"
            style={statusConfig[project.status].bgStyle}
          >
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1 rounded-md text-xs font-medium border"
                style={statusConfig[project.status].style}
              >
                {statusConfig[project.status].label}
              </div>
            </div>
          </div>

          {/* Connection Badge */}
          {connectionCount > 0 && (
            <div className="px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2 border" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--premium-blue)',
              borderColor: 'rgba(59, 130, 246, 0.3)'
            }}>
              <Link2 className="h-3.5 w-3.5" />
              <span className="font-bold">{connectionCount}</span>
            </div>
          )}
        </div>

        {project.metadata?.tags && project.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.metadata.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-md text-xs font-medium border"
                style={{
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  color: 'var(--premium-indigo)',
                  borderColor: 'rgba(139, 92, 246, 0.3)'
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {project.metadata?.energy_level && (
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: 'var(--premium-amber)' }} />
            <span className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>Energy:</span>
            <span
              className="px-3 py-1 rounded-md text-xs font-medium border"
              style={
                project.metadata.energy_level === 'high'
                  ? {
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      borderColor: 'rgba(239, 68, 68, 0.3)'
                    }
                  : project.metadata.energy_level === 'low'
                    ? {
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--premium-emerald)',
                        borderColor: 'rgba(16, 185, 129, 0.3)'
                      }
                    : {
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: 'var(--premium-amber)',
                        borderColor: 'rgba(245, 158, 11, 0.3)'
                      }
              }
            >
              {project.metadata.energy_level}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
    </motion.div>
  )
})

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
