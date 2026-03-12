import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown, Zap, GitBranch, CornerDownRight, CheckSquare, X, Pin, Plus } from 'lucide-react'
import type { SteeringMove, SteeringResult } from '../../../api/memories'
import { useTodoStore } from '../../stores/useTodoStore'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { haptic } from '../../utils/haptics'

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
  const [sourceMemoryId, setSourceMemoryId] = useState<string | null>(null)

  const addTodo = useTodoStore((state) => state.addTodo)
  const pinMemory = useMemoryStore((state) => state.pinMemory)
  const { addToast } = useToast()

  useEffect(() => {
    const handleSteering = (e: CustomEvent<SteeringResult & { memory_id?: string }>) => {
      setSteering(e.detail)
      setSourceMemoryId(e.detail.memory_id ?? null)
      setVisible(true)
      // No auto-dismiss — user dismisses manually or card persists until next capture
    }

    window.addEventListener('memory-steered', handleSteering as EventListener)
    return () => window.removeEventListener('memory-steered', handleSteering as EventListener)
  }, [])

  const dismiss = () => {
    setVisible(false)
  }

  const handleCreateTodo = useCallback(async () => {
    if (!steering) return
    await addTodo({
      text: steering.message,
      source_memory_id: sourceMemoryId ?? undefined,
      tags: ['from-steering'],
    })
    haptic.success()
    addToast({
      title: 'Todo created',
      description: 'Action item added to inbox',
      variant: 'success',
    })
  }, [steering, sourceMemoryId, addTodo, addToast])

  const handlePinThought = useCallback(async () => {
    if (!sourceMemoryId) return
    await pinMemory(sourceMemoryId)
    haptic.success()
    addToast({
      title: 'Thought pinned',
      description: 'Added to your pinned thoughts',
      variant: 'success',
    })
  }, [sourceMemoryId, pinMemory, addToast])

  if (!steering) return null

  const config = MOVE_CONFIG[steering.move]
  const showCreateTodo = steering.move === 'COMMIT'
  const showPinThought = (steering.move === 'DEEPEN' || steering.move === 'SURFACE') && sourceMemoryId

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

            {/* Action buttons — contextual to the steering move */}
            {(showCreateTodo || showPinThought) && (
              <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-white/5">
                {showCreateTodo && (
                  <button
                    onClick={handleCreateTodo}
                    className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-emerald-500/15 text-emerald-300/80 hover:text-emerald-300"
                  >
                    <Plus className="w-3 h-3" />
                    Create Todo
                  </button>
                )}
                {showPinThought && (
                  <button
                    onClick={handlePinThought}
                    className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-amber-500/15 text-amber-300/80 hover:text-amber-300"
                  >
                    <Pin className="w-3 h-3" />
                    Pin Thought
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
