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
  const getTheme = (type: string, title: string) => {
    const t = type.toLowerCase()
    
    // Explicit mappings with boosted visibility
    if (t === 'tech' || t === 'technical') return { border: 'border-rose-500/40', bg: 'from-rose-500/20 to-rose-500/5', text: 'text-rose-400' }
    if (t === 'creative') return { border: 'border-pink-500/40', bg: 'from-pink-500/20 to-pink-500/5', text: 'text-pink-400' }
    if (t === 'writing') return { border: 'border-indigo-500/40', bg: 'from-indigo-500/20 to-indigo-500/5', text: 'text-indigo-400' }
    if (t === 'business') return { border: 'border-emerald-500/40', bg: 'from-emerald-500/20 to-emerald-500/5', text: 'text-emerald-400' }
    if (t === 'learning') return { border: 'border-amber-500/40', bg: 'from-amber-500/20 to-amber-500/5', text: 'text-amber-400' }
    if (t === 'life') return { border: 'border-cyan-500/40', bg: 'from-cyan-500/20 to-cyan-500/5', text: 'text-cyan-400' }
    if (t === 'hobby') return { border: 'border-orange-500/40', bg: 'from-orange-500/20 to-orange-500/5', text: 'text-orange-400' }
    if (t === 'side-project') return { border: 'border-violet-500/40', bg: 'from-violet-500/20 to-violet-500/5', text: 'text-violet-400' }

    // Deterministic fallback based on title hash
    const colors = [
      { border: 'border-blue-500/40', bg: 'from-blue-500/20 to-blue-500/5', text: 'text-blue-400' },
      { border: 'border-purple-500/40', bg: 'from-purple-500/20 to-purple-500/5', text: 'text-purple-400' },
      { border: 'border-teal-500/40', bg: 'from-teal-500/20 to-teal-500/5', text: 'text-teal-400' },
      { border: 'border-fuchsia-500/40', bg: 'from-fuchsia-500/20 to-fuchsia-500/5', text: 'text-fuchsia-400' },
    ]
    
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
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
      className={`group block rounded-xl backdrop-blur-xl transition-all duration-300 mb-4 break-inside-avoid border ${theme.border} bg-gradient-to-br ${theme.bg} ${prominent ? 'p-5' : 'p-4'}`}
      style={{
        boxShadow: `0 4px 16px ${theme.border.replace('border-', 'rgba(').replace('/30', ', 0.2)')}` // Dynamic boxShadow
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--premium-bg-3)'
        e.currentTarget.style.boxShadow = `0 12px 32px ${theme.border.replace('border-', 'rgba(').replace('/30', ', 0.4)')}`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `linear-gradient(to bottom right, ${theme.bg.replace('from-', '').split('to-')[0]} ${theme.bg.split('to-')[1]})`
        e.currentTarget.style.boxShadow = `0 4px 16px ${theme.border.replace('border-', 'rgba(').replace('/30', ', 0.2)')}`
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className={`premium-text-platinum font-bold leading-tight ${prominent ? 'text-lg' : 'text-sm'}`}>
          {project.title}
        </h4>
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
