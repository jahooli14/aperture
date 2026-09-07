/**
 * UpNextShelf — the user-pinned queue between Keep Going and the drawer.
 *
 * Up to 3 projects, ordered. Tap to open, drag to reorder, X to unpin.
 * Hidden entirely when nothing is pinned — the shelf only exists when the
 * user has staked a claim on what comes next.
 */

import { useRef, useState } from 'react'
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

/** How long to hold before a touch becomes a drag. */
const HOLD_MS = 260
/** Move further than this before the hold fires and it was a scroll. */
const MOVE_TOLERANCE_PX = 8

/**
 * Hold to reorder, swipe to scroll.
 *
 * Touching the row used to start a drag immediately — first anywhere on the
 * row, then on the grip, which is a full-height column down the card's left
 * edge and therefore exactly where a thumb lands when scrolling. Either way
 * a scroll picked the card up. A drag now has to be asked for: press and
 * hold, and any real movement before the hold completes cancels it and
 * leaves the scroll alone.
 */
function ShelfRow({ project, position, onOpen, onUnpin, onDragEnd }: ShelfRowProps) {
  const theme = getTheme(project.type || 'other', project.title, project.metadata?.tags)
  const dragControls = useDragControls()
  const holdTimer = useRef<number | null>(null)
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)
  const [armed, setArmed] = useState(false)

  const cancelHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    pressOrigin.current = null
  }

  const beginHold = (e: React.PointerEvent) => {
    pressOrigin.current = { x: e.clientX, y: e.clientY }
    const nativeEvent = e.nativeEvent
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      haptic.light()
      setArmed(true)
      dragControls.start(nativeEvent)
    }, HOLD_MS)
  }

  const maybeCancelHold = (e: React.PointerEvent) => {
    if (holdTimer.current === null || !pressOrigin.current) return
    const movedFar =
      Math.abs(e.clientX - pressOrigin.current.x) > MOVE_TOLERANCE_PX ||
      Math.abs(e.clientY - pressOrigin.current.y) > MOVE_TOLERANCE_PX
    if (movedFar) cancelHold()
  }

  return (
    <Reorder.Item
      value={project}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={() => { setArmed(false); cancelHold(); onDragEnd() }}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
      // Only once the hold has fired does this row stop being scrollable
      // surface and become the thing being dragged.
      style={{ touchAction: armed ? 'none' : 'pan-y' }}
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        onClick={() => { if (!armed) onOpen(project.id) }}
        onPointerDown={beginHold}
        onPointerMove={maybeCancelHold}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        className="rounded-xl flex items-stretch overflow-hidden cursor-pointer transition-all hover:brightness-110"
        style={{
          background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.08), rgba(15,24,41,0.5))`,
          border: `1px solid rgba(${theme.rgb}, 0.25)`,
          boxShadow: `0 2px 12px rgba(0,0,0,0.3)`,
        }}
      >
        {/* Position badge and grip. The grip says the row can be moved; it
            no longer grabs the touch itself, because as a full-height column
            on the left edge it caught scrolls aimed at the page. */}
        <div
          className="flex flex-col items-center justify-center px-3 py-3 flex-shrink-0 cursor-grab active:cursor-grabbing"
          style={{
            background: `rgba(${theme.rgb}, 0.12)`,
            borderRight: `1px solid rgba(${theme.rgb}, 0.15)`,
          }}
          onClick={(e) => e.stopPropagation()}
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
        The queue you've committed to. Hold to reorder, ✕ to unpin.
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
