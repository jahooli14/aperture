/**
 * Long-Dormant Hint
 *
 * Mode 2b seed (CLAUDE.md §The Moment). When a shaped project has been
 * dormant 4+ months, surface it once on the home as a quiet line: "you
 * started this — pick it up?". Not a hero, not a generated reshape (that
 * needs AI synthesis); just a low-contrast reminder that earns its place
 * by being rare and concrete.
 *
 * Renders nothing if no project qualifies. Tappable; navigates to the
 * project's detail page.
 */

import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useLongDormantProject } from '../../stores/useProjectStore'

function monthsSince(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (!t) return 0
  const days = (Date.now() - t) / (24 * 60 * 60 * 1000)
  return Math.floor(days / 30)
}

export function LongDormantHint() {
  const navigate = useNavigate()
  const project = useLongDormantProject()

  if (!project) return null

  const months = monthsSince(project.last_active || project.updated_at)
  const monthLabel = months >= 12
    ? `${Math.floor(months / 12)}y`
    : `${months}mo`

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className="w-full text-left flex items-center gap-3 py-3 px-4 press-spring transition-colors"
      style={{
        borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px dashed rgba(255,255,255,0.10)',
        color: 'var(--brand-text-secondary)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(var(--brand-primary-rgb), 0.35)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
      }}
    >
      <Clock className="h-4 w-4 opacity-60 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-[0.18em] opacity-60 mb-0.5">
          you started this · {monthLabel} ago
        </div>
        <div className="text-sm font-medium truncate" style={{ color: 'var(--brand-text-primary)' }}>
          {project.title}
        </div>
      </div>
    </button>
  )
}
