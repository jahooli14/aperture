/**
 * LineageBreadcrumb — shows a project's ancestry when it was born from a
 * mutation in the drawer digest. Tapping the breadcrumb navigates to the
 * parent. Expanding shows sibling projects (other evolutions of the same
 * lineage root).
 *
 * Invisible when the project has no parent_id — most projects do not.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch, ChevronDown, ChevronRight } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import type { Project } from '../../types'

interface LineageBreadcrumbProps {
  project: Project
}

export function LineageBreadcrumb({ project }: LineageBreadcrumbProps) {
  const { projects } = useProjectStore()
  const [expanded, setExpanded] = useState(false)

  const { parent, siblings } = useMemo(() => {
    const list = (Array.isArray(projects) ? projects : []) as Project[]
    const parent = project.parent_id ? list.find(p => p.id === project.parent_id) || null : null
    const root = project.lineage_root_id || project.parent_id
    const siblings = root
      ? list.filter(p =>
          p.id !== project.id &&
          (p.lineage_root_id === root || p.id === root || p.parent_id === root)
        )
      : []
    return { parent, siblings }
  }, [projects, project])

  if (!project.parent_id) return null

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-text-muted)]">
        <GitBranch className="h-3 w-3" style={{ color: 'var(--brand-primary)' }} />
        <span>evolved from</span>
        {parent ? (
          <Link
            to={`/projects/${parent.id}`}
            className="hover:text-[var(--brand-primary)] transition-colors truncate max-w-[200px]"
          >
            {parent.title}
          </Link>
        ) : (
          <span className="italic opacity-60">(parent archived)</span>
        )}
        {siblings.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="ml-2 flex items-center gap-1 hover:text-[var(--brand-primary)] transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {siblings.length} sibling{siblings.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {expanded && siblings.length > 0 && (
        <div className="mt-2 ml-5 space-y-1">
          {siblings.map(s => (
            <Link
              key={s.id}
              to={`/projects/${s.id}`}
              className="block text-xs text-[var(--brand-text-secondary)] hover:text-[var(--brand-primary)] transition-colors truncate"
            >
              · {s.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
