/**
 * FirstConnectionCelebration — Early win moment
 *
 * Listens for the 'memory-extracted' event. When a new memory has connections > 0
 * and the user hasn't seen their first connection yet, show a celebration overlay.
 *
 * This is the critical "aha moment" — proving that Polymath does something
 * with your data, not just stores it.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, X } from 'lucide-react'
import { useJourneyStore } from '../../stores/useJourneyStore'

interface ExtractionDetail {
  memoryId: string
  connections: number
  bridgeInsight: string | null
}

export function FirstConnectionCelebration() {
  const { firstConnectionSeen, markFirstConnectionSeen, onboardingCompletedAt, completeChallenge } = useJourneyStore()
  const [visible, setVisible] = useState(false)
  const [connectionCount, setConnectionCount] = useState(0)
  const [bridgeInsight, setBridgeInsight] = useState<string | null>(null)

  useEffect(() => {
    // Only listen if user is in the journey and hasn't seen first connection
    if (firstConnectionSeen || !onboardingCompletedAt) return

    const handler = (e: CustomEvent<ExtractionDetail>) => {
      const { connections, bridgeInsight } = e.detail
      if (connections > 0) {
        setConnectionCount(connections)
        setBridgeInsight(bridgeInsight)
        setVisible(true)
        markFirstConnectionSeen()
        // Also complete the Day 3 challenge
        completeChallenge(3)
      }
    }

    window.addEventListener('memory-extracted', handler as EventListener)
    return () => window.removeEventListener('memory-extracted', handler as EventListener)
  }, [firstConnectionSeen, onboardingCompletedAt])

  const handleDismiss = () => {
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="fixed bottom-24 left-4 right-4 z-50 md:left-1/2 md:-translate-x-1/2 md:w-auto md:max-w-md"
        >
          <div
            className="relative px-5 py-4 rounded-2xl shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(99,179,237,0.15), rgba(168,85,247,0.1))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(99,179,237,0.25)',
            }}
          >
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 h-6 w-6 rounded-full flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.1)]"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3.5">
              {/* Animated icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,179,237,0.2), rgba(168,85,247,0.15))',
                  border: '1px solid rgba(99,179,237,0.3)',
                }}
              >
                <Link2 className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
              </motion.div>

              <div className="flex-1 min-w-0 pr-4">
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm font-semibold mb-1"
                  style={{ color: 'var(--brand-text-primary)' }}
                >
                  Your ideas are connecting.
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.8 }}
                >
                  {bridgeInsight
                    ? bridgeInsight
                    : `Polymath found ${connectionCount} ${connectionCount === 1 ? 'connection' : 'connections'} to your existing thoughts. The more you add, the more it finds.`
                  }
                </motion.p>
              </div>
            </div>

            {/* Subtle pulse ring */}
            <motion.div
              className="absolute -inset-px rounded-2xl pointer-events-none"
              style={{ border: '1px solid rgba(99,179,237,0.3)' }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: 2 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
