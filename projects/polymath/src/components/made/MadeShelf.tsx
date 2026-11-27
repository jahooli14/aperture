/**
 * What you made, on a project's page: every photo, recording and link,
 * newest first, numbered in the order made. The mirror counts days; this
 * keeps the things. Hidden until 20261117_what_you_made.sql is run.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listOutputs, type ProjectOutput } from '../../lib/projectOutputs'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { AddMadeSheet } from './AddMadeSheet'
import { PieceSheet } from './PieceSheet'
import { MadeTile } from './MadeTile'
import type { Project } from '../../types'

const SHOWN = 9

/** What one piece of this project is called, if it repeats ("painting", "mix"). */
export function unitOf(project: Project): string | undefined {
  const unit = (project.metadata as { cycle?: { unit?: unknown } } | undefined)?.cycle?.unit
  return typeof unit === 'string' && unit.trim() ? unit.trim().toLowerCase() : undefined
}

export function MadeShelf({ project, adding, onAddingChange }: { project: Project; adding?: boolean; onAddingChange?: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { isOnline } = useOnlineStatus()
  const [items, setItems] = useState<ProjectOutput[]>([])
  const [available, setAvailable] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState<ProjectOutput | null>(null)
  const [localAdding, setLocalAdding] = useState(false)
  const isAdding = adding ?? localAdding
  const setAdding = onAddingChange ?? setLocalAdding
  const unit = unitOf(project)

  useEffect(() => {
    let cancelled = false
    listOutputs(project.id)
      .then(r => { if (!cancelled) { setItems(r.items); setAvailable(r.available) } })
      .catch(() => { /* a failed read shows nothing, not an error card */ })
    return () => { cancelled = true }
  }, [project.id])

  if (!available) return null

  // New ones change everyone's number, so re-read after any change.
  const reload = () => listOutputs(project.id).then(r => setItems(r.items)).catch(() => {})
  const shown = showAll ? items : items.slice(0, SHOWN)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="eyebrow">what you made</p>
        {isOnline && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[13px] min-h-[40px]" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
            <Plus size={14} /> {unit ? `add a ${unit}` : 'add'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="glass-card-subtle rounded-xl p-4 text-[13px] leading-relaxed" style={{ color: 'var(--brand-text-muted)' }}>
          {project.status === 'completed'
            ? 'Finished. Add a photo of it so it is kept.'
            : <>Photos, recordings or links of what came out of it. {unit ? `Each ${unit} gets a number.` : 'Old ones too: the date comes from the photo.'}</>}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {shown.map(item => <MadeTile key={item.id} item={item} showNumber={items.length > 1} onOpen={() => setOpen(item)} />)}
        </div>
      )}

      <div className="flex items-center gap-4">
        {items.length > shown.length && (
          <button className="text-[13px] min-h-[40px]" style={{ color: 'var(--brand-text-secondary)' }} onClick={() => setShowAll(true)}>
            Show all {items.length}
          </button>
        )}
        {items.length > 0 && (
          <button className="text-[13px] min-h-[40px]" style={{ color: 'var(--brand-text-secondary)' }} onClick={() => navigate('/made')}>
            Everything you've made →
          </button>
        )}
      </div>

      {isAdding && (
        <AddMadeSheet projectId={project.id} projectTitle={project.title} unit={unit} onClose={() => setAdding(false)} onAdded={() => { void reload() }} />
      )}
      {open && (
        <PieceSheet
          item={open} total={items.length}
          onChanged={() => { void reload() }}
          onRemoved={id => { setItems(list => list.filter(i => i.id !== id)); void reload() }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}
