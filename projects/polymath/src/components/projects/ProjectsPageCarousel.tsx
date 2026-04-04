import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, ArrowRight, CheckCircle2, Clock, Snowflake, Archive, Sprout, Loader2 } from 'lucide-react'
import type { Project } from '../../types'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSuggestionStore } from '../../stores/useSuggestionStore'
import { useContextEngineStore } from '../../stores/useContextEngineStore'
import { PROJECT_COLORS, getTheme } from '../../lib/projectTheme'
import { getNextTask } from '../../lib/taskUtils'
import { api } from '../../lib/apiClient'
import { useToast } from '../ui/toast'

interface ProjectsPageCarouselProps {
  loading?: boolean
  activeProjects: Project[]
  drawerProjects: Project[]
  archiveSpotlight?: Project | null
  onClearSuggestions?: () => void
}

interface Task {
  text: string
  done: boolean
  order: number
}

const CARD_HOVER_STYLES = {
  enter: { background: 'var(--glass-surface)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)', transform: 'translateY(-2px)' },
  leave: { background: 'var(--brand-glass-bg)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', transform: 'translateY(0)' }
}

function ProjectCard({ project, prominent = false }: { project: Project, prominent?: boolean }) {
  const { setContext, toggleSidebar } = useContextEngineStore()
  const { setPriority } = useProjectStore()
  const tasks = (project.metadata?.tasks || []) as Task[]
  const nextTask = getNextTask(project)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0


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
      className={`group block glass-card glass-card-hover transition-all duration-300 break-inside-avoid ${prominent ? 'p-5 scale-[1.02]' : 'p-4'}`}
      style={{
        boxShadow: prominent || project.is_priority ? `0 12px 40px rgba(${theme.rgb}, 0.2)` : '0 4px 12px rgba(0, 0, 0, 0.2)',
        borderColor: prominent || project.is_priority ? 'var(--brand-primary)' : theme.borderColor,
        background: `rgba(${theme.rgb}, 0.08)`
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className={`text-[var(--brand-text-primary)] font-bold leading-tight aperture-header ${prominent ? 'text-lg' : 'text-sm'}`}>
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
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setPriority(project.id)
            }}
            className="flex-shrink-0 p-0.5 rounded-lg hover:bg-white/10 transition-colors"
            title={project.is_priority ? 'Remove priority' : 'Set as priority'}
          >
            <Star
              className="h-4 w-4"
              style={{
                color: project.is_priority ? 'var(--brand-primary)' : 'rgba(255,255,255,0.25)',
                fill: project.is_priority ? 'var(--brand-primary)' : 'none'
              }}
            />
          </button>
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
            <p className={`text-sm font-medium text-[var(--brand-text-primary)] line-clamp-2 aperture-body`}>
              {nextTask.text}
            </p>
          </div>
        </div>
      )}

      {/* Footer / Meta */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-surface)]">
        <div className="flex items-center gap-2">
          {totalTasks > 0 ? (
            <div className="flex items-center gap-2">
              <div className="h-1 w-16 bg-[var(--glass-surface)] rounded-full overflow-hidden">
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

        <div className="flex items-center gap-2">
          {project.status === 'dormant' && (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
              style={{ color: 'rgba(148,163,184,0.7)', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)' }}>
              <Snowflake className="h-2.5 w-2.5" />
              cooling
            </span>
          )}
          {prominent && (
            <div className="p-1.5 rounded-full bg-[var(--glass-surface)] group-hover:bg-[var(--brand-secondary)] group-hover:text-black transition-colors text-[var(--brand-secondary)]">
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function ArchivesSpotlightCard({ project }: { project: Project }) {
  const { addToast } = useToast()
  const { fetchProjects } = useProjectStore()
  const [resurrecting, setResurrecting] = React.useState(false)

  const daysBuried = Math.floor(
    (Date.now() - new Date(project.updated_at || project.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  const handleResurrect = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResurrecting(true)
    try {
      await api.post(`projects?resource=reaper&action=resurrect&id=${project.id}`, {})
      addToast({ title: `Resurrected "${project.title}"`, description: 'Back from the archives.', variant: 'success' })
      fetchProjects()
    } catch {
      addToast({ title: 'Error', description: 'Failed to resurrect project.', variant: 'destructive' })
    } finally {
      setResurrecting(false)
    }
  }

  return (
    <div className="rounded-2xl p-4 flex items-center gap-4"
      style={{
        background: 'rgba(148,163,184,0.04)',
        border: '1px solid rgba(148,163,184,0.12)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' }}>
        <Archive className="h-4 w-4" style={{ color: 'rgba(148,163,184,0.7)' }} />
      </div>

      <Link to={`/projects/${project.id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>
          From the archives · {daysBuried}d ago
        </p>
        <p className="text-sm font-bold text-[var(--brand-text-primary)] truncate">{project.title}</p>
        {project.description && (
          <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--brand-text-secondary)' }}>{project.description}</p>
        )}
      </Link>

      <button
        onClick={handleResurrect}
        disabled={resurrecting}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:scale-105"
        style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}
      >
        {resurrecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sprout className="h-3 w-3" />}
        Revive
      </button>
    </div>
  )
}

export function ProjectsPageCarousel({
  loading = false,
  activeProjects: activeList,
  drawerProjects: drawerList,
  archiveSpotlight,
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

      {/* The drawer has moved behind a nav icon (/projects/drawer). The main
          page now only shows active focus + a conditional "For you today"
          strip with warmed items. Silence over slop. */}
      {drawerList.length > 0 && (
        <div className="mt-8 pt-8 border-t border-[var(--glass-surface)] text-center">
          <Link
            to="/projects/drawer"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-text-muted)] hover:text-[var(--brand-primary)] transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            {drawerList.length} resting in the drawer
          </Link>
        </div>
      )}

      {/* SECTION 3: FROM THE ARCHIVES (weekly graveyard spotlight) */}
      {archiveSpotlight && (
        <section>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ArchivesSpotlightCard project={archiveSpotlight} />
          </motion.div>
        </section>
      )}

      {activeList.length === 0 && drawerList.length === 0 && (
        <div className="py-16 px-6 text-center">
          <div className="max-w-sm mx-auto">
            {/* Ghost project card */}
            <div className="mb-8 p-5 rounded-2xl text-left opacity-30"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px dashed rgba(59,130,246,0.3)' }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-2/3 rounded-lg bg-[var(--glass-surface)]" />
                  <div className="h-3 w-full rounded-lg bg-[var(--glass-surface)]" />
                  <div className="h-3 w-4/5 rounded-lg bg-[var(--glass-surface)]" />
                </div>
                <Star className="h-4 w-4 text-[var(--brand-primary)] flex-shrink-0 mt-1" />
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <div className="h-3 w-1/2 rounded bg-[var(--glass-surface)] mb-1" />
                <div className="h-3 w-4/5 rounded bg-[var(--glass-surface)]" />
              </div>
            </div>

            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] leading-tight mb-2">
              Nothing in motion<br />
              <span className="text-brand-primary">yet.</span>
            </h3>
            <p className="text-sm text-[var(--brand-text-muted)] leading-relaxed mb-6">
              Projects grow from your thoughts. Capture something with the mic, then turn it into a project.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}