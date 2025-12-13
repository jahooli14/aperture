import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Pin,
  ArrowRight,
  CheckCircle2,
  Clock
} from 'lucide-react'
import type { Project } from '../../types'
import { useContextEngineStore } from '../../stores/useContextEngineStore'

interface Task {
  text: string
  done: boolean
  order: number
}

const CARD_HOVER_STYLES = {
  enter: { background: 'var(--premium-bg-3)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)', transform: 'translateY(-2px)' },
  leave: { background: 'var(--premium-bg-2)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', transform: 'translateY(0)' }
}

// Export colors for reuse
export const PROJECT_COLORS: Record<string, string> = {
  tech: '59, 130, 246',      // Blue-500
  art: '236, 72, 153',       // Pink-500
  writing: '99, 102, 241',   // Indigo-500
  music: '168, 85, 247',     // Purple-500
  business: '16, 185, 129',  // Emerald-500
  life: '6, 182, 212',       // Cyan-500
  default: '148, 163, 184'   // Slate-400
}

export function ProjectCard({ project, prominent = false }: { project: Project, prominent?: boolean }) {
  const { setContext, toggleSidebar } = useContextEngineStore()
  const tasks = (project.metadata?.tasks || []) as Task[]
  const nextTask = tasks.sort((a, b) => a.order - b.order).find(task => !task.done)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  // Color Coding
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
      border: `rgba(${rgb}, 0.4)`,
      bg: `rgba(${rgb}, 0.15)`,
      text: `rgb(${rgb})`,
      rgb: rgb
    }
  }

  const theme = getTheme(project.type, project.title)

  const handleAnalyze = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContext('project', project.id, project.title, `${project.title}\n\n${project.description || ''}`)
    toggleSidebar(true)
  }

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`group block rounded-xl backdrop-blur-xl transition-all duration-300 break-inside-avoid border ${prominent ? 'p-5' : 'p-4'}`}
      style={{
        borderColor: theme.border,
        background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.15) 0%, rgba(${theme.rgb}, 0.05) 100%)`,
        boxShadow: `0 4px 16px rgba(0, 0, 0, 0.2)`
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.25) 0%, rgba(${theme.rgb}, 0.1) 100%)`
        e.currentTarget.style.borderColor = `rgba(${theme.rgb}, 0.5)`
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 12px 32px rgba(${theme.rgb}, 0.15)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.15) 0%, rgba(${theme.rgb}, 0.05) 100%)`
        e.currentTarget.style.borderColor = theme.border
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.2)`
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-bold leading-tight premium-text-platinum" style={{ fontSize: prominent ? '1.125rem' : '0.875rem' }}>
          {project.title}
        </h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAnalyze}
            className="w-1.5 h-1.5 rounded-full transition-colors hover:scale-125"
            style={{
              backgroundColor: `rgba(${theme.rgb}, 0.7)`
            }}
            title="AI Analysis"
          >
          </button>
          {project.is_priority && (
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.text }}></div>
          )}
        </div>
      </div>

      {/* Focus Stream Mode: Prominently show Next Action if available */}
      {nextTask ? (
        <div className="mb-4">
          <div
            className="rounded-lg p-3 flex items-start gap-3 transition-all group-hover:bg-white/5"
            style={{
              background: `rgba(${theme.rgb}, 0.1)`,
              border: `1px solid rgba(${theme.rgb}, 0.3)`
            }}
          >
            <div className="mt-0.5 flex-shrink-0" style={{ color: theme.text }}>
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70" style={{ color: theme.text }}>
                Immediate Next Step
              </p>
              <p className="text-sm font-medium leading-snug text-gray-100 line-clamp-3">
                {nextTask.text}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Fallback: Description if no next task */
        project.description && (
          <p className={`mb-4 italic font-serif opacity-90 ${prominent ? 'text-sm line-clamp-3' : 'text-xs line-clamp-4'}`} style={{ color: `rgba(${theme.rgb}, 0.9)` }}>
            "{project.description}"
          </p>
        )
      )}

      {/* Footer / Meta */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid rgba(${theme.rgb}, 0.2)` }}>
        <div className="flex items-center gap-2">
          {totalTasks > 0 ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, rgba(${theme.rgb}, 0.5), rgba(${theme.rgb}, 1))`
                  }}
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
          <div className="p-1.5 rounded-full bg-white/5 transition-colors" style={{ color: `rgba(${theme.rgb}, 0.8)` }}>
            <ArrowRight className="h-4 w-4" />
          </div>
        )}
      </div>
    </Link>
  )
}