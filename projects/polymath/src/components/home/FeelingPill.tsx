/**
 * Feeling Pill
 *
 * One tap before the rest of Home renders, so the session can calibrate to
 * right-now state — CLAUDE.md's "Session context" section already
 * describes this as shipped (feeding Focus chat's calibration and the
 * project-ideas re-roll), but no component ever called
 * useSessionContextStore's setFeeling — the store existed, nothing wrote
 * to it, so `feeling` was always null. This is that missing write path.
 *
 * Shows once per session (sessionStorage-backed store already handles the
 * "expires when the tab closes" half); collapses to a quiet one-line
 * summary once tapped, tap again to change it mid-session.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useSessionContextStore, type SessionFeeling } from '../../stores/useSessionContextStore'

const OPTIONS: { value: SessionFeeling; label: string }[] = [
  { value: 'focused', label: 'Focused' },
  { value: 'scattered', label: 'Scattered' },
  { value: 'restless', label: 'Restless' },
]

export function FeelingPill() {
  const feeling = useSessionContextStore(s => s.feeling)
  const setFeeling = useSessionContextStore(s => s.setFeeling)

  return (
    <div className="mb-4">
      <AnimatePresence mode="wait" initial={false}>
        {feeling ? (
          <motion.button
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFeeling(null)}
            className="text-[12px] px-1"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
          >
            Feeling {feeling} today <span style={{ opacity: 0.6 }}>· change</span>
          </motion.button>
        ) : (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <span className="text-[12px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
              How are you feeling?
            </span>
            <div className="flex items-center gap-1.5">
              {OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFeeling(opt.value)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--brand-text-secondary)' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
