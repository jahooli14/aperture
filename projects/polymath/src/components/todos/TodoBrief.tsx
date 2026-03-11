/**
 * AI Daily Brief — dismissible card at top of Today view.
 * Proposes a day plan with reasoning and nudges from unactioned thoughts.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useTodoStore } from '../../stores/useTodoStore'
import type { DailyBrief } from '../../../api/todo-brief'

const BRIEF_DISMISS_KEY = 'polymath-brief-dismissed'

function isDismissedToday(): boolean {
  const dismissed = localStorage.getItem(BRIEF_DISMISS_KEY)
  if (!dismissed) return false
  return dismissed === new Date().toISOString().split('T')[0]
}

function dismissForToday() {
  localStorage.setItem(BRIEF_DISMISS_KEY, new Date().toISOString().split('T')[0])
}

export function TodoBrief() {
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(isDismissedToday)
  const [collapsed, setCollapsed] = useState(false)
  const addTodo = useTodoStore(state => state.addTodo)

  useEffect(() => {
    if (dismissed) return

    const fetchBrief = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/todo-brief')
        if (!res.ok) throw new Error('Failed to fetch brief')
        const data: DailyBrief = await res.json()
        setBrief(data)
      } catch (err) {
        console.error('[TodoBrief] Failed to load:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchBrief()
  }, [dismissed])

  const handleDismiss = useCallback(() => {
    dismissForToday()
    setDismissed(true)
  }, [])

  const handleCreateTodoFromNudge = useCallback(async (nudge: DailyBrief['nudges'][0]) => {
    if (!nudge.suggested_todo_text) return
    await addTodo({
      text: nudge.suggested_todo_text,
      source_memory_id: nudge.source_memory_id,
      tags: ['ai-suggested'],
    })
  }, [addTodo])

  if (dismissed || (!loading && !brief)) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12, height: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="mb-4"
      >
        <div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 50%, rgba(6,182,212,0.04) 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.15), 0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: 'rgba(129,140,248,0.8)' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(129,140,248,0.8)' }}>
                Daily Brief
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCollapsed(c => !c)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-4">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Thinking about your day...</span>
            </div>
          )}

          {brief && !collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {/* Greeting */}
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--premium-text-primary)' }}>
                {brief.greeting}
              </p>

              {/* Plan — reasoning for each todo */}
              {brief.plan.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {brief.plan.map((item, i) => (
                    <div key={item.todo_id} className="flex gap-2 items-start">
                      <span className="text-[10px] font-bold mt-0.5 flex-shrink-0 w-4 text-center" style={{ color: 'rgba(129,140,248,0.6)' }}>
                        {i + 1}
                      </span>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {item.reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Nudges — unactioned thoughts */}
              {brief.nudges.length > 0 && (
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(6,182,212,0.6)' }}>
                    Worth actioning
                  </span>
                  {brief.nudges.map((nudge, i) => (
                    <div key={i} className="flex items-start gap-2 group">
                      <p className="flex-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {nudge.text}
                      </p>
                      {nudge.suggested_todo_text && (
                        <button
                          onClick={() => handleCreateTodoFromNudge(nudge)}
                          className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
                          style={{ color: 'rgba(6,182,212,0.7)' }}
                          title={`Create todo: ${nudge.suggested_todo_text}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {brief && collapsed && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {brief.greeting}
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
