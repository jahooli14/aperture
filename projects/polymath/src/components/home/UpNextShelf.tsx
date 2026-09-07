/**
 * UpNextShelf — the user-pinned queue between Keep Going and the drawer.
 *
 * Up to 3 projects, ordered. Tap to open, drag to reorder, X to unpin.
 * Hidden entirely when nothing is pinned — the shelf only exists when the
 * user has staked a claim on what comes next.
 */

import { useState } from 'react'
import { Reorder, motion, AnimatePresence, useDragControls } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GripVertical, X } from 'lucide-react'
import { useUpNextProjects, useProjectStore } from '../../stores/useProjectStore'
import { getTheme } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'
import type { Project } from '../../types'

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'no activity yet'
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

interface ShelfRowProps {
  project: Project
  position: number
  onOpen: (id: string) => void
  onUnpin: (e: React.MouseEvent, id: string) => void
  onDragEnd: () => void
}

/**
 * The drag used to be attached to the whole row with `touch-none`, so any
 * vertical swipe over the row — the normal way to scroll this drawer — got
 * captured as a reorder instead. `dragControls` restricts drag start to the
 * grip handle alone; the row itself keeps native touch scrolling.
 */
function ShelfRow({ project, position, onOpen, onUnpin, onDragEnd }: ShelfRowProps) {
  const theme = getTheme(project.type || 'other', project.title, project.metadata?.tags)
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={project}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        onClick={() => onOpen(project.id)}
        className="rounded-xl flex items-stretch overflow-hidden cursor-pointer transition-all hover:brightness-110"
        style={{
          background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.08), rgba(15,24,41,0.5))`,
          border: `1px solid rgba(${theme.rgb}, 0.25)`,
          boxShadow: `0 2px 12px rgba(0,0,0,0.3)`,
        }}
      >
        {/* Drag handle + position badge — the only part that starts a
            drag, and the only part with touch-action disabled, so
            scrolling the rest of the row still works. */}
        <div
          className="flex flex-col items-center justify-center px-3 py-3 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          style={{
            background: `rgba(${theme.rgb}, 0.12)`,
            borderRight: `1px solid rgba(${theme.rgb}, 0.15)`,
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <span
            className="text-[10px] font-black tracking-widest mb-0.5 aperture-header"
            style={{ color: theme.text }}
          >
            {position}
          </span>
          <GripVertical className="h-3.5 w-3.5 opacity-50" style={{ color: theme.text }} />
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0 py-3 px-3.5">
          <h4 className="text-sm font-bold text-[var(--brand-text-primary)] leading-tight aperture-header line-clamp-1">
            {project.title}
          </h4>
          <p className="text-[11px] text-[var(--brand-text-secondary)] opacity-60 mt-0.5">
            {formatRelativeTime(project.last_active || project.updated_at)}
          </p>
        </div>

        {/* Unpin */}
        <button
          onClick={(e) => onUnpin(e, project.id)}
          aria-label={`Remove ${project.title} from Up Next`}
          className="flex items-center justify-center px-3 flex-shrink-0 transition-colors hover:bg-white/5"
          style={{ color: 'var(--brand-text-muted)' }}
        >
          <X className="h-4 w-4 opacity-60 hover:opacity-100" />
        </button>
      </motion.div>
    </Reorder.Item>
  )
}

export function UpNextShelf() {
  const projects = useUpNextProjects()
  const navigate = useNavigate()
  const setUpNext = useProjectStore(s => s.setUpNext)
  const reorderUpNext = useProjectStore(s => s.reorderUpNext)

  const [localOrder, setLocalOrder] = useState<Project[] | null>(null)
  const displayed = localOrder ?? projects

  if (projects.length === 0) return null

  const handleReorder = (next: Project[]) => {
    setLocalOrder(next)
  }

  const handleReorderEnd = async () => {
    if (!localOrder) return
    const orderedIds = localOrder.map(p => p.id)
    const currentIds = projects.map(p => p.id)
    const changed = orderedIds.length !== currentIds.length ||
      orderedIds.some((id, i) => id !== currentIds[i])
    if (!changed) {
      setLocalOrder(null)
      return
    }
    haptic.light()
    try {
      await reorderUpNext(orderedIds)
    } finally {
      setLocalOrder(null)
    }
  }

  const handleOpen = (id: string) => {
    haptic.light()
    navigate(`/projects/${id}`)
  }

  const handleUnpin = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    haptic.medium()
    await setUpNext(id)
  }

  return (
    <div>
      <h2 className="section-heading">up <span className="accent">next</span></h2>
      <p className="text-[12px] mb-4 -mt-2" style={{ color: 'var(--brand-text-muted)' }}>
        The queue you've committed to. Drag to reorder, ✕ to unpin.
      </p>
      <Reorder.Group
        axis="y"
        values={displayed}
        onReorder={handleReorder}
        className="flex flex-col gap-2.5"
      >
        <AnimatePresence initial={false}>
          {displayed.map((project, i) => (
            <ShelfRow
              key={project.id}
              project={project}
              position={i + 1}
              onOpen={handleOpen}
              onUnpin={handleUnpin}
              onDragEnd={handleReorderEnd}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  )
}
