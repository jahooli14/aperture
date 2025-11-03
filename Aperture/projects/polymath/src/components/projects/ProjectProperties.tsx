/**
 * Project Properties Component
 * Displays key project metadata in a grid layout with inline editing
 */

import { useState } from 'react'
import { Card, CardContent } from '../ui/card'
import type { Project } from '../../types'

interface ProjectPropertiesProps {
  project: Project
  onUpdate: (updates: Partial<Project>) => void
  onStatusChange: (status: Project['status']) => void
}

export function ProjectProperties({ project, onUpdate, onStatusChange }: ProjectPropertiesProps) {
  const [showStatusPicker, setShowStatusPicker] = useState(false)

  const statusConfig: Record<Project['status'], { bg: string; text: string; border: string; label: string; emoji: string }> = {
    upcoming: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)', label: 'Upcoming', emoji: '📅' },
    active: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)', label: 'Active', emoji: '🚀' },
    'on-hold': { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)', label: 'On Hold', emoji: '⏸️' },
    maintaining: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', label: 'Maintaining', emoji: '🔧' },
    completed: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)', label: 'Completed', emoji: '✅' },
    archived: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)', label: 'Archived', emoji: '📦' },
    abandoned: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', label: 'Abandoned', emoji: '⚠️' },
  }

  const energyConfig: Record<string, { label: string; emoji: string; color: string }> = {
    low: { label: 'Low Energy', emoji: '🔋', color: '#10b981' },
    moderate: { label: 'Moderate', emoji: '⚡', color: '#fbbf24' },
    high: { label: 'High Energy', emoji: '🔥', color: '#ef4444' },
  }

  const currentStatus = statusConfig[project.status]
  const currentEnergy = project.energy_level ? energyConfig[project.energy_level] : null

  return (
    <Card className="premium-card">
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {/* Status */}
          <div className="relative">
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>Status</div>
            <button
              onClick={() => setShowStatusPicker(!showStatusPicker)}
              className="w-full px-2 py-1.5 rounded-lg font-medium border transition-all hover:shadow-sm touch-manipulation text-left flex items-center gap-1.5"
              style={{
                backgroundColor: currentStatus.bg,
                color: currentStatus.text,
                borderColor: currentStatus.border
              }}
            >
              <span className="text-sm">{currentStatus.emoji}</span>
              <span className="text-xs">{currentStatus.label}</span>
            </button>

            {showStatusPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowStatusPicker(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-2 premium-card rounded-lg shadow-lg py-1 z-20 max-h-64 overflow-y-auto">
                  {(Object.keys(statusConfig) as Project['status'][]).map((status) => {
                    const config = statusConfig[status]
                    return (
                      <button
                        key={status}
                        onClick={() => {
                          onStatusChange(status)
                          setShowStatusPicker(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                        style={{
                          backgroundColor: project.status === status ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: 'var(--premium-text-primary)'
                        }}
                      >
                        <span>{config.emoji}</span>
                        <span>{config.label}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Energy Level */}
          {currentEnergy && (
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>Energy</div>
              <div className="px-2 py-1.5 rounded-lg border font-medium flex items-center gap-1.5" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: currentEnergy.color
              }}>
                <span className="text-sm">{currentEnergy.emoji}</span>
                <span className="text-xs">{currentEnergy.label}</span>
              </div>
            </div>
          )}

          {/* Estimated Time */}
          {project.estimated_next_step_time && (
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>Time</div>
              <div className="px-2 py-1.5 rounded-lg border font-medium flex items-center gap-1.5" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-primary)'
              }}>
                <span className="text-sm">⏱️</span>
                <span className="text-xs">{project.estimated_next_step_time}min</span>
              </div>
            </div>
          )}
        </div>

        {/* Context Requirements */}
        {project.context_requirements && project.context_requirements.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--premium-text-tertiary)' }}>Required Context</div>
            <div className="flex flex-wrap gap-2">
              {project.context_requirements.map((req, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs rounded-md border"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    borderColor: 'rgba(59, 130, 246, 0.3)'
                  }}
                >
                  {req}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
