import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown, Zap, GitBranch, CornerDownRight, CheckSquare, X } from 'lucide-react'
import type { SteeringMove, SteeringResult } from '../../../api/steer'

const MOVE_CONFIG: Record<
  SteeringMove,
  { label: string; icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  DEEPEN: {
    label: 'Go deeper',
    icon: <ArrowDown className="w-3 h-3" />,
    color: 'text-blue-300',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/25',
  },
  COLLIDE: {
    label: 'Contradiction',
    icon: <Zap className="w-3 h-3" />,
    color: 'text-amber-300',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/25',
  },
  SURFACE: {
    label: 'Resurface',
    icon: <GitBranch className="w-3 h-3" />,
    color: 'text-violet-300',
    bg: 'bg-violet-500/15',
    border: 'border-violet-500/25',
  },
  REDIRECT: {
    label: 'Pattern',
    icon: <CornerDownRight className="w-3 h-3" />,
    color: 'text-rose-300',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/25',
  },
  COMMIT: {
    label: 'Make something',
    icon: <CheckSquare className="w-3 h-3" />,
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/25',
  },
}

export function SteeringCard() {
  const [steering, setSteering] = useState<SteeringResult | null>(null)
  const [visible, setVisible] = useState(false)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleSteering = (e: CustomEvent<SteeringResult>) => {
      setSteering(e.detail)
      setVisible(true)

      // Auto-dismiss after 10s — longer than ExtractionSummary since there's content to read
      const t = setTimeout(() => setVisible(false), 10000)
      setTimer(t)
    }

    window.addEventListener('memory-steered', handleSteering as EventListener)
    return () => window.removeEventListener('memory-steered', handleSteering as EventListener)
  }, [])

  const dismiss = () => {
    if (timer) clearTimeout(timer)
    setVisible(false)
  }

  if (!steering) return null

  const config = MOVE_CONFIG[steering.move]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.96 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="fixed bottom-36 left-4 right-4 z-50 max-w-sm mx-auto"
        >
          <div
            className={`relative rounded-2xl border backdrop-blur-xl shadow-2xl px-4 py-3.5 ${config.border} bg-[#13182e]/95`}
          >
            {/* Move badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${config.color} ${config.bg}`}
                >
                  {config.icon}
                  {config.label}
                </span>
              </div>
              <button
                onClick={dismiss}
                className="text-white/30 hover:text-white/60 transition-colors mt-0.5 flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Message */}
            <p className="text-sm text-white/90 leading-snug font-medium pr-2">
              {steering.message}
            </p>

            {/* Evidence — subtle, below the fold */}
            {steering.evidence && (
              <p className="text-[11px] text-white/35 mt-1.5 leading-relaxed">
                {steering.evidence}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
