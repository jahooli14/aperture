/**
 * Projects Page Layout Component
 * Displays projects organized in sections with responsive grid layout
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Pin,
  Clock,
  AlertCircle,
  Sparkles,
  Check,
  ChevronRight
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

function ProjectCard({ project, onUpdateProject }: {
  project: Project
  onUpdateProject?: (id: string, data: Partial<Project>) => Promise<void>
}) {
  const { addToast } = useToast()
  const tasks = (project.metadata?.tasks || []) as any[]
  const nextTask = tasks
    .sort((a, b) => a.order - b.order)
    .find(task => !task.done)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block p-4 rounded-xl backdrop-blur-xl transition-all duration-300 h-full flex flex-col"
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
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
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

      {/* Next Task */}
      {nextTask ? (
        <div
          className="rounded-lg p-2 flex items-center justify-between gap-2 mb-3"
          style={{ background: 'var(--premium-bg-3)' }}
          onClick={(e) => e.stopPropagation()}
        >
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

      {/* Progress bar */}
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
}

function ProjectSection({ title, description, icon: Icon, color, projects, loading }: {
  title: string
  description: string
  icon: React.ComponentType<{ className: string }>
  color: string
  projects: Project[]
  loading?: boolean
}) {
  if (loading || projects.length === 0) {
    return null
  }

  return (
    <div className="mb-10">
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

      {/* Grid of projects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {projects.map((project, idx) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <ProjectCard project={project} />
          </motion.div>
        ))}
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
    <div className="space-y-0">
      {/* Pinned Project - Full Width */}
      {pinnedProject && (
        <div className="mb-12">
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

      {/* Projects Grid Sections */}
      <ProjectSection
        title="Recent"
        description="Recently worked on"
        icon={Clock}
        color="rgba(168, 85, 247, 0.1)"
        projects={recentProjects}
        loading={loading}
      />

      <ProjectSection
        title="Resurface"
        description="Needs some attention"
        icon={AlertCircle}
        color="rgba(251, 191, 36, 0.1)"
        projects={resurfaceProjects}
        loading={loading}
      />

      <ProjectSection
        title="New Ideas"
        description="From suggestions or recently created"
        icon={Sparkles}
        color="rgba(16, 185, 129, 0.1)"
        projects={suggestedProjects}
        loading={loading}
      />
    </div>
  )
}
