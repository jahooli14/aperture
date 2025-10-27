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

  const statusConfig: Record<Project['status'], { color: string; label: string; emoji: string }> = {
    upcoming: { color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Upcoming', emoji: '📅' },
    active: { color: 'bg-green-100 text-green-700 border-green-300', label: 'Active', emoji: '🚀' },
    'on-hold': { color: 'bg-gray-100 text-gray-700 border-gray-300', label: 'On Hold', emoji: '⏸️' },
    maintaining: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Maintaining', emoji: '🔧' },
    completed: { color: 'bg-purple-100 text-purple-700 border-purple-300', label: 'Completed', emoji: '✅' },
    archived: { color: 'bg-neutral-100 text-neutral-700 border-neutral-300', label: 'Archived', emoji: '📦' },
    abandoned: { color: 'bg-red-100 text-red-700 border-red-300', label: 'Abandoned', emoji: '⚠️' },
  }

  const typeConfig: Record<Project['type'], { label: string; emoji: string }> = {
    personal: { label: 'Personal', emoji: '🏠' },
    technical: { label: 'Technical', emoji: '⚙️' },
    meta: { label: 'Meta', emoji: '🎯' },
  }

  const energyConfig: Record<string, { label: string; emoji: string; color: string }> = {
    low: { label: 'Low Energy', emoji: '🔋', color: 'text-green-600' },
    moderate: { label: 'Moderate', emoji: '⚡', color: 'text-yellow-600' },
    high: { label: 'High Energy', emoji: '🔥', color: 'text-red-600' },
  }

  const currentStatus = statusConfig[project.status]
  const currentType = typeConfig[project.type]
  const currentEnergy = project.energy_level ? energyConfig[project.energy_level] : null

  return (
    <Card className="border-neutral-200">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Status */}
          <div className="relative">
            <div className="text-xs font-semibold text-neutral-500 mb-1.5">Status</div>
            <button
              onClick={() => setShowStatusPicker(!showStatusPicker)}
              className={`w-full px-3 py-2 rounded-lg font-medium border-2 ${currentStatus.color} transition-all hover:shadow-sm touch-manipulation text-left flex items-center gap-2`}
            >
              <span>{currentStatus.emoji}</span>
              <span className="text-sm">{currentStatus.label}</span>
            </button>

            {showStatusPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowStatusPicker(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-20 max-h-64 overflow-y-auto">
                  {(Object.keys(statusConfig) as Project['status'][]).map((status) => {
                    const config = statusConfig[status]
                    return (
                      <button
                        key={status}
                        onClick={() => {
                          onStatusChange(status)
                          setShowStatusPicker(false)
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors flex items-center gap-2 ${
                          project.status === status ? 'bg-blue-50' : ''
                        }`}
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

          {/* Type */}
          <div>
            <div className="text-xs font-semibold text-neutral-500 mb-1.5">Type</div>
            <div className="px-3 py-2 rounded-lg bg-neutral-100 border-2 border-neutral-200 text-neutral-700 font-medium flex items-center gap-2">
              <span>{currentType.emoji}</span>
              <span className="text-sm">{currentType.label}</span>
            </div>
          </div>

          {/* Energy Level */}
          {currentEnergy && (
            <div>
              <div className="text-xs font-semibold text-neutral-500 mb-1.5">Energy</div>
              <div className={`px-3 py-2 rounded-lg bg-neutral-50 border-2 border-neutral-200 font-medium flex items-center gap-2 ${currentEnergy.color}`}>
                <span>{currentEnergy.emoji}</span>
                <span className="text-sm">{currentEnergy.label}</span>
              </div>
            </div>
          )}

          {/* Estimated Time */}
          {project.estimated_next_step_time && (
            <div>
              <div className="text-xs font-semibold text-neutral-500 mb-1.5">Time</div>
              <div className="px-3 py-2 rounded-lg bg-neutral-50 border-2 border-neutral-200 text-neutral-700 font-medium flex items-center gap-2">
                <span>⏱️</span>
                <span className="text-sm">{project.estimated_next_step_time}min</span>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {project.description && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <p className="text-sm text-neutral-600 leading-relaxed">
              {project.description}
            </p>
          </div>
        )}

        {/* Context Requirements */}
        {project.context_requirements && project.context_requirements.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <div className="text-xs font-semibold text-neutral-500 mb-2">Required Context</div>
            <div className="flex flex-wrap gap-2">
              {project.context_requirements.map((req, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md border border-blue-200"
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
