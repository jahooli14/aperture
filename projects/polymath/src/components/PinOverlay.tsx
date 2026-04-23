/**
 * Pin Overlay Component
 * Displays pinned content in bottom half of screen
 */

import { usePin } from '../contexts/PinContext'
import { X } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue } from 'framer-motion'
import { useEffect, useState } from 'react'

export function PinOverlay() {
  const { pinnedItem, isPinned, unpinItem } = usePin()
  const [viewState, setViewState] = useState<'half' | 'maximized' | 'minimized'>('half')
  const dragY = useMotionValue(0)

  // Signal pinned state on <body> so main content can reserve room to scroll
  // past the overlay. Without this, the bottom half of navigated pages is
  // trapped behind the overlay.
  useEffect(() => {
    if (!isPinned) return
    document.body.dataset.pinned = viewState
    return () => {
      delete document.body.dataset.pinned
    }
  }, [isPinned, viewState])

  const handleDragEnd = (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    const offsetY = info.offset.y
    const velocityY = info.velocity.y

    // Swipe down = shrink
    if (offsetY > 50 || velocityY > 500) {
      if (viewState === 'maximized') setViewState('half')
      else if (viewState === 'half') setViewState('minimized')
    }
    // Swipe up = expand
    else if (offsetY < -50 || velocityY < -500) {
      if (viewState === 'minimized') setViewState('half')
      else if (viewState === 'half') setViewState('maximized')
    }

    dragY.set(0)
  }

  if (!isPinned) return null

  const handleUnpin = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    unpinItem()
  }

  // Minimized state - just a bar at the bottom
  if (viewState === 'minimized') {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 z-30 premium-glass-strong border-t"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'var(--brand-bg)'
        }}
      >
        {/* Drag handle - only this area is draggable */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="flex items-center justify-center py-2 cursor-grab active:cursor-grabbing"
          aria-label="Drag to expand or dismiss"
        >
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </motion.div>

        {/* Title + unpin row (not draggable) */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
              backgroundColor: 'rgba(var(--brand-primary-rgb), 0.2)',
              color: 'var(--brand-primary)'
            }}>
              Pinned
            </span>
            <button
              onClick={() => setViewState('half')}
              className="font-semibold truncate text-left flex-1 min-w-0"
              style={{ color: 'var(--brand-primary)' }}
              title="Expand"
            >
              {pinnedItem?.title}
            </button>
          </div>
          <button
            onClick={handleUnpin}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.1)]"
            style={{ color: 'var(--brand-primary)' }}
            title="Unpin"
            aria-label="Unpin"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    )
  }

  // Full or half view
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 z-30 premium-glass-strong border-t flex flex-col"
        style={{
          top: viewState === 'maximized' ? '5%' : '50%',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'var(--brand-bg)',
          overscrollBehavior: 'contain'
        }}
      >
        {/* Drag handle bar - isolated from buttons */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="flex items-center justify-center py-2 cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Drag to resize or dismiss"
        >
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </motion.div>

        {/* Header row - not draggable, so buttons always receive clicks */}
        <div
          className="flex items-center justify-between px-4 pb-3 border-b shrink-0"
          style={{ borderColor: 'var(--glass-surface)' }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
              backgroundColor: 'rgba(var(--brand-primary-rgb), 0.2)',
              color: 'var(--brand-primary)'
            }}>
              Pinned
            </span>
            <h3 className="font-semibold truncate" style={{ color: 'var(--brand-primary)' }}>
              {pinnedItem?.title}
            </h3>
          </div>

          <button
            onClick={handleUnpin}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.1)]"
            style={{ color: 'var(--brand-primary)' }}
            title="Unpin"
            aria-label="Unpin"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div
          className="flex flex-col flex-1 min-h-0 overflow-y-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          {pinnedItem?.content}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
