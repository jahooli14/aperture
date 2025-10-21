/**
 * ProjectCard Component
 */

import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import type { ProjectCardProps } from '../../types'

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  showActions = true,
  compact = false
}: ProjectCardProps) {
  const relativeTime = formatRelativeTime(project.last_active)

  const statusConfig: Record<string, { emoji: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    active: { emoji: '🚀', variant: 'default' },
    dormant: { emoji: '💤', variant: 'secondary' },
    completed: { emoji: '✅', variant: 'outline' },
    archived: { emoji: '📦', variant: 'secondary' }
  }

  const typeConfig: Record<string, { emoji: string; variant: 'creative' | 'technical' | 'meta' }> = {
    personal: { emoji: '👤', variant: 'creative' },
    technical: { emoji: '⚙️', variant: 'technical' },
    meta: { emoji: '🧠', variant: 'meta' }
  }

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl">{project.title}</CardTitle>
          <Badge variant={typeConfig[project.type].variant}>
            {typeConfig[project.type].emoji} {project.type}
          </Badge>
        </div>
        {project.description && (
          <CardDescription className="line-clamp-2">{project.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span>Last active: <span className="font-medium text-foreground">{relativeTime}</span></span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={statusConfig[project.status].variant}>
            {statusConfig[project.status].emoji} {project.status}
          </Badge>
        </div>

        {project.metadata?.tags && project.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {project.metadata.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {project.metadata?.energy_level && (
          <div className="mt-3 text-sm">
            <span className="text-muted-foreground">Energy: </span>
            <Badge
              variant={
                project.metadata.energy_level === 'high'
                  ? 'destructive'
                  : project.metadata.energy_level === 'low'
                    ? 'secondary'
                    : 'outline'
              }
              className="text-xs"
            >
              {project.metadata.energy_level}
            </Badge>
          </div>
        )}
      </CardContent>

      {showActions && (onEdit || onDelete) && (
        <CardFooter className="flex gap-2 border-t pt-4">
          {onEdit && (
            <Button
              onClick={() => onEdit(project.id)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              onClick={() => onDelete(project.id)}
              variant="destructive"
              size="sm"
              className="flex-1"
            >
              Delete
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
