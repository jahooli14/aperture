/**
 * What you've said about this project, newest first: the proof that a note
 * is filed under it. Read from the same place the threads and the catch-up
 * read (api/_lib/project-material.ts).
 *
 * Folded away by default: the sit-down card above already says where you
 * are and what you've said since, so this is the history, not the headline.
 */

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { formatRelativeTime } from '../home/KeepGoingEmpty'
import { spokenPart } from '../../lib/projectBrief'
import type { Project } from '../../types'

export interface UpdateItem { kind: string; text: string; at: string }

export function useProjectUpdates(project: Pick<Project, 'id' | 'last_active'> | null | undefined): UpdateItem[] {
  const [items, setItems] = useState<UpdateItem[]>([])
  useEffect(() => {
    if (!project?.id) return
    let live = true
    api.get(`utilities?resource=project-updates&project_id=${encodeURIComponent(project.id)}`)
      .then(r => { const u = (r as { updates?: UpdateItem[] } | null)?.updates; if (live && Array.isArray(u)) setItems(u) })
      .catch(() => {})
    return () => { live = false }
    // Re-read after an Update lands (it stamps last_active).
  }, [project?.id, project?.last_active])
  return items
}

export function ProjectUpdates({ items }: { items: UpdateItem[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between min-h-[44px]"
      >
        <span className="eyebrow">Everything you've said about it · {items.length}</span>
        <ChevronDown className="h-4 w-4 transition-transform" style={{ color: 'var(--brand-text-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <ul className="space-y-3">
          {items.map((u, i) => (
            <li key={`${u.at}-${i}`}>
              <p className="text-[13px]" style={{ color: 'var(--brand-text-muted)' }}>
                {formatRelativeTime(u.at)}{u.kind === 'session' ? ' · close-out' : ''}
              </p>
              <p className="text-[15px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>{spokenPart(u.text)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
