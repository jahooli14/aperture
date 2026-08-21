/**
 * Thinking Indicator
 *
 * Both chats call Gemini in JSON mode over a single blocking request — no
 * token streaming (JSON-mode output can't be safely rendered mid-stream,
 * and the structured actions/taskOps only mean anything once the whole
 * reply has parsed). A plain 3-dot pulse over a multi-second wait reads as
 * stalled rather than working, so this adds a second, honest signal: once
 * the wait runs long enough that a static dot pulse stops being credible,
 * swap in status copy that says so instead of pretending nothing changed.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const STAGES = [
  { afterMs: 0, label: null },
  { afterMs: 2500, label: 'Still thinking…' },
  { afterMs: 6000, label: 'Almost there…' },
] as const

export function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(() => setElapsed(Date.now() - start), 400)
    return () => window.clearInterval(id)
  }, [])

  const label = [...STAGES].reverse().find(s => elapsed >= s.afterMs)?.label ?? null

  return (
    <div className="flex items-center gap-2 pt-1 px-1">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="block w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--brand-text-secondary)', opacity: 0.2 }}
            animate={{ opacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
      {label && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          className="text-[11px]"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          {label}
        </motion.span>
      )}
    </div>
  )
}
