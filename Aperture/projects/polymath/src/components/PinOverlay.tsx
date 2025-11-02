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
  const [isMaximized, setIsMaximized] = useState(false)

  if (!isPinned) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 z-30 premium-glass-strong border-t"
        style={{
          top: isMaximized ? 0 : '50%',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'var(--premium-surface-base)'
        }}
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
              onClick={() => setIsMaximized(!isMaximized)}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--premium-text-secondary)' }}
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
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
        <div className="overflow-y-auto" style={{ height: isMaximized ? 'calc(100vh - 60px)' : 'calc(50vh - 60px)' }}>
          {pinnedItem?.content}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
