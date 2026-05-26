/**
 * Session-Context Prompt
 *
 * One tap before home does its real work. CLAUDE.md §Inputs #1 asks for
 * a "how are you feeling right now" reading at app open so The Moment
 * (and the project-ideas re-roll) can calibrate to context — focused,
 * scattered, or restless. The duration toggle on the masthead already
 * captures "how long"; this captures the shape of the willpower.
 *
 * Behaviour:
 *   - Renders an overlay the first time the user lands on the home in
 *     a given browser session. Closing it (skip or pick) sets
 *     promptSeen=true in sessionStorage, so it doesn't pop again until
 *     the tab is closed and reopened.
 *   - "Skip" leaves feeling=null; downstream surfaces treat that as
 *     "no signal" and fall back to their default behaviour.
 *   - Three choices only. Plain words people actually say.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useSessionContextStore, type SessionFeeling } from '../../stores/useSessionContextStore'

const OPTIONS: Array<{ value: SessionFeeling; label: string; hint: string }> = [
  { value: 'focused',   label: 'Focused',   hint: 'Sharp. Ready to make something.' },
  { value: 'scattered', label: 'Scattered', hint: 'Pulled in pieces. Need a small win.' },
  { value: 'restless',  label: 'Restless',  hint: 'Antsy. Want to start something new.' },
]

export function SessionContextPrompt() {
  const promptSeen = useSessionContextStore(s => s.promptSeen)
  const setFeeling = useSessionContextStore(s => s.setFeeling)
  const markPromptSeen = useSessionContextStore(s => s.markPromptSeen)

  const open = !promptSeen

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="session-context-prompt"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[120] flex items-center justify-center px-6"
          style={{ background: 'rgba(8, 8, 12, 0.78)', backdropFilter: 'blur(8px)' }}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
            className="glass-card max-w-md w-full p-7 sm:p-8"
            style={{ borderRadius: 18 }}
          >
            <div className="mb-1 text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--brand-text-muted)' }}>
              quick check
            </div>
            <h2 className="text-2xl font-serif mb-1" style={{ color: 'var(--brand-text-primary)' }}>
              How are you arriving?
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--brand-text-secondary)' }}>
              One tap. Calibrates what shows up next.
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFeeling(opt.value)}
                  className="text-left p-4 transition-all press-spring"
                  style={{
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--brand-text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(var(--brand-primary-rgb), 0.10)'
                    e.currentTarget.style.borderColor = 'rgba(var(--brand-primary-rgb), 0.30)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  }}
                >
                  <div className="text-base font-medium">{opt.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--brand-text-muted)' }}>
                    {opt.hint}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={markPromptSeen}
                className="text-[11px] uppercase tracking-[0.18em] opacity-50 hover:opacity-90 transition-opacity"
                style={{ color: 'var(--brand-text-muted)' }}
              >
                Skip
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
