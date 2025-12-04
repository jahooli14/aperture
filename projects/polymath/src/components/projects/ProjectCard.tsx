import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Pin,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles
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

export function ProjectCard({ project, prominent = false }: { project: Project, prominent?: boolean }) {
  const { setContext, toggleSidebar } = useContextEngineStore()
  const tasks = (project.metadata?.tasks || []) as Task[]
  const nextTask = tasks.sort((a, b) => a.order - b.order).find(task => !task.done)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  // Color Coding
  const getTheme = (type: string = '') => {
    const t = type.toLowerCase().trim()
    // console.log('ProjectCard type:', t) // Debugging

    switch (t) {
      case 'technical':
      case 'tech': 
        return { 
          border: 'border-rose-500', 
          bg: 'from-rose-950/40 to-rose-900/20', 
          text: 'text-rose-400', 
          shadow: 'shadow-rose-900/20'
        }
      case 'creative': 
        return { 
          border: 'border-pink-500', 
          bg: 'from-pink-950/40 to-pink-900/20', 
          text: 'text-pink-400',
          shadow: 'shadow-pink-900/20'
        }
      case 'writing': 
        return { 
          border: 'border-indigo-500', 
          bg: 'from-indigo-950/40 to-indigo-900/20', 
          text: 'text-indigo-400',
          shadow: 'shadow-indigo-900/20'
        }
      case 'business': 
        return { 
          border: 'border-emerald-500', 
          bg: 'from-emerald-950/40 to-emerald-900/20', 
          text: 'text-emerald-400',
          shadow: 'shadow-emerald-900/20'
        }
      case 'learning': 
        return { 
          border: 'border-amber-500', 
          bg: 'from-amber-950/40 to-amber-900/20', 
          text: 'text-amber-400',
          shadow: 'shadow-amber-900/20'
        }
      case 'life': 
        return { 
          border: 'border-cyan-500', 
          bg: 'from-cyan-950/40 to-cyan-900/20', 
          text: 'text-cyan-400',
          shadow: 'shadow-cyan-900/20'
        }
      case 'hobby': 
        return { 
          border: 'border-orange-500', 
          bg: 'from-orange-950/40 to-orange-900/20', 
          text: 'text-orange-400',
          shadow: 'shadow-orange-900/20'
        }
      case 'side-project': 
        return { 
          border: 'border-violet-500', 
          bg: 'from-violet-950/40 to-violet-900/20', 
          text: 'text-violet-400',
          shadow: 'shadow-violet-900/20'
        }
      default: 
        return { 
          border: 'border-slate-700', 
          bg: 'from-slate-800/40 to-slate-900/20', 
          text: 'text-slate-400',
          shadow: 'shadow-slate-900/20'
        }
    }
  }

  const theme = getTheme(project.type)

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`group block rounded-xl backdrop-blur-xl transition-all duration-300 mb-4 break-inside-avoid border bg-gradient-to-br ${theme.border} ${theme.bg} ${prominent ? 'p-5' : 'p-4'}`}
      style={{
        boxShadow: `0 4px 12px rgba(0,0,0,0.2)` // Base shadow
      }}
      onMouseEnter={(e) => {
        // We handle hover style via CSS classes mostly now to allow Tailwind to work better, 
        // but for dynamic colors we might need inline styles if classes fail.
        // Let's rely on the classes first.
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
           {/* Visual Debug Dot / Type Indicator */}
           <div className={`w-2 h-2 rounded-full ${theme.text.replace('text-', 'bg-')}`} />
           <h4 className={`premium-text-platinum font-bold leading-tight ${prominent ? 'text-lg' : 'text-sm'}`}>
            {project.title}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            onClick={handleAnalyze}
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-blue-400"
            title="AI Analysis"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          {project.is_priority && (
            <Pin className={`h-4 w-4 ${theme.text}`} />
          )}
        </div>
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
