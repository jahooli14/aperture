/**
 * UpNextMini — two-up "soon" row on the home. Pinned projects from the
 * Up Next queue, rendered with the ghost variant — outline-only cards
 * that read as "further away" than the recent group above.
 *
 * No section heading — group identity comes from the cards' lighter
 * material and the seam hairline above.
 */

import { useUpNextProjects } from '../../stores/useProjectStore'
import { ProjectMiniCard } from './ProjectMiniCard'

export function UpNextMini() {
  const projects = useUpNextProjects()
  if (projects.length === 0) return null

  const shown = projects.slice(0, 2)

  return (
    <div className="grid grid-cols-2 gap-3 items-stretch">
      {shown.map((p, i) => (
        <ProjectMiniCard
          key={p.id}
          project={p}
          variant="ghost"
          meta={`#${i + 1} in queue`}
        />
      ))}
    </div>
  )
}
