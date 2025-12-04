/**
 * Projects Dashboard Component
 * Google Keep-style masonry layout for projects
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Pin,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles
} from 'lucide-react'
import type { Project } from '../../types'

interface ProjectsPageCarouselProps {
  pinnedProject: Project | null
  recentProjects: Project[]
  resurfaceProjects: Project[]
  suggestedProjects: Project[]
  loading?: boolean
}

interface Task {
  text: string
  done: boolean
  order: number
}

const CARD_HOVER_STYLES = {
  enter: { background: 'var(--premium-bg-3)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)', transform: 'translateY(-2px)' },
  leave: { background: 'var(--premium-bg-2)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', transform: 'translateY(0)' }
}

function ProjectCard({ project, prominent = false }: { project: Project, prominent?: boolean }) {
  const tasks = (project.metadata?.tasks || []) as Task[]
  const nextTask = tasks.sort((a, b) => a.order - b.order).find(task => !task.done)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`group block rounded-xl backdrop-blur-xl transition-all duration-300 mb-4 break-inside-avoid ${prominent ? 'p-5 border border-white/10' : 'p-4'}`}
      style={{
        background: 'var(--premium-bg-2)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, CARD_HOVER_STYLES.enter)}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, CARD_HOVER_STYLES.leave)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className={`premium-text-platinum font-bold leading-tight ${prominent ? 'text-lg' : 'text-sm'}`}>
          {project.title}
        </h4>
        {project.is_priority && (
          <Pin className="h-4 w-4 text-blue-400 flex-shrink-0" />
        )}
      </div>

      {/* Description */}
      {project.description && (
        <p className={`text-gray-400 mb-4 ${prominent ? 'text-sm line-clamp-3' : 'text-xs line-clamp-4'}`}>
          {project.description}
        </p>
      )}

      {/* Next Action (The "Unblocker") */}
      {nextTask && (
        <div className={`rounded-lg p-3 mb-3 flex items-start gap-3 ${prominent ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/5'}`}>
          <div className={`mt-0.5 ${prominent ? 'text-blue-400' : 'text-gray-500'}`}>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-0.5">Next Step</p>
            <p className={`text-sm font-medium ${prominent ? 'text-blue-100' : 'text-gray-200'} line-clamp-2`}>
              {nextTask.text}
            </p>
          </div>
        </div>
      )}

      {/* Footer / Meta */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          {totalTasks > 0 ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{completedTasks}/{totalTasks}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(project.last_active || project.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        
        {prominent && (
          <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-blue-500 group-hover:text-white transition-colors text-gray-500">
            <ArrowRight className="h-4 w-4" />
          </div>
        )}
      </div>
    </Link>
  )
}

export function ProjectsPageCarousel({
  pinnedProject,
  recentProjects,
  resurfaceProjects,
  suggestedProjects,
  loading = false
}: ProjectsPageCarouselProps) {
  // Combine dormant projects for "The Drawer"
  const drawerProjects = [...resurfaceProjects, ...suggestedProjects]
  
  // Active Focus: Pinned + Top 2 Recent (excluding pinned if it's in recent)
  const activeProjects = [
    pinnedProject,
    ...recentProjects.filter(p => p.id !== pinnedProject?.id).slice(0, 2)
  ].filter(Boolean) as Project[]

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading dashboard...</div>

  return (
    <div className="space-y-8 pb-20">
      
      {/* SECTION 1: ACTIVE FOCUS (Grid) */}
      {activeProjects.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Active Focus</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProjects.map(project => (
              <motion.div 
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ProjectCard project={project} prominent={true} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2: THE DRAWER (Masonry) */}
      {drawerProjects.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4 px-1 mt-8 border-t border-white/5 pt-8">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">The Drawer</h3>
          </div>

          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {drawerProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {activeProjects.length === 0 && drawerProjects.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p>No projects yet. Capture a thought to start.</p>
        </div>
      )}
    </div>
  )
}
