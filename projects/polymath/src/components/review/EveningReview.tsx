/**
 * EveningReview — End-of-day reflection flow
 *
 * Behavioral principles:
 *   Habit Stacking: Anchor the review to the existing evening routine.
 *   Reflection is the flywheel — reviewing what happened today improves
 *   tomorrow's planning (metacognition closes the loop).
 *
 *   Completion Effect: Reviewing done items generates positive affect.
 *   Naming incomplete items reduces the Zeigarnik tension and prepares
 *   the mind to disengage from work (Boundary management theory).
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Trash2, CalendarDays, Archive } from 'lucide-react'
import type { Todo } from '../../stores/useTodoStore'
import { useStreakStore } from '../../hooks/useStreakStore'

interface EveningReviewProps {
  todos: Todo[]
  onUpdateTodo: (id: string, updates: Partial<Todo>) => void
  onAddTodo?: (input: Partial<Todo> & { text: string }) => Promise<Todo>
  onDeleteTodo?: (id: string) => void
  onClose: () => void
}

const STEP_COUNT = 5

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 20 : 6,
            opacity: i <= current ? 1 : 0.2,
          }}
          transition={{ duration: 0.25 }}
          className="h-[6px] rounded-full"
          style={{ background: i < current ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.9)' }}
        />
      ))}
    </div>
  )
}

export function EveningReview({ todos, onUpdateTodo, onAddTodo, onDeleteTodo, onClose }: EveningReviewProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [captureText, setCaptureText] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [captureSent, setCaptureSent] = useState(false)
  const [newTomorrowTask, setNewTomorrowTask] = useState('')

  const { streak } = useStreakStore()

  const today = new Date()
  const todayYMD = today.toISOString().split('T')[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowYMD = tomorrow.toISOString().split('T')[0]
  const tomorrowDayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' })

  const todayCompleted = todos.filter(t =>
    t.done && !t.deleted_at && t.completed_at?.startsWith(todayYMD)
  )

  const todayIncomplete = todos.filter(t =>
    !t.done && !t.deleted_at &&
    (t.scheduled_date === todayYMD || (t.deadline_date === todayYMD))
  )

  const tomorrowTodos = todos.filter(t =>
    !t.done && !t.deleted_at &&
    (t.scheduled_date === tomorrowYMD || t.deadline_date === tomorrowYMD)
  )

  const totalToday = todayCompleted.length + todayIncomplete.length
  const completionRate = totalToday === 0 ? 0 : (todayCompleted.length / totalToday) * 100

  const advance = () => {
    setDirection(1)
    setStep(s => s + 1)
  }

  const handleDoTomorrow = (id: string) => {
    onUpdateTodo(id, { scheduled_date: tomorrowYMD })
  }

  const handleSomeday = (id: string) => {
    onUpdateTodo(id, {
      scheduled_date: undefined,
      deadline_date: undefined,
      tags: [...(todos.find(t => t.id === id)?.tags ?? []).filter(t => t !== 'someday'), 'someday'],
    })
  }

  const handleDeleteCarryover = (id: string) => {
    onDeleteTodo?.(id)
  }

  const handleCapture = async () => {
    if (!captureText.trim()) return
    setCapturing(true)

    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: captureText.trim(),
          type: 'thought',
          source: 'evening-review',
        }),
      })

      if (!res.ok) throw new Error('offline')
      setCaptureSent(true)
    } catch {
      // Offline queue
      try {
        const queue = JSON.parse(localStorage.getItem('memory-queue') ?? '[]')
        queue.push({
          content: captureText.trim(),
          type: 'thought',
          source: 'evening-review',
          queued_at: new Date().toISOString(),
        })
        localStorage.setItem('memory-queue', JSON.stringify(queue))
        setCaptureSent(true)
      } catch { /* silent */ }
    }

    setCapturing(false)
  }

  const handleAddTomorrow = async () => {
    if (!newTomorrowTask.trim() || !onAddTodo) return
    await onAddTodo({ text: newTomorrowTask.trim(), scheduled_date: tomorrowYMD })
    setNewTomorrowTask('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="flex items-center justify-between px-5 pt-12 pb-6">
        <StepIndicator current={step} total={STEP_COUNT} />
        <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {step + 1} / {STEP_COUNT}
        </span>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <AnimatePresence mode="wait" custom={direction}>

          {/* Step 0: How was today? */}
          {step === 0 && (
            <motion.div
              key="step-0"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(139,92,246,0.6)' }}>
                Evening review
              </p>
              <h2 className="text-[30px] font-bold leading-tight mb-6" style={{ color: 'rgba(255,255,255,0.92)' }}>
                How was today?
              </h2>

              <div
                className="flex items-center gap-3 px-4 py-4 rounded-2xl mb-4"
                style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface)' }}
              >
                <div className="flex-1">
                  <p className="text-[14px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    You completed <span className="font-bold" style={{ color: 'rgba(52,211,153,0.9)' }}>{todayCompleted.length}</span> of <span className="font-bold">{totalToday}</span> tasks today
                  </p>
                  {todayIncomplete.length > 0 && (
                    <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {todayIncomplete.length} carry over to tomorrow
                    </p>
                  )}
                </div>
              </div>

              {/* Completion bar */}
              <div
                className="w-full h-2.5 rounded-full overflow-hidden mb-8"
                style={{ background: 'var(--glass-surface)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: completionRate === 100 ? 'rgba(52,211,153,0.7)' : 'rgba(52,211,153,0.5)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>

              <motion.button
                onClick={advance}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(139,92,246,0.15)',
                  color: 'rgba(196,181,253,0.9)',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </motion.div>
          )}

          {/* Step 1: What carried over? */}
          {step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(248,113,113,0.6)' }}>
                Unfinished
              </p>
              <h2 className="text-[26px] font-bold leading-tight mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                What carried over?
              </h2>
              <p className="text-[14px] mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Move each item to where it belongs.
              </p>

              {todayIncomplete.length === 0 ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center py-12 text-center"
                >
                  <span className="text-4xl mb-3">✅</span>
                  <p className="text-[15px] font-semibold" style={{ color: 'rgba(52,211,153,0.9)' }}>
                    All done!
                  </p>
                  <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    You completed everything today.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2 mb-8">
                  <AnimatePresence mode="popLayout">
                    {todayIncomplete.map(todo => (
                      <motion.div
                        key={todo.id}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
                        className="px-4 py-3.5 rounded-2xl"
                        style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface)' }}
                      >
                        <p className="text-[14px] font-medium mb-3 truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {todo.text}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDoTomorrow(todo.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
                            style={{
                              background: 'rgba(59,130,246,0.1)',
                              color: 'rgba(147,197,253,0.85)',
                              border: '1px solid rgba(99,179,237,0.2)',
                            }}
                          >
                            <CalendarDays className="h-3 w-3" />
                            Tomorrow
                          </button>
                          <button
                            onClick={() => handleSomeday(todo.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
                            style={{
                              background: 'var(--glass-surface)',
                              color: 'rgba(255,255,255,0.4)',
                              border: '1px solid var(--glass-surface-hover)',
                            }}
                          >
                            <Archive className="h-3 w-3" />
                            Someday
                          </button>
                          <button
                            onClick={() => handleDeleteCarryover(todo.id)}
                            className="ml-auto p-1.5 rounded-lg transition-all"
                            style={{ color: 'rgba(248,113,113,0.5)' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <button
                onClick={advance}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2"
                style={{
                  background: 'var(--glass-surface)',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* Step 2: Capture what happened */}
          {step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(251,191,36,0.6)' }}>
                Capture
              </p>
              <h2 className="text-[26px] font-bold leading-tight mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                Any thoughts worth capturing?
              </h2>
              <p className="text-[14px] mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>
                An insight, something that surprised you, a win.
              </p>

              {captureSent ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center py-8 text-center mb-8"
                >
                  <span className="text-4xl mb-3">💡</span>
                  <p className="text-[15px] font-semibold" style={{ color: 'rgba(251,191,36,0.9)' }}>
                    Captured.
                  </p>
                  <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Added to your memory.
                  </p>
                </motion.div>
              ) : (
                <div className="mb-8">
                  <textarea
                    value={captureText}
                    onChange={e => setCaptureText(e.target.value)}
                    placeholder="Something I noticed today…"
                    rows={5}
                    className="w-full resize-none rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed outline-none mb-3"
                    style={{
                      background: 'var(--premium-surface-1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.85)',
                      caretColor: 'rgba(251,191,36,0.8)',
                    }}
                  />
                  {captureText.trim() && (
                    <motion.button
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={handleCapture}
                      disabled={capturing}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 rounded-2xl font-semibold text-[14px]"
                      style={{
                        background: 'rgba(251,191,36,0.12)',
                        color: capturing ? 'rgba(251,191,36,0.5)' : 'rgba(251,191,36,0.85)',
                        border: '1px solid rgba(251,191,36,0.2)',
                      }}
                    >
                      {capturing ? 'Saving…' : 'Save to memory'}
                    </motion.button>
                  )}
                </div>
              )}

              <button
                onClick={advance}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2"
                style={{
                  background: 'var(--glass-surface)',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {captureText.trim() && !captureSent ? 'Skip' : 'Continue'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* Step 3: Plan tomorrow */}
          {step === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(99,179,237,0.6)' }}>
                Plan ahead
              </p>
              <h2 className="text-[26px] font-bold leading-tight mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
                Tomorrow,
              </h2>
              <h2 className="text-[26px] font-bold leading-tight mb-6" style={{ color: 'rgba(99,179,237,0.85)' }}>
                {tomorrowDayName}
              </h2>

              {tomorrowTodos.length > 0 && (
                <div className="space-y-2 mb-4">
                  {tomorrowTodos.map(todo => (
                    <div
                      key={todo.id}
                      className="flex items-center gap-3.5 px-4 py-3 rounded-xl"
                      style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface)' }}
                    >
                      <div
                        className="flex-shrink-0 h-[16px] w-[16px] rounded-[5px]"
                        style={{ border: '1.5px solid rgba(255,255,255,0.2)' }}
                      />
                      <span className="flex-1 text-[14px] truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {todo.text}
                      </span>
                      {todo.scheduled_time && (
                        <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {todo.scheduled_time}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {onAddTodo && (
                <div className="flex items-center gap-2 mb-8">
                  <input
                    type="text"
                    value={newTomorrowTask}
                    onChange={e => setNewTomorrowTask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTomorrow()}
                    placeholder="Add for tomorrow…"
                    className="flex-1 px-4 py-3 rounded-xl text-[14px] outline-none"
                    style={{
                      background: 'var(--premium-surface-1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.8)',
                    }}
                  />
                  {newTomorrowTask.trim() && (
                    <button
                      onClick={handleAddTomorrow}
                      className="px-4 py-3 rounded-xl text-[13px] font-semibold flex-shrink-0"
                      style={{
                        background: 'rgba(99,179,237,0.15)',
                        color: 'rgba(147,197,253,0.9)',
                        border: '1px solid rgba(99,179,237,0.25)',
                      }}
                    >
                      Add
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={advance}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(99,179,237,0.12)',
                  color: 'rgba(147,197,253,0.85)',
                  border: '1px solid rgba(99,179,237,0.22)',
                }}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <motion.div
              key="step-4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
                className="flex flex-col items-center text-center pt-8 mb-10"
              >
                <div
                  className="h-20 w-20 rounded-3xl flex items-center justify-center mb-6"
                  style={{
                    background: 'rgba(139,92,246,0.12)',
                    boxShadow: '0 0 40px rgba(139,92,246,0.15)',
                  }}
                >
                  <span className="text-4xl">🌙</span>
                </div>

                <h2 className="text-[28px] font-bold mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  Good work today.
                </h2>
                <p className="text-[16px] mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Rest well.
                </p>

                {streak > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl mb-6"
                    style={{
                      background: 'rgba(251,146,60,0.08)',
                      border: '1px solid rgba(251,146,60,0.2)',
                    }}
                  >
                    <span className="text-[20px]">🔥</span>
                    <div className="text-left">
                      <p className="text-[14px] font-bold" style={{ color: 'rgba(251,146,60,0.9)' }}>
                        {streak} day streak
                      </p>
                      <p className="text-[11px]" style={{ color: 'rgba(251,146,60,0.55)' }}>
                        Keep it going tomorrow
                      </p>
                    </div>
                  </motion.div>
                )}

                <div className="w-full text-left space-y-2 mb-8">
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface)' }}
                  >
                    <span className="text-[18px]">✅</span>
                    <p className="text-[14px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {todayCompleted.length} {todayCompleted.length === 1 ? 'task' : 'tasks'} completed
                    </p>
                  </div>
                  {tomorrowTodos.length > 0 && (
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                      style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface)' }}
                    >
                      <span className="text-[18px]">📅</span>
                      <p className="text-[14px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {tomorrowTodos.length} ready for {tomorrowDayName}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-2xl font-bold text-[16px]"
                style={{
                  background: 'rgba(139,92,246,0.15)',
                  color: 'rgba(196,181,253,0.9)',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}
              >
                Close
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
