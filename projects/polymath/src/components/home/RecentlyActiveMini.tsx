/**
 * RecentlyActiveMini — the two-up "recently active" row used on the
 * home page. Pulls the two most-recently-touched active projects that
 * aren't the priority and aren't in Up Next. Hidden when there's
 * nothing to show.
 */

import { useRecentNonPriorityProjects } from '../../stores/useProjectStore'
import { ProjectMiniCard } from './ProjectMiniCard'

function relative(dateStr?: string): string {
  if (!dateStr) return 'not started yet'
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function RecentlyActiveMini() {
  const projects = useRecentNonPriorityProjects(2)
  if (projects.length === 0) return null

  return (
    <div>
      <h2 className="section-header">recently <span>active</span></h2>
      <div className="grid grid-cols-2 gap-3">
        {projects.map((p) => (
          <ProjectMiniCard
            key={p.id}
            project={p}
            meta={relative(p.last_active || p.updated_at)}
          />
        ))}
      </div>
    </div>
  )
}
