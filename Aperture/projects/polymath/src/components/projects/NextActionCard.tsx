/**
 * Next Action Card Component
 * Prominently displays the project's next step with GTD principles
 */

import { useState } from 'react'
import { Target, Check } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import type { Project, ProjectMetadata } from '../../types'

interface NextActionCardProps {
  project: Project
  onUpdate: (metadata: Partial<ProjectMetadata>) => void
}

export function NextActionCard({ project, onUpdate }: NextActionCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(project.metadata?.next_step || '')

  const nextStep = project.metadata?.next_step
  const estimatedTime = project.estimated_next_step_time
  const energyLevel = project.energy_level
  const contextRequirements = project.context_requirements || []

  const handleSave = () => {
    if (editedText.trim()) {
      onUpdate({ next_step: editedText.trim() })
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditedText(nextStep || '')
    }
  }

  // Empty state
  if (!nextStep && !isEditing) {
    return (
      <Card className="border-2 border-dashed border-neutral-300 bg-neutral-50">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center">
              <Target className="h-12 w-12 text-neutral-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-700 mb-1">
                Define your next step
              </h3>
              <p className="text-sm text-neutral-500 max-w-md mx-auto">
                Set a clear, actionable next step to move this project forward
              </p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-blue-900 text-white rounded-full font-medium hover:bg-blue-800 transition-colors shadow-sm"
            >
              Add Next Action
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-900 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <Target className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">
                Next Action
              </h3>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  autoFocus
                  rows={3}
                  className="w-full px-3 py-2 text-base text-neutral-900 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="What's the next physical, visible action?"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-1.5 bg-blue-900 text-white text-sm rounded-md font-medium hover:bg-blue-800 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditedText(nextStep || '')
                    }}
                    className="px-4 py-1.5 bg-neutral-200 text-neutral-700 text-sm rounded-md font-medium hover:bg-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p
                  onClick={() => setIsEditing(true)}
                  className="text-base font-medium text-neutral-900 leading-relaxed cursor-text hover:bg-white/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                >
                  {nextStep}
                </p>

                {/* Metadata */}
                {(estimatedTime || energyLevel || contextRequirements.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {estimatedTime && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white/70 text-neutral-700 rounded-md border border-blue-200">
                        <span>⏱️</span>
                        <span>~{estimatedTime}min</span>
                      </span>
                    )}

                    {energyLevel && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white/70 text-neutral-700 rounded-md border border-blue-200">
                        {energyLevel === 'low' && <span>🔋 Low</span>}
                        {energyLevel === 'moderate' && <span>⚡ Moderate</span>}
                        {energyLevel === 'high' && <span>🔥 High</span>}
                      </span>
                    )}

                    {contextRequirements.length > 0 && (
                      contextRequirements.slice(0, 2).map((req, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white/70 text-neutral-700 rounded-md border border-blue-200"
                        >
                          {req}
                        </span>
                      ))
                    )}

                    {contextRequirements.length > 2 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white/70 text-neutral-500 rounded-md border border-blue-200">
                        +{contextRequirements.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
