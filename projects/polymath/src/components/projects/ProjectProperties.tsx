/**
 * Project Properties Component
 * Displays key project metadata in a grid layout with inline editing
 */

import { Card, CardContent } from '../ui/card'
import type { Project } from '../../types'

interface ProjectPropertiesProps {
  project: Project
  onUpdate: (updates: Partial<Project>) => void
}

export function ProjectProperties({ project, onUpdate }: ProjectPropertiesProps) {
  const energyConfig: Record<string, { label: string; emoji: string; color: string }> = {
    low: { label: 'Low Energy', emoji: '🔋', color: '#10b981' },
    moderate: { label: 'Moderate', emoji: '⚡', color: '#fbbf24' },
    high: { label: 'High Energy', emoji: '🔥', color: '#ef4444' },
  }

  const currentEnergy = project.energy_level ? energyConfig[project.energy_level] : null

  return (
    <Card className="premium-card">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-start gap-3">

          {/* Energy Level */}
          {currentEnergy && (
            <div className="flex-shrink-0">
              <div className="px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5" style={{
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
            <div className="flex-shrink-0">
              <div className="px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-primary)'
              }}>
                <span className="text-sm">⏱️</span>
                <span className="text-xs">{project.estimated_next_step_time}min</span>
              </div>
            </div>
          )}

          {/* Context Requirements */}
          {project.context_requirements && project.context_requirements.length > 0 && (
            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
              {project.context_requirements.map((req, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs rounded-md border flex-shrink-0"
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
          )}
        </div>
      </CardContent>
    </Card>
  )
}
