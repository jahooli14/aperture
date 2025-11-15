/**
 * ProjectCard Component
 * Copy to: projects/memory-os/src/components/projects/ProjectCard.tsx
 */

import React from 'react'
import type { ProjectCardProps } from '../../types'

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  showActions = true,
  compact = false
}: ProjectCardProps) {
  const relativeTime = formatRelativeTime(project.last_active)

  const statusColors: Record<string, string> = {
    active: 'green',
    dormant: 'gray',
    completed: 'blue',
    archived: 'purple'
  }

  const typeLabels: Record<string, string> = {
    personal: 'Personal',
    technical: 'Technical',
    meta: 'Meta'
  }

  return (
    <div className={`project-card ${compact ? 'compact' : ''}`}>
      <div className="card-header">
        <h3 className="card-title">{project.title}</h3>
        <span className={`type-badge type-${project.type}`}>
          {typeLabels[project.type]}
        </span>
      </div>

      {project.description && (
        <p className="card-description">{project.description}</p>
      )}

      <div className="card-metadata">
        <span className="metadata-item">
          <span className="metadata-label">Last active:</span>
          <span className="metadata-value">{relativeTime}</span>
        </span>

        <span className={`status-badge status-${statusColors[project.status]}`}>
          {project.status}
        </span>
      </div>

      {project.metadata?.tags && project.metadata.tags.length > 0 && (
        <div className="tags-section">
          {project.metadata.tags.map((tag) => (
            <span key={tag} className="tag-badge">{tag}</span>
          ))}
        </div>
      )}

      {project.metadata?.energy_level && (
        <div className="energy-section">
          <span className="energy-label">Energy:</span>
          <span className={`energy-badge energy-${project.metadata.energy_level}`}>
            {project.metadata.energy_level}
          </span>
        </div>
      )}

      {showActions && (onEdit || onDelete) && (
        <div className="card-actions">
          {onEdit && (
            <button
              onClick={() => onEdit(project.id)}
              className="action-button action-edit"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(project.id)}
              className="action-button action-delete"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
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

// ============================================================================
// STYLES
// ============================================================================

/*
.project-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
  transition: box-shadow 0.2s;
}

.project-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-sm);
}

.card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.type-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.type-badge.type-personal {
  background: #fef3c7;
  color: #92400e;
}

.type-badge.type-technical {
  background: #dbeafe;
  color: #1e40af;
}

.type-badge.type-meta {
  background: #f3e8ff;
  color: #6b21a8;
}

.card-description {
  margin: var(--spacing-sm) 0;
  color: var(--color-text);
  line-height: 1.6;
}

.card-metadata {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: var(--spacing-md) 0;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.metadata-item {
  display: flex;
  gap: var(--spacing-xs);
}

.metadata-label {
  color: var(--color-text-muted);
}

.metadata-value {
  color: var(--color-text);
  font-weight: 500;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status-badge.status-green {
  background: #dcfce7;
  color: #166534;
}

.status-badge.status-gray {
  background: #f3f4f6;
  color: #4b5563;
}

.status-badge.status-blue {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.status-purple {
  background: #f3e8ff;
  color: #6b21a8;
}

.tags-section {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin: var(--spacing-sm) 0;
}

.tag-badge {
  padding: 2px 8px;
  background: #f3f4f6;
  color: #4b5563;
  border-radius: 4px;
  font-size: 0.75rem;
}

.energy-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin: var(--spacing-sm) 0;
  font-size: 0.875rem;
}

.energy-label {
  color: var(--color-text-muted);
}

.energy-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.energy-badge.energy-low {
  background: #dcfce7;
  color: #166534;
}

.energy-badge.energy-medium {
  background: #fef9c3;
  color: #854d0e;
}

.energy-badge.energy-high {
  background: #fee2e2;
  color: #991b1b;
}

.card-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.action-button {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.action-button:hover {
  background: var(--color-bg);
  border-color: var(--color-primary);
}

.action-button.action-delete {
  color: #dc2626;
  border-color: #fee2e2;
}

.action-button.action-delete:hover {
  background: #fee2e2;
  border-color: #dc2626;
}

.project-card.compact {
  padding: var(--spacing-md);
}

.project-card.compact .card-title {
  font-size: 1rem;
}
*/
