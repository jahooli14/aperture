/**
 * MorningReview — Step-by-step morning planning flow
 *
 * Behavioral principles:
 *   Implementation Intentions (Gollwitzer 1999): Having a specific plan (WHAT,
 *   WHEN, WHERE) triples task completion. This flow extracts that commitment
 *   from the user via MIT selection + time blocking.
 *
 *   Commitment & Consistency (Cialdini): Setting an intention creates psychological
 *   commitment. People align behavior to prior self-declarations.
 *
 *   Constraint as freedom: Limiting to 3 MITs reduces decision fatigue and
 *   forces priority clarity — you can't cheat yourself into 8 "top priorities".
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Check } from 'lucide-react'
import type { Todo } from '../../stores/useTodoStore'

interface MorningReviewProps {
  todos: Todo[]
  onUpdateTodo: (id: string, updates: Partial<Todo>) => void
  onClose: () => void
}

const TIME_OPTIONS = [
  { label: 'Morning',       value: '09:00' },
  { label: 'Late morning',  value: '11:00' },
  { label: 'Afternoon',     value: '14:00' },
  { label: 'Late afternoon', value: '16:00' },
  { label: 'Evening',       value: '19:00' },
  { label: 'No specific time', value: '' },
]

const STEP_COUNT = 5

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

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
}

export function MorningReview({ todos, onUpdateTodo, onClose }: MorningReviewProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [mitIds, setMitIds] = useState<string[]>([])
  const [scheduledTimes, setScheduledTimes] = useState<Record<string, string>>({})
  const [intention, setIntention] = useState('')
  const [intentionWarning, setIntentionWarning] = useState(false)

  const today = new Date()
  const todayYMD = today.toISOString().split('T')[0]
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  const todayTodos = todos.filter(t =>
    !t.done &&
    !t.deleted_at &&
    (t.scheduled_date === todayYMD || (t.deadline_date === todayYMD))
  )

  const overdueCount = todos.filter(t =>
    !t.done && !t.deleted_at &&
    ((t.scheduled_date && t.scheduled_date < todayYMD) || (t.deadline_date && t.deadline_date < todayYMD))
  ).length

  // Load saved intention for today
  useEffect(() => {
    try {
      const saved = localStorage.getItem('daily-intention')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.date === todayYMD) {
          setIntention(parsed.text ?? '')
        }
      }
    } catch { /* ignore */ }
  }, [todayYMD])

  const advance = () => {
    setDirection(1)
    setStep(s => s + 1)
  }

  const handleMitToggle = (id: string) => {
    setMitIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 3) return prev  // already at 3
      return [...prev, id]
    })
  }

  const handleTimeSelect = (todoId: string, value: string) => {
    setScheduledTimes(prev => ({ ...prev, [todoId]: value }))
  }

  const handleIntentionChange = (val: string) => {
    if (val.length > 100) {
      setIntentionWarning(true)
      return
    }
    setIntentionWarning(false)
    setIntention(val)
  }

  const handleFinish = () => {
    // Apply MIT priority updates
    mitIds.forEach(id => {
      onUpdateTodo(id, { priority: 3 })
    })

    // Apply scheduled times
    Object.entries(scheduledTimes).forEach(([id, time]) => {
      if (time) onUpdateTodo(id, { scheduled_time: time })
    })

    // Save intention
    if (intention.trim()) {
      localStorage.setItem('daily-intention', JSON.stringify({ date: todayYMD, text: intention.trim() }))
    }

    onClose()
  }

  const mitTodos = mitIds.length > 0 ? todayTodos.filter(t => mitIds.includes(t.id)) : todayTodos
  const timeBlockedCount = Object.values(scheduledTimes).filter(Boolean).length

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
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(251,191,36,0.6)' }}>
                Morning review
              </p>
              <h2 className="text-[30px] font-bold leading-tight mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
                Good morning,
              </h2>
              <h2 className="text-[30px] font-bold leading-tight mb-6" style={{ color: 'rgba(251,191,36,0.85)' }}>
                {dayName}.
              </h2>

              <p className="text-[15px] mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {dateStr}
              </p>

              <div className="space-y-3 mb-10">
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                  style={{ background: 'var(--premium-surface-1)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(59,130,246,0.15)' }}
                  >
                    <span className="text-[18px] font-bold" style={{ color: 'rgba(147,197,253,0.9)' }}>
                      {todayTodos.length}
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {todayTodos.length === 1 ? 'task' : 'tasks'} today
                    </p>
                    <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      scheduled for today
                    </p>
                  </div>
                </div>

                {overdueCount > 0 && (
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                    style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}
                  >
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(239,68,68,0.15)' }}
                    >
                      <span className="text-[18px] font-bold" style={{ color: 'rgba(252,165,165,0.9)' }}>
                        {overdueCount}
                      </span>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: 'rgba(252,165,165,0.85)' }}>
                        overdue
                      </p>
                      <p className="text-[12px]" style={{ color: 'rgba(252,165,165,0.45)' }}>
                        carried from previous days
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <motion.button
                onClick={advance}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(251,191,36,0.15)',
                  color: 'rgba(251,191,36,0.9)',
                  border: '1px solid rgba(251,191,36,0.25)',
                }}
              >
                Let's plan your day
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </motion.div>
          )}

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
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(99,179,237,0.6)' }}>
                Pick your top 3
              </p>
              <h2 className="text-[26px] font-bold leading-tight mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                Most important tasks
              </h2>
              <p className="text-[14px] mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>
                What 3 things would make today a success?
              </p>

              {mitIds.length === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(99,179,237,0.2)' }}
                >
                  <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'rgba(99,179,237,0.8)' }} />
                  <p className="text-[12px]" style={{ color: 'rgba(147,197,253,0.8)' }}>
                    Pick just 3 — focus wins
                  </p>
                </motion.div>
              )}

              <div className="space-y-2 mb-8">
                {todayTodos.length === 0 ? (
                  <p className="text-[14px] py-8 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    No tasks scheduled for today
                  </p>
                ) : (
                  todayTodos.map(todo => {
                    const isSelected = mitIds.includes(todo.id)
                    const isDisabled = mitIds.length >= 3 && !isSelected
                    return (
                      <motion.button
                        key={todo.id}
                        onClick={() => !isDisabled && handleMitToggle(todo.id)}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                        style={{
                          background: isSelected
                            ? 'rgba(59,130,246,0.15)'
                            : 'var(--premium-surface-1)',
                          border: `1px solid ${isSelected ? 'rgba(99,179,237,0.5)' : 'rgba(255,255,255,0.07)'}`,
                          opacity: isDisabled ? 0.4 : 1,
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div
                          className="flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all"
                          style={{
                            borderColor: isSelected ? 'rgba(99,179,237,0.8)' : 'rgba(255,255,255,0.2)',
                            background: isSelected ? 'rgba(59,130,246,0.3)' : 'transparent',
                          }}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" style={{ color: 'rgba(147,197,253,1)' }} strokeWidth={3} />}
                        </div>
                        <span
                          className="flex-1 text-[14px] font-medium"
                          style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}
                        >
                          {todo.text}
                        </span>
                        {isSelected && (
                          <span
                            className="flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,179,237,0.2)', color: 'rgba(147,197,253,0.9)' }}
                          >
                            MIT
                          </span>
                        )}
                      </motion.button>
                    )
                  })
                )}
              </div>

              <button
                onClick={advance}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2"
                style={{
                  background: mitIds.length > 0 ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)',
                  color: mitIds.length > 0 ? 'rgba(147,197,253,0.9)' : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${mitIds.length > 0 ? 'rgba(99,179,237,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {mitIds.length > 0 ? `${mitIds.length} MIT${mitIds.length !== 1 ? 's' : ''} set` : 'Skip'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

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
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(139,92,246,0.6)' }}>
                Assign times
              </p>
              <h2 className="text-[26px] font-bold leading-tight mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                When will you do this?
              </h2>
              <p className="text-[14px] mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Time-blocked tasks are 3× more likely to happen.
              </p>

              <div className="space-y-5 mb-8">
                {mitTodos.length === 0 ? (
                  <p className="text-[14px] py-8 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    No tasks to time-block
                  </p>
                ) : (
                  mitTodos.map(todo => (
                    <div key={todo.id}>
                      <p className="text-[13px] font-medium mb-2 truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        {todo.text}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {TIME_OPTIONS.map(opt => {
                          const isSelected = scheduledTimes[todo.id] === opt.value ||
                            (!scheduledTimes[todo.id] && todo.scheduled_time === opt.value)
                          return (
                            <button
                              key={opt.value || 'none'}
                              onClick={() => handleTimeSelect(todo.id, opt.value)}
                              className="px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
                              style={{
                                background: isSelected
                                  ? 'rgba(139,92,246,0.2)'
                                  : 'rgba(255,255,255,0.06)',
                                color: isSelected
                                  ? 'rgba(196,181,253,0.95)'
                                  : 'rgba(255,255,255,0.45)',
                                border: `1px solid ${isSelected ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                              }}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={advance}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(139,92,246,0.15)',
                  color: 'rgba(196,181,253,0.9)',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

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
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(52,211,153,0.6)' }}>
                Set your intention
              </p>
              <h2 className="text-[26px] font-bold leading-tight mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                What would make today a success?
              </h2>
              <p className="text-[14px] mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>
                One sentence. Be specific.
              </p>

              <div className="relative mb-3">
                <textarea
                  value={intention}
                  onChange={e => handleIntentionChange(e.target.value)}
                  placeholder="Today is a success if I…"
                  rows={4}
                  className="w-full resize-none rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed outline-none"
                  style={{
                    background: 'var(--premium-surface-1)',
                    border: `1px solid ${intentionWarning ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: 'rgba(255,255,255,0.85)',
                    caretColor: 'rgba(52,211,153,0.8)',
                  }}
                />
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Stored locally only
                  </span>
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: intention.length > 90 ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.25)' }}
                  >
                    {intention.length}/100
                  </span>
                </div>
              </div>

              <button
                onClick={advance}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 mt-6"
                style={{
                  background: intention.trim()
                    ? 'rgba(52,211,153,0.15)'
                    : 'rgba(255,255,255,0.06)',
                  color: intention.trim()
                    ? 'rgba(52,211,153,0.9)'
                    : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${intention.trim() ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {intention.trim() ? 'Set intention' : 'Skip'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

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
                    background: 'rgba(251,191,36,0.12)',
                    boxShadow: '0 0 40px rgba(251,191,36,0.15)',
                  }}
                >
                  <span className="text-4xl">☀️</span>
                </div>

                <h2 className="text-[28px] font-bold mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  You're ready.
                </h2>
                <p className="text-[14px] mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Here's your plan for today
                </p>

                <div className="w-full text-left space-y-3 mb-8">
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'var(--premium-surface-1)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <span className="text-[20px]">📋</span>
                    <p className="text-[14px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {mitIds.length > 0 ? (
                        <>You've picked <span className="font-bold" style={{ color: 'rgba(147,197,253,0.9)' }}>{mitIds.length} MIT{mitIds.length !== 1 ? 's' : ''}</span></>
                      ) : (
                        <>{todayTodos.length} tasks planned for today</>
                      )}
                    </p>
                  </div>

                  {timeBlockedCount > 0 && (
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                      style={{ background: 'var(--premium-surface-1)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <span className="text-[20px]">⏰</span>
                      <p className="text-[14px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        <span className="font-bold" style={{ color: 'rgba(196,181,253,0.9)' }}>{timeBlockedCount}</span> time-blocked
                      </p>
                    </div>
                  )}

                  {intention.trim() && (
                    <div
                      className="px-4 py-3.5 rounded-2xl"
                      style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(52,211,153,0.55)' }}>
                        Your intention
                      </p>
                      <p className="text-[14px] italic leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        "{intention}"
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.button
                onClick={handleFinish}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(251,191,36,0.18)',
                  color: 'rgba(251,191,36,0.95)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  boxShadow: '0 0 20px rgba(251,191,36,0.1)',
                }}
              >
                Start your day
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
