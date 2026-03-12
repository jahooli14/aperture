/**
 * DailyReview  Morning planning + evening reflection container
 *
 * Auto-detects whether to show morning or evening flow based on time of day:
 *   Before 12pm   Morning Review
 *   After 6pm     Evening Review
 *   12pm6pm      User chooses
 *
 * Rendered as a full-screen modal that slides up from the bottom,
 * consistent with native sheet patterns on iOS/Android.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Sun, Moon } from 'lucide-react'
import type { Todo } from '../../stores/useTodoStore'
import { MorningReview } from './MorningReview'
import { EveningReview } from './EveningReview'

export interface DailyReviewProps {
  onClose: () => void
  todos: Todo[]
  onUpdateTodo: (id: string, updates: Partial<Todo>) => void
  onAddTodo?: (input: Partial<Todo> & { text: string }) => Promise<Todo>
  onDeleteTodo?: (id: string) => void
}

type ReviewType = 'morning' | 'evening'

function detectReviewType(): ReviewType | null {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour >= 18) return 'evening'
  return null  // midday  user chooses
}

export function DailyReview({ onClose, todos, onUpdateTodo, onAddTodo, onDeleteTodo }: DailyReviewProps) {
  const [reviewType, setReviewType] = useState<ReviewType | null>(detectReviewType)

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 42 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: '#0a1020' }}
    >
      {/* X dismiss button */}
      <button
        onClick={onClose}
        className="absolute top-5 left-5 z-10 h-9 w-9 flex items-center justify-center rounded-xl transition-all"
        style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
        aria-label="Close review"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {reviewType === null ? (
          // Midday chooser
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--brand-primary)" }}>
              Daily review
            </p>
            <h2 className="text-[28px] font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
              Which review?
            </h2>
            <p className="text-[14px] mb-10" style={{ color: "var(--brand-primary)" }}>
              Plan your day, or reflect on what happened.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => setReviewType('morning')}
                className="flex items-center gap-3 px-5 py-4 text-left transition-all"
                style={{
                  background: 'rgba(251,191,36,0.10)',
                  border: '1.5px solid rgba(251,191,36,0.35)',
                  borderRadius: '4px',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                }}
              >
                <Sun className="h-5 w-5 flex-shrink-0" style={{ color: "var(--brand-primary)" }} />
                <div>
                  <p className="text-[15px] font-bold" style={{ color: "var(--brand-primary)" }}>
                    Morning review
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--brand-primary)" }}>
                    Plan your day, pick your MITs
                  </p>
                </div>
              </button>

              <button
                onClick={() => setReviewType('evening')}
                className="flex items-center gap-3 px-5 py-4 text-left transition-all"
                style={{
                  background: 'rgba(139,92,246,0.10)',
                  border: '1.5px solid rgba(139,92,246,0.35)',
                  borderRadius: '4px',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                }}
              >
                <Moon className="h-5 w-5 flex-shrink-0" style={{ color: "var(--brand-primary)" }} />
                <div>
                  <p className="text-[15px] font-bold" style={{ color: "var(--brand-primary)" }}>
                    Evening review
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--brand-primary)" }}>
                    Reflect, capture, plan tomorrow
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : reviewType === 'morning' ? (
          <MorningReview
            todos={todos}
            onUpdateTodo={onUpdateTodo}
            onClose={onClose}
          />
        ) : (
          <EveningReview
            todos={todos}
            onUpdateTodo={onUpdateTodo}
            onAddTodo={onAddTodo}
            onDeleteTodo={onDeleteTodo}
            onClose={onClose}
          />
        )}
      </div>
    </motion.div>
  )
}
