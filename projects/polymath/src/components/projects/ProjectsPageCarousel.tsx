import React, { useMemo } from 'react'
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
import { useProjectStore } from '../../stores/useProjectStore'
import { useSuggestionStore } from '../../stores/useSuggestionStore'

interface ProjectsPageCarouselProps {
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

  // Color Coding
  const getTheme = (type: string) => {
    switch (type) {
      case 'technical': return { border: 'border-blue-500/30', bg: 'from-blue-500/10 to-blue-500/5', text: 'text-blue-400' }
      case 'creative': return { border: 'border-pink-500/30', bg: 'from-pink-500/10 to-pink-500/5', text: 'text-pink-400' }
      case 'learning': return { border: 'border-emerald-500/30', bg: 'from-emerald-500/10 to-emerald-500/5', text: 'text-emerald-400' }
      case 'content': return { border: 'border-purple-500/30', bg: 'from-purple-500/10 to-purple-500/5', text: 'text-purple-400' }
      default: return { border: 'border-white/10', bg: 'from-white/5 to-white/5', text: 'text-slate-400' }
    }
  }

  const theme = getTheme(project.type || 'other')

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`group block rounded-xl backdrop-blur-xl transition-all duration-300 mb-4 break-inside-avoid border ${theme.border} bg-gradient-to-br ${theme.bg} ${prominent ? 'p-5' : 'p-4'}`}
      style={{
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
          <Pin className={`h-4 w-4 flex-shrink-0 ${theme.text}`} />
        )}
      </div>

      {/* Description */}
      {project.description && (
        <p className={`text-gray-400 mb-4 italic font-serif opacity-90 ${prominent ? 'text-sm line-clamp-3' : 'text-xs line-clamp-4'}`}>
          "{project.description}"
        </p>
      )}

      {/* Next Action (The "Unblocker") */}
      {nextTask && (
        <div className={`rounded-lg p-3 mb-3 flex items-start gap-3 bg-black/20 border border-white/5`}>
          <div className={`mt-0.5 ${theme.text}`}>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Next Step</p>
            <p className={`text-sm font-medium text-gray-200 line-clamp-2`}>
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
  loading = false,
}: ProjectsPageCarouselProps) {
  const { projects } = useProjectStore()
  const { clearSuggestions } = useSuggestionStore()

  // Categorize projects for the dashboard
  const { activeList, drawerList, suggestedProjects } = useMemo(() => {
    // 1. Get all priority projects
    const priorityProjects = projects.filter(p => p.is_priority)
    const priorityIds = new Set(priorityProjects.map(p => p.id))
    
    // 2. Get recent active projects, excluding those already prioritized
    const sortedByRecency = [...projects].sort((a, b) => 
      new Date(b.last_active || b.created_at).getTime() - new Date(a.last_active || a.created_at).getTime()
    )

    // Fill remaining slots up to 3 (Pinned + Top Recent) for active focus
    const maxActiveCount = 3
    const recentActiveNonPriority = sortedByRecency
      .filter(p => p.status === 'active' && !priorityIds.has(p.id))
      .slice(0, maxActiveCount - priorityProjects.length) 

    const activeList = [...priorityProjects, ...recentActiveNonPriority].filter(Boolean) as Project[]
    const activeIds = new Set(activeList.map(p => p.id))

    // Everything else goes in the drawer
    let drawerList = projects.filter(p => !activeIds.has(p.id))

    // Shuffle drawer daily (deterministic for the day)
    const seed = new Date().toDateString()
    const seededRandom = (str: string) => {
      let h = 0xdeadbeef;
      for(let i = 0; i < str.length; i++)
        h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
      return ((h ^ h >>> 16) >>> 0) / 4294967296;
    }
    
    drawerList.sort((a, b) => {
      const scoreA = seededRandom(seed + a.id)
      const scoreB = seededRandom(seed + b.id)
      return scoreB - scoreA
    })

    // Separate suggested projects for the clear button logic
    const suggestedProjects = drawerList.filter(p => {
      const created = new Date(p.created_at).getTime()
      const isNew = (Date.now() - created) < (7 * 24 * 60 * 60 * 1000)
      return isNew && !p.is_priority // Assuming suggestions are new and not priority
    })

    return {
      activeList,
      drawerList,
      suggestedProjects
    }
  }, [projects])

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading dashboard...</div>

  return (
    <div className="space-y-8 pb-20">
      
      {/* SECTION 1: ACTIVE FOCUS (Grid) */}
      {activeList.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Pin className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Active Focus</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeList.map(project => (
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
      {drawerList.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-2 mb-4 px-1 mt-8 border-t border-white/5 pt-8">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">The Drawer</h3>
            </div>
            {suggestedProjects.length > 0 && clearSuggestions && (
              <button 
                onClick={clearSuggestions}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear Suggestions
              </button>
            )}
          </div>

          <div className="columns-2 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {drawerList.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="break-inside-avoid mb-4"
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {activeList.length === 0 && drawerList.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p>No projects yet. Capture a thought to start.</p>
        </div>
      )}
    </div>
  )
}