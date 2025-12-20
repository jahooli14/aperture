import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Star,
  ArrowRight,
  CheckCircle2,
  Clock
} from 'lucide-react'
import type { Project } from '../../types'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSuggestionStore } from '../../stores/useSuggestionStore'
import { useContextEngineStore } from '../../stores/useContextEngineStore'
import { PROJECT_COLORS } from './ProjectCard'

interface ProjectsPageCarouselProps {
  loading?: boolean
  activeProjects: Project[]
  drawerProjects: Project[]
  onClearSuggestions?: () => void
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
  const { setContext, toggleSidebar } = useContextEngineStore()
  const tasks = (project.metadata?.tasks || []) as Task[]
  const nextTask = tasks.sort((a, b) => a.order - b.order).find(task => !task.done)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0


  const getTheme = (type: string, title: string) => {
    const t = type?.toLowerCase().trim() || ''

    let rgb = PROJECT_COLORS[t]

    // Deterministic fallback if type is unknown or missing
    if (!rgb) {
      const keys = Object.keys(PROJECT_COLORS).filter(k => k !== 'default')
      let hash = 0
      for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash)
      }
      rgb = PROJECT_COLORS[keys[Math.abs(hash) % keys.length]]
    }

    return {
      borderColor: `rgba(${rgb}, 0.25)`,
      bg: `rgba(${rgb}, 0.1)`,
      textColor: `rgb(${rgb})`,
      rgb: rgb
    }
  }

  const theme = getTheme(project.type || 'other', project.title)

  const handleAnalyze = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContext('project', project.id, project.title, `${project.title}\n\n${project.description || ''}`)
    toggleSidebar(true)
  }

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`group block aperture-card transition-all duration-300 break-inside-avoid ${prominent ? 'p-5 scale-[1.02]' : 'p-4'}`}
      style={{
        boxShadow: prominent || project.is_priority ? `0 12px 40px rgba(${theme.rgb}, 0.2)` : '0 4px 12px rgba(0, 0, 0, 0.2)',
        borderColor: prominent || project.is_priority ? 'var(--brand-primary)' : theme.borderColor,
        background: `rgba(${theme.rgb}, 0.08)`
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `rgba(${theme.rgb}, 0.15)`
        e.currentTarget.style.borderColor = `rgba(${theme.rgb}, 0.4)`
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `rgba(${theme.rgb}, 0.08)`
        e.currentTarget.style.borderColor = prominent || project.is_priority ? 'var(--brand-primary)' : theme.borderColor
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className={`text-white font-bold leading-tight aperture-header ${prominent ? 'text-lg' : 'text-sm'}`}>
          {project.title}
        </h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAnalyze}
            className="w-1.5 h-1.5 rounded-full transition-colors hover:scale-125"
            style={{
              backgroundColor: theme.textColor,
              opacity: 0.6
            }}
            title="AI Analysis"
          >
          </button>
          {project.is_priority && (
            <Star className="h-4 w-4 fill-current text-[var(--brand-primary)]" />
          )}
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className={`text-[var(--brand-text-secondary)] mb-4 italic aperture-body ${prominent ? 'text-sm line-clamp-3' : 'text-xs line-clamp-4'}`}>
          "{project.description}"
        </p>
      )}

      {/* Next Action (The "Unblocker") */}
      {nextTask && (
        <div
          className={`rounded-xl p-3 mb-3 flex items-start gap-3 transition-colors`}
          style={{
            backgroundColor: `rgba(${theme.rgb}, 0.1)`,
            border: `1px solid rgba(${theme.rgb}, 0.2)`
          }}
        >
          <div className="mt-0.5" style={{ color: theme.textColor }}>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-[var(--brand-text-muted)] uppercase tracking-wider mb-0.5 aperture-header">Next Step</p>
            <p className={`text-sm font-medium text-gray-100 line-clamp-2 aperture-body`}>
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
              <div className="h-1 w-16 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${progress}%`,
                    background: theme.textColor
                  }}
                />
              </div>
              <span className="text-[10px] font-bold text-[var(--brand-text-muted)] aperture-header uppercase tracking-wider">{completedTasks}/{totalTasks}</span>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-[var(--brand-text-muted)] flex items-center gap-1 aperture-header uppercase tracking-wider">
              <Clock className="h-3 w-3" />
              {new Date(project.last_active || project.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {prominent && (
          <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-[var(--brand-secondary)] group-hover:text-black transition-colors text-[var(--brand-secondary)]">
            <ArrowRight className="h-4 w-4" />
          </div>
        )}
      </div>
    </Link>
  )
}

export function ProjectsPageCarousel({
  loading = false,
  activeProjects: activeList,
  drawerProjects: drawerList,
  onClearSuggestions
}: ProjectsPageCarouselProps) {
  // const { projects } = useProjectStore() // Removed internal fetching
  // const { clearSuggestions } = useSuggestionStore() // Passed as prop

  // Categorization logic moved to parent (ProjectsPage)

  if (loading) return <div className="p-8 text-center text-[var(--brand-text-muted)] animate-pulse aperture-header uppercase tracking-widest text-xs">Loading dashboard...</div>

  return (
    <div className="space-y-8 pb-20">

      {/* SECTION 1: ACTIVE FOCUS (Grid) */}
      {activeList.length > 0 && (
        <section>
          <div className="mb-4 px-1">
            <h3 className="text-xs font-bold text-[var(--brand-text-muted)] uppercase tracking-widest aperture-header">Active Focus</h3>
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
          <div className="mb-4 px-1 mt-8 border-t border-white/5 pt-8">
            <h3 className="text-xs font-bold text-[var(--brand-text-muted)] uppercase tracking-widest aperture-header">The Drawer</h3>
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
        <div className="text-center py-20 text-[var(--brand-text-muted)] aperture-body italic">
          <p>No projects yet. Capture a thought to start.</p>
        </div>
      )}
    </div>
  )
}