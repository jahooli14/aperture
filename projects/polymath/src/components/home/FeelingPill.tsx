/**
 * Feeling Pill — one-tap session context.
 *
 * CLAUDE.md §Inputs #1: "how you're feeling (focused / scattered /
 * restless). The Moment calibrates everything to context."
 *
 * Renders three small chips. Tapping one stores the feeling in
 * useSessionContextStore (sessionStorage-scoped). Tapping the same
 * chip again clears it. The component does NOT intercept the home
 * render — it is a passive widget the owner can mount anywhere on the
 * masthead. Downstream surfaces (project-ideas re-roll, Keep Going
 * filtering) can read the store directly.
 */

import { useSessionContextStore, type SessionFeeling } from '../../stores/useSessionContextStore'
import { haptic } from '../../utils/haptics'

const OPTIONS: ReadonlyArray<{ value: SessionFeeling; label: string }> = [
  { value: 'focused', label: 'focused' },
  { value: 'scattered', label: 'scattered' },
  { value: 'restless', label: 'restless' },
]

export function FeelingPill() {
  const feeling = useSessionContextStore(s => s.feeling)
  const setFeeling = useSessionContextStore(s => s.setFeeling)

  const handlePick = (next: SessionFeeling) => {
    haptic.light()
    setFeeling(feeling === next ? null : next)
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-1 py-1 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      role="radiogroup"
      aria-label="How are you feeling right now"
    >
      {OPTIONS.map(opt => {
        const active = feeling === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => handlePick(opt.value)}
            className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.18em] font-semibold transition-colors"
            style={{
              color: active ? 'var(--brand-bg)' : 'var(--brand-text-muted)',
              background: active ? 'rgb(var(--brand-primary-rgb))' : 'transparent',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
