/**
 * Next Action Card Component
 * Prominently displays the first uncompleted task as the next step (GTD principles)
 */

import { Target } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import type { Project } from '../../types'

interface Task {
  id: string
  text: string
  done: boolean
  order: number
}

interface NextActionCardProps {
  project: Project
  onUpdate?: () => void
}

export function NextActionCard({ project }: NextActionCardProps) {
  const tasks = (project.metadata?.tasks || []) as Task[]

  // Find first uncompleted task (sorted by order)
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)
  const nextTask = sortedTasks.find(task => !task.done)

  // Empty state - no tasks at all
  if (tasks.length === 0) {
    return (
      <Card className="border-2 border-dashed premium-card" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center">
              <Target className="h-12 w-12" style={{ color: 'var(--premium-text-tertiary)' }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1 premium-text-platinum">
                No tasks yet
              </h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--premium-text-secondary)' }}>
                Add tasks below to define your next action
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // All tasks completed
  if (!nextTask) {
    return (
      <Card className="border-2 premium-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}>
              <Target className="h-5 w-5" style={{ color: '#10b981' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#10b981' }}>
                  All Done!
                </h3>
              </div>
              <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                All tasks completed. Add more tasks or mark this project as complete.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Display next action (first uncompleted task)
  return (
    <Card className="border-2 premium-card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))' }}>
            <Target className="h-5 w-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--premium-blue)' }}>
                Next Action
              </h3>
            </div>
            <p className="text-base font-medium leading-relaxed premium-text-platinum">
              {nextTask.text}
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--premium-text-tertiary)' }}>
              From task list • Edit in tasks below
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
