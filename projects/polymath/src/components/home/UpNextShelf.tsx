/**
 * UpNextShelf — the user-pinned queue between Keep Going and the drawer.
 *
 * Up to 3 projects, ordered. Tap to open, drag to reorder, X to unpin.
 * Hidden entirely when nothing is pinned — the shelf only exists when the
 * user has staked a claim on what comes next.
 */

import { useState } from 'react'
import { Reorder, motion, AnimatePresence } from 'framer-motion'
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
      <h2 className="section-header">up <span>next</span></h2>
      <Reorder.Group
        axis="y"
        values={displayed}
        onReorder={handleReorder}
        className="flex flex-col gap-2.5"
      >
        <AnimatePresence initial={false}>
          {displayed.map((project, i) => {
            const theme = getTheme(project.type || 'other', project.title)
            const position = i + 1
            return (
              <Reorder.Item
                key={project.id}
                value={project}
                onDragEnd={handleReorderEnd}
                whileDrag={{ scale: 1.02, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
                className="touch-none"
              >
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleOpen(project.id)}
                  className="rounded-xl flex items-stretch overflow-hidden cursor-pointer transition-all hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.08), rgba(15,24,41,0.5))`,
                    border: `1px solid rgba(${theme.rgb}, 0.25)`,
                    boxShadow: `0 2px 12px rgba(0,0,0,0.3)`,
                  }}
                >
                  {/* Drag handle + position badge */}
                  <div
                    className="flex flex-col items-center justify-center px-3 py-3 flex-shrink-0 cursor-grab active:cursor-grabbing"
                    style={{
                      background: `rgba(${theme.rgb}, 0.12)`,
                      borderRight: `1px solid rgba(${theme.rgb}, 0.15)`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
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
                    onClick={(e) => handleUnpin(e, project.id)}
                    aria-label={`Remove ${project.title} from Up Next`}
                    className="flex items-center justify-center px-3 flex-shrink-0 transition-colors hover:bg-white/5"
                    style={{ color: 'var(--brand-text-muted)' }}
                  >
                    <X className="h-4 w-4 opacity-60 hover:opacity-100" />
                  </button>
                </motion.div>
              </Reorder.Item>
            )
          })}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  )
}
