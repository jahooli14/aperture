/**
 * Pin Overlay Component
 * Displays pinned content in bottom half of screen
 */

import { usePin } from '../contexts/PinContext'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { useState } from 'react'

export function PinOverlay() {
  const { pinnedItem, isPinned, unpinItem } = usePin()
  const [viewState, setViewState] = useState<'half' | 'maximized' | 'minimized'>('half')
  const dragY = useMotionValue(0)

  const handleDragEnd = (_: any, info: any) => {
    const offsetY = info.offset.y
    const velocityY = info.velocity.y

    // Swipe down = minimize (if offset > 50 or velocity > 500)
    if (offsetY > 50 || velocityY > 500) {
      if (viewState === 'maximized') {
        setViewState('half')
      } else if (viewState === 'half') {
        setViewState('minimized')
      }
    }
    // Swipe up = maximize (if offset < -50 or velocity < -500)
    else if (offsetY < -50 || velocityY < -500) {
      if (viewState === 'minimized') {
        setViewState('half')
      } else if (viewState === 'half') {
        setViewState('maximized')
      }
    }

    // Reset drag position
    dragY.set(0)
  }

  if (!isPinned) return null

  // Minimized state - just a bar at the bottom (draggable to swipe back up)
  if (viewState === 'minimized') {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="fixed inset-x-0 z-30 premium-glass-strong border-t cursor-grab active:cursor-grabbing"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'var(--premium-surface-base)'
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: 'var(--premium-blue)'
            }}>
              Pinned
            </span>
            <h3 className="font-semibold truncate" style={{ color: 'var(--premium-text-primary)' }}>
              {pinnedItem?.title}
            </h3>
            <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              (swipe ↕)
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              unpinItem()
            }}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--premium-text-secondary)' }}
            title="Unpin"
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
        className="fixed inset-x-0 z-30 premium-glass-strong border-t"
        style={{
          top: viewState === 'maximized' ? 0 : '50%',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'var(--premium-surface-base)',
          overscrollBehavior: 'contain'
        }}
        onTouchMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header - Draggable for swipe gestures */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="flex items-center justify-between px-4 py-3 border-b cursor-grab active:cursor-grabbing"
          style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: 'var(--premium-blue)'
            }}>
              Pinned
            </span>
            <h3 className="font-semibold truncate" style={{ color: 'var(--premium-text-primary)' }}>
              {pinnedItem?.title}
            </h3>
            <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              (swipe ↕)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={unpinItem}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--premium-text-secondary)' }}
              title="Unpin"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>

        {/* Content */}
        <div
          className="overflow-y-auto"
          style={{
            height: 'calc(100% - 60px)',
            overscrollBehavior: 'contain'
          }}
        >
          {pinnedItem?.content}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
