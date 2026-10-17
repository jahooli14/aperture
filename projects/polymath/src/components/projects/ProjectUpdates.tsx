/**
 * What you've said about this project, newest first: the proof that a note
 * is filed under it. Read from the same place the "Keep in mind" lines and
 * the catch-up read (api/_lib/project-material.ts), so if it's listed here
 * the project knows about it.
 */

import { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import { formatRelativeTime } from '../home/KeepGoingEmpty'
import type { Project } from '../../types'

interface Item { kind: string; text: string; at: string }
const SHOWN = 3

export function ProjectUpdates({ project }: { project: Project }) {
  const [items, setItems] = useState<Item[]>([])
  const [all, setAll] = useState(false)

  useEffect(() => {
    let live = true
    api.get(`utilities?resource=project-updates&project_id=${encodeURIComponent(project.id)}`)
      .then(r => { const u = (r as { updates?: Item[] } | null)?.updates; if (live && Array.isArray(u)) setItems(u) })
      .catch(() => {})
    return () => { live = false }
    // Re-read after an Update lands (it stamps last_active).
  }, [project.id, project.last_active])

  if (items.length === 0) return null
  const shown = all ? items : items.slice(0, SHOWN)

  return (
    <div className="glass-card-subtle p-5 space-y-3">
      <p className="eyebrow">Updates</p>
      <ul className="space-y-3">
        {shown.map((u, i) => (
          <li key={`${u.at}-${i}`}>
            <p className="text-[13px]" style={{ color: 'var(--brand-text-muted)' }}>
              {formatRelativeTime(u.at)}{u.kind === 'session' ? ' · close-out' : ''}
            </p>
            <p className={`text-[15px] leading-snug ${all ? '' : 'line-clamp-2'}`} style={{ color: 'var(--brand-text-secondary)' }}>{u.text}</p>
          </li>
        ))}
      </ul>
      {items.length > SHOWN && (
        <button onClick={() => setAll(a => !a)} className="text-[13px] underline" style={{ color: 'var(--brand-text-secondary)' }}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  )
}
