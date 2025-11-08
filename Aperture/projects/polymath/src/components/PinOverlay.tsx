/**
 * Pin Overlay Component
 * Displays pinned content in bottom half of screen
 */

import { usePin } from '../contexts/PinContext'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

export function PinOverlay() {
  const { pinnedItem, isPinned, unpinItem } = usePin()
  const [viewState, setViewState] = useState<'half' | 'maximized' | 'minimized'>('half')

  if (!isPinned) return null

  // Minimized state - just a bar at the bottom
  if (viewState === 'minimized') {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 premium-glass-strong border-t cursor-pointer"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'var(--premium-surface-base)'
        }}
        onClick={() => setViewState('half')}
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
        className="fixed inset-x-0 z-50 premium-glass-strong border-t"
        style={{
          top: viewState === 'maximized' ? 0 : '50%',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'var(--premium-surface-base)',
          overscrollBehavior: 'contain'
        }}
        onTouchMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
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
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewState('minimized')}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--premium-text-secondary)' }}
              title="Minimize to bottom"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewState(viewState === 'maximized' ? 'half' : 'maximized')}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--premium-text-secondary)' }}
              title={viewState === 'maximized' ? 'Half screen' : 'Maximize'}
            >
              {viewState === 'maximized' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={unpinItem}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--premium-text-secondary)' }}
              title="Unpin"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="overflow-y-auto"
          style={{
            height: viewState === 'maximized' ? 'calc(100vh - 60px)' : 'calc(50vh - 60px)',
            overscrollBehavior: 'contain'
          }}
        >
          {pinnedItem?.content}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
