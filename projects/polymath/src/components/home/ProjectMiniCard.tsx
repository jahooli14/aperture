/**
 * ProjectMiniCard — compact two-up card used in the Recently Active
 * and Up Next sections on the home page. Smaller than KeepGoingCard:
 * title + one line of meta, tappable to open. Designed so two sit
 * side-by-side on phones and use vertical space efficiently.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { getTheme } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'
import type { Project } from '../../types'

interface ProjectMiniCardProps {
  project: Project
  /** Small meta line under the title (e.g. "yesterday", "#1 in queue"). */
  meta?: string
}

export function ProjectMiniCard({ project, meta }: ProjectMiniCardProps) {
  const navigate = useNavigate()
  const theme = getTheme(project.type || 'other', project.title)

  return (
    <button
      type="button"
      onClick={() => { haptic.light(); navigate(`/projects/${project.id}`) }}
      className="group relative w-full text-left rounded-2xl p-3.5 transition-all hover:brightness-110 hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(155deg, rgba(${theme.rgb}, 0.10) 0%, rgba(15,24,41,0.55) 70%)`,
        border: `1px solid rgba(${theme.rgb}, 0.28)`,
        boxShadow: `0 4px 16px rgba(0,0,0,0.35), 0 0 18px rgba(${theme.rgb}, 0.10), inset 0 1px 0 rgba(255,255,255,0.04)`,
        minHeight: '92px',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, rgba(${theme.rgb}, 0.5), transparent)` }} />
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-bold leading-snug line-clamp-3 text-[var(--brand-text-primary)]"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
          {project.title}
        </h4>
        <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', color: theme.text }}>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
      {meta && (
        <p className="text-[10px] mt-2 opacity-70" style={{ color: theme.text }}>
          {meta}
        </p>
      )}
    </button>
  )
}
