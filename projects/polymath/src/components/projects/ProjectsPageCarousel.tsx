/**
 * Projects Page Carousel Component
 * Displays projects in organized sections with auto-scrolling carousels
 */

import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Pin,
  Clock,
  AlertCircle,
  Sparkles,
  Check
} from 'lucide-react'
import { useToast } from '../ui/toast'
import { haptic } from '../../utils/haptics'
import type { Project } from '../../types'

interface ProjectsPageCarouselProps {
  pinnedProject: Project | null
  recentProjects: Project[]
  resurfaceProjects: Project[]
  suggestedProjects: Project[]
  loading?: boolean
  onUpdateProject?: (id: string, data: Partial<Project>) => Promise<void>
}

function AutoScrollCarousel({ projects, title, description, icon: Icon, color, loading }: {
  projects: Project[]
  title: string
  description: string
  icon: React.ComponentType<{ className: string }>
  color: string
  loading?: boolean
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { addToast } = useToast()

  // Auto-scroll carousel
  useEffect(() => {
    if (!scrollContainerRef.current || projects.length === 0) return

    const interval = setInterval(() => {
      const container = scrollContainerRef.current
      if (!container) return

      // Auto-scroll to right
      container.scrollBy({
        left: 300,
        behavior: 'smooth'
      })

      // Reset to beginning if we reach the end
      if (
        container.scrollLeft + container.clientWidth >=
        container.scrollWidth - 10
      ) {
        setTimeout(() => {
          container.scrollLeft = 0
        }, 2000)
      }
    }, 5000) // Scroll every 5 seconds

    return () => clearInterval(interval)
  }, [projects])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 w-24 bg-white/10 rounded mb-2" />
        <div className="h-4 w-48 bg-white/5 rounded mb-4" />
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 w-48 bg-white/10 rounded flex-shrink-0" />
          ))}
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg premium-text-platinum">
            {title}
          </h3>
          <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
            {description}
          </p>
        </div>
      </div>

      {/* Auto-Scrolling Carousel */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {projects.map((project, idx) => {
          const tasks = (project.metadata?.tasks || []) as any[]
          const nextTask = tasks
            .sort((a, b) => a.order - b.order)
            .find(task => !task.done)
          const totalTasks = tasks.length
          const completedTasks = tasks.filter(t => t.done).length

          return (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group flex-shrink-0 w-72 p-4 rounded-xl backdrop-blur-xl transition-all duration-300 flex flex-col h-full"
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
              <div className="flex items-start justify-between gap-2 mb-3">
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
                  className="text-xs line-clamp-2 mb-3 flex-1"
                  style={{ color: 'var(--premium-text-secondary)' }}
                >
                  {project.description}
                </p>
              )}

              {/* Next Task - Interactive with Checkbox */}
              {nextTask ? (
                <div
                  className="rounded-lg p-2 flex items-center justify-between gap-2 bg-opacity-50 mb-3"
                  style={{ background: 'var(--premium-bg-3)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      // Could add task completion here
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
                <p className="text-xs mb-3" style={{ color: 'var(--premium-text-tertiary)' }}>
                  No tasks yet
                </p>
              )}

              {/* Progress bar if tasks exist */}
              {totalTasks > 0 && (
                <div className="mt-auto">
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
          )
        })}
      </div>
    </div>
  )
}

export function ProjectsPageCarousel({
  pinnedProject,
  recentProjects,
  resurfaceProjects,
  suggestedProjects,
  loading = false,
  onUpdateProject
}: ProjectsPageCarouselProps) {
  return (
    <div className="space-y-8">
      {/* Pinned Project - Highlighted at Top */}
      {pinnedProject && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(59, 130, 246, 0.1)' }}
            >
              <Pin className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
            </div>
            <div>
              <h3 className="font-bold text-lg premium-text-platinum">
                Pinned
              </h3>
              <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                Your priority project
              </p>
            </div>
          </div>

          <Link
            to={`/projects/${pinnedProject.id}`}
            className="group block p-6 rounded-xl backdrop-blur-xl transition-all duration-300"
            style={{
              background: 'var(--premium-bg-2)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(59, 130, 246, 0.3)'
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
            <h4 className="premium-text-platinum font-bold text-xl mb-2">
              {pinnedProject.title}
            </h4>
            {pinnedProject.description && (
              <p
                className="text-sm mb-4"
                style={{ color: 'var(--premium-text-secondary)' }}
              >
                {pinnedProject.description}
              </p>
            )}
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--premium-blue)' }}>
              Open project <ChevronRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      )}

      {/* Auto-Scrolling Sections */}
      <AutoScrollCarousel
        projects={recentProjects}
        title="Recent"
        description="Recently worked on"
        icon={Clock}
        color="rgba(168, 85, 247, 0.1)"
        loading={loading}
      />

      <AutoScrollCarousel
        projects={resurfaceProjects}
        title="Resurface"
        description="Needs some attention"
        icon={AlertCircle}
        color="rgba(251, 191, 36, 0.1)"
        loading={loading}
      />

      <AutoScrollCarousel
        projects={suggestedProjects}
        title="New Ideas"
        description="From suggestions or recently created"
        icon={Sparkles}
        color="rgba(16, 185, 129, 0.1)"
        loading={loading}
      />

      {/* All Projects Link */}
      <div className="text-center pt-4">
        <Link
          to="/projects?view=all"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:opacity-90"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: 'var(--premium-blue)'
          }}
        >
          View all projects <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
