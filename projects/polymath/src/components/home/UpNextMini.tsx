/**
 * UpNextMini — the two-up "up next" row used on the home page. Pulls
 * the first two pinned projects from the Up Next queue and renders
 * them as ProjectMiniCards side-by-side. Hidden when no project is
 * pinned. The full Up Next list (with reorder + unpin) lives on the
 * Projects page via UpNextShelf.
 */

import { useUpNextProjects } from '../../stores/useProjectStore'
import { ProjectMiniCard } from './ProjectMiniCard'

export function UpNextMini() {
  const projects = useUpNextProjects()
  if (projects.length === 0) return null

  const shown = projects.slice(0, 2)

  return (
    <div>
      <h2 className="section-header">up <span>next</span></h2>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((p, i) => (
          <ProjectMiniCard
            key={p.id}
            project={p}
            meta={`#${i + 1} in queue`}
          />
        ))}
      </div>
    </div>
  )
}
