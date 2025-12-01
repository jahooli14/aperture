/**
 * Project Carousel Component
 * Displays projects in carousel sections: Pinned, Recent, Resurface, New Ideas
 */

import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Check,
  Pin,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import { useToast } from '../ui/toast'
import { haptic } from '../../utils/haptics'
import type { Project } from '../../types'

interface ProjectCarouselProps {
  projects: Project[]
  loading?: boolean
  onUpdateProject?: (id: string, data: Partial<Project>) => Promise<void>
}

interface ProjectSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  projects: Project[]
}

export function ProjectCarousel({ projects, loading = false, onUpdateProject }: ProjectCarouselProps) {
  const { addToast } = useToast()

  // Build sections from projects
  const sections = useMemo((): ProjectSection[] => {
    const activeProjects = Array.isArray(projects)
      ? projects.filter(p => p.status === 'active')
      : []

    // 1. PINNED - Projects marked as priority
    const pinned = activeProjects.filter(p => p.is_priority)

    // 2. RECENT - Recently updated projects (excluding pinned)
    const recent = activeProjects
      .filter(p => !p.is_priority)
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.last_active).getTime()
        const bTime = new Date(b.updated_at || b.last_active).getTime()
        return bTime - aTime
      })
      .slice(0, 5)

    // 3. RESURFACE - Projects that haven't been touched in a while
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const resurface = activeProjects
      .filter(p => {
        const lastActive = new Date(p.updated_at || p.last_active)
        return lastActive < oneWeekAgo && !p.is_priority && !recent.includes(p)
      })
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.last_active).getTime()
        const bTime = new Date(b.updated_at || b.last_active).getTime()
        return aTime - bTime // Show oldest first
      })
      .slice(0, 5)

    // 4. NEW IDEAS - Newest projects
    const newIdeas = activeProjects
      .filter(p => !p.is_priority && !recent.includes(p) && !resurface.includes(p))
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime()
        const bTime = new Date(b.created_at).getTime()
        return bTime - aTime // Newest first
      })
      .slice(0, 5)

    return [
      {
        id: 'pinned',
        title: 'Pinned',
        description: 'Your favorite projects',
        icon: <Pin className="h-5 w-5" />,
        color: 'rgba(59, 130, 246, 0.1)',
        projects: pinned
      },
      {
        id: 'recent',
        title: 'Recent',
        description: 'Recently worked on',
        icon: <Clock className="h-5 w-5" />,
        color: 'rgba(168, 85, 247, 0.1)',
        projects: recent
      },
      {
        id: 'resurface',
        title: 'Resurface',
        description: 'Needs some attention',
        icon: <AlertCircle className="h-5 w-5" />,
        color: 'rgba(251, 191, 36, 0.1)',
        projects: resurface
      },
      {
        id: 'new-ideas',
        title: 'New Ideas',
        description: 'Fresh projects',
        icon: <Sparkles className="h-5 w-5" />,
        color: 'rgba(16, 185, 129, 0.1)',
        projects: newIdeas
      }
    ]
  }, [projects])

  // Filter to only show sections with projects
  const visibleSections = sections.filter(s => s.projects.length > 0)

  if (loading) {
    return (
      <div className="space-y-8">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-6 w-24 bg-white/10 rounded mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-24 bg-white/10 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {visibleSections.length > 0 ? (
        visibleSections.map((section, sectionIndex) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.1 }}
          >
            {/* Section Header */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: section.color }}
              >
                {section.icon}
              </div>
              <div>
                <h3 className="font-bold text-lg premium-text-platinum">
                  {section.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                  {section.description}
                </p>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3 auto-rows-fr">
              {section.projects.map((project, projectIndex) => {
                const tasks = (project.metadata?.tasks || []) as any[]
                const nextTask = tasks
                  .sort((a, b) => a.order - b.order)
                  .find(task => !task.done)
                const totalTasks = tasks.length
                const completedTasks = tasks.filter(t => t.done).length

                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: projectIndex * 0.05 }}
                  >
                    <Link
                      to={`/projects/${project.id}`}
                      className="group block p-4 rounded-xl backdrop-blur-xl transition-all duration-300 flex flex-col h-full"
                      style={{
                        background: 'var(--premium-bg-2)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--premium-bg-3)'
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--premium-bg-2)'
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                      {/* Header with title and pin indicator */}
                      <div className="flex items-start justify-between gap-2 mb-3 flex-shrink-0">
                        <h4 className="premium-text-platinum font-semibold text-sm flex-1 line-clamp-2">
                          {project.title}
                        </h4>
                        {project.is_priority && (
                          <Pin className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--premium-blue)' }} />
                        )}
                      </div>

                      {/* Description */}
                      {project.description && (
                        <p
                          className="text-xs line-clamp-2 mb-3"
                          style={{ color: 'var(--premium-text-secondary)' }}
                        >
                          {project.description}
                        </p>
                      )}

                      {/* Spacer - grows to fill available space */}
                      <div className="flex-1"></div>

                      {/* Next Task - Interactive with Checkbox */}
                      {nextTask ? (
                        <div
                          className="rounded-lg p-2 flex items-center justify-between gap-2 bg-opacity-50 mb-3 flex-shrink-0"
                          style={{ background: 'var(--premium-bg-3)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={async (e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (!onUpdateProject) return
                              const updatedTasks = tasks.map(t =>
                                t.id === nextTask.id ? { ...t, done: true } : t
                              )
                              try {
                                await onUpdateProject(project.id, {
                                  metadata: { ...project.metadata, tasks: updatedTasks }
                                })
                                addToast({
                                  title: 'Task complete!',
                                  description: nextTask.text,
                                  variant: 'success'
                                })
                                haptic.success()
                              } catch (error) {
                                console.error('Failed to complete task:', error)
                                addToast({
                                  title: 'Failed to complete task',
                                  variant: 'destructive'
                                })
                              }
                            }}
                            className="flex-shrink-0 h-4 w-4 rounded flex items-center justify-center transition-all hover:bg-blue-500/20"
                            style={{
                              color: 'rgba(59, 130, 246, 0.9)',
                              border: '1px solid rgba(255, 255, 255, 0.2)'
                            }}
                            title="Mark as complete"
                          >
                            <Check className="h-2.5 w-2.5 opacity-0 hover:opacity-100" />
                          </button>
                          <p className="text-xs premium-text-platinum line-clamp-1 flex-1">
                            {nextTask.text}
                          </p>
                          {totalTasks > 0 && (
                            <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--premium-text-tertiary)' }}>
                              {completedTasks}/{totalTasks}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs mb-3 flex-shrink-0" style={{ color: 'var(--premium-text-tertiary)' }}>
                          No tasks yet
                        </p>
                      )}

                      {/* Progress bar if tasks exist */}
                      {totalTasks > 0 && (
                        <div className="flex-shrink-0">
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                          >
                            <motion.div
                              className="h-full"
                              style={{
                                background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-emerald))',
                                width: `${(completedTasks / totalTasks) * 100}%`
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                              transition={{ duration: 0.6 }}
                            />
                          </div>
                        </div>
                      )}
                    </Link>
                  </motion.div>
                )
              })}
            </div>

            {/* View More link */}
            {section.projects.length > 0 && (
              <Link
                to="/projects"
                className="inline-flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
                style={{ color: 'var(--premium-blue)' }}
              >
                View all {section.title.toLowerCase()} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </motion.div>
        ))
      ) : (
        <div className="text-center py-12">
          <p style={{ color: 'var(--premium-text-secondary)' }}>
            No active projects yet. Ready to build something?
          </p>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg font-medium"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: 'var(--premium-blue)'
            }}
          >
            View all projects <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
