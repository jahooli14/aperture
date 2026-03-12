/**
 * FocusMode  Progressive disclosure + cognitive load reduction
 *
 * Principles implemented:
 *   Progressive Disclosure (Miller's Law): When visible decisions drop to ONE 
 *   "should I do this task?"  the cognitive cost of acting falls below avoidance.
 *   The path of least resistance becomes the task itself.
 *
 *   Activation Energy (2-min rule): The real barrier is starting. A 2-minute
 *   commitment dissolves procrastination. Once started, Zeigarnik + sunk cost
 *   carry the session forward.
 *
 *   Variable Reward: Completion animations vary  dopamine anticipation sustains
 *   engagement across the session.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, ChevronRight, Zap, Timer, Pause, Play } from 'lucide-react'
import type { Todo } from '../../stores/useTodoStore'
import { formatMinutes } from '../../lib/todoNLP'

interface FocusModeProps {
  todos: Todo[]
  onComplete: (id: string) => void
  onClose: () => void
}

// Variable celebrations  unpredictable reward = sustained dopamine
const CELEBRATIONS = [
  'Done.',
  'Cleared.',
  'That\'s it.',
  'One less thing.',
  'Knocked out.',
  'Building momentum.',
  'Keep going.',
  'On a roll.',
  'Clean.',
]

function randomCelebration() {
  return CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function FocusMode({ todos, onComplete, onClose }: FocusModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [celebration, setCelebration] = useState('')
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerDuration, setTimerDuration] = useState(2 * 60)  // 2 min default
  const [direction, setDirection] = useState(1)

  const current = todos[currentIndex]
  const remaining = todos.length - currentIndex
  const progress = currentIndex / todos.length

  // Timer tick
  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(() => {
      setTimerSeconds(s => {
        if (s >= timerDuration) {
          setTimerRunning(false)
          return 0
        }
        return s + 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning, timerDuration])

  const handleComplete = useCallback(async () => {
    if (completing || !current) return
    setCompleting(true)
    setCelebration(randomCelebration())

    await new Promise(r => setTimeout(r, 900))
    onComplete(current.id)

    await new Promise(r => setTimeout(r, 200))
    setDirection(1)
    if (currentIndex >= todos.length - 1) {
      // All done
      setCurrentIndex(todos.length)
    } else {
      setCurrentIndex(i => i + 1)
    }
    setCompleting(false)
    setTimerRunning(false)
    setTimerSeconds(0)
  }, [completing, current, currentIndex, todos.length, onComplete])

  const handleSkip = () => {
    if (!current) return
    setDirection(1)
    setCurrentIndex(i => Math.min(i + 1, todos.length))
    setTimerRunning(false)
    setTimerSeconds(0)
  }

  const toggleTimer = () => {
    if (timerRunning) {
      setTimerRunning(false)
    } else {
      // Always reset to 2-min when starting fresh via the primary button
      setTimerDuration(2 * 60)
      setTimerSeconds(0)
      setTimerRunning(true)
    }
  }

  const timerProgress = timerSeconds / timerDuration

  // All done state
  if (!current || currentIndex >= todos.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        style={{ background: '#0a1020' }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center px-8"
        >
          <div
            className="mx-auto mb-6 h-20 w-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.15)', boxShadow: '0 0 40px rgba(52,211,153,0.2)' }}
          >
            <Check className="h-9 w-9" style={{ color: "var(--brand-primary)" }} strokeWidth={2.5} />
          </div>
          <p className="text-2xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
            Session done.
          </p>
          <p className="text-[14px] mb-10" style={{ color: "var(--brand-primary)" }}>
            {todos.length} {todos.length === 1 ? 'task' : 'tasks'} cleared.
          </p>
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-2xl font-semibold text-[15px] transition-all"
            style={{
              background: 'var(--glass-surface-hover)',
              color: "var(--brand-text-secondary)",
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Back to list
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#0a1020' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <button
          onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-xl transition-all"
          style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {todos.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentIndex ? 20 : 6,
                height: 6,
                background: i < currentIndex
                  ? 'rgba(52,211,153,0.6)'
                  : i === currentIndex
                    ? 'rgba(147,197,253,0.9)'
                    : 'var(--glass-surface-hover)',
              }}
            />
          ))}
        </div>

        <span className="text-[13px] font-medium" style={{ color: "var(--brand-primary)" }}>
          {remaining} left
        </span>
      </div>

      {/* Timer strip  shown when active */}
      <AnimatePresence>
        {(timerRunning || timerSeconds > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-5"
          >
            <div className="flex items-center gap-3 py-2">
              <div
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--glass-surface)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: timerProgress > 0.8
                      ? 'rgba(248,113,113,0.7)'
                      : 'rgba(59,130,246,0.6)',
                    width: `${timerProgress * 100}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span
                className="text-[13px] font-mono font-semibold tabular-nums"
                style={{ color: timerProgress > 0.8 ? 'rgba(248,113,113,0.9)' : 'rgba(255,255,255,0.45)' }}
              >
                {formatTimer(timerSeconds)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main task area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {completing ? (
            <motion.div
              key="celebrating"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.05, opacity: 0 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="mx-auto mb-5 h-16 w-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(52,211,153,0.2)' }}
              >
                <Check className="h-8 w-8" style={{ color: "var(--brand-primary)" }} strokeWidth={3} />
              </motion.div>
              <p className="text-xl font-semibold" style={{ color: "var(--brand-primary)" }}>
                {celebration}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -30 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-full max-w-sm"
            >
              {/* Priority indicator */}
              {current.priority === 3 && (
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(248,113,113,0.8)' }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--brand-primary)" }}>
                    High priority
                  </span>
                </div>
              )}

              {/* Task text  the one thing you need to see */}
              <h2
                className="text-[28px] font-bold leading-tight mb-4"
                style={{ color: "var(--brand-primary)" }}
              >
                {current.text}
              </h2>

              {/* Notes */}
              {current.notes && (
                <p className="text-[14px] leading-relaxed mb-4" style={{ color: "var(--brand-primary)" }}>
                  {current.notes}
                </p>
              )}

              {/* Metadata chips */}
              <div className="flex flex-wrap gap-2">
                {current.estimated_minutes && (
                  <span
                    className="flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-lg"
                    style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                  >
                    <Timer className="h-3 w-3" />
                    {formatMinutes(current.estimated_minutes)}
                  </span>
                )}
                {current.scheduled_time && (
                  <span
                    className="text-[12px] px-2.5 py-1 rounded-lg"
                    style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                  >
                    {current.scheduled_time}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action area */}
      <div className="px-5 pb-12 space-y-3">
        {/* Timer toggle row */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTimer}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
            style={{
              background: timerRunning ? 'rgba(59,130,246,0.18)' : 'var(--glass-surface)',
              color: timerRunning ? 'rgba(147,197,253,0.9)' : 'rgba(255,255,255,0.3)',
              border: `1px solid ${timerRunning ? 'rgba(99,179,237,0.3)' : 'var(--glass-surface-hover)'}`,
            }}
          >
            {timerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {timerRunning ? 'Pause' : 'Start 2 min'}
          </button>
          {!timerRunning && timerSeconds === 0 && (
            <button
              onClick={() => { setTimerDuration(25 * 60); setTimerSeconds(0); setTimerRunning(true) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: 'var(--glass-surface)',
                color: "var(--brand-text-secondary)",
                border: '1px solid var(--glass-surface)',
              }}
            >
              25 min
            </button>
          )}
        </div>

        {/* Done  the primary action, unavoidable */}
        <motion.button
          onClick={handleComplete}
          disabled={completing}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-2xl font-bold text-[17px] flex items-center justify-center gap-2 transition-all"
          style={{
            background: completing
              ? 'rgba(52,211,153,0.25)'
              : 'rgba(52,211,153,0.18)',
            color: "var(--brand-text-secondary)",
            border: '1px solid rgba(52,211,153,0.3)',
            boxShadow: '0 0 20px rgba(52,211,153,0.1)',
          }}
        >
          <Check className="h-5 w-5" strokeWidth={2.5} />
          Done
        </motion.button>

        {/* Skip  secondary, less prominent */}
        {currentIndex < todos.length - 1 && (
          <button
            onClick={handleSkip}
            className="w-full py-3 rounded-2xl font-medium text-[14px] flex items-center justify-center gap-1.5 transition-all"
            style={{
              background: 'transparent',
              color: "var(--brand-text-secondary)",
            }}
          >
            Skip for now
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
