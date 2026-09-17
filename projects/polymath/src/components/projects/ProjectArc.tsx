/**
 * The Arc
 *
 * Every checkpoint a non-repeating project has actually been through —
 * each time its task list ran out, what judgeFinishLine said against the
 * stated finish line, kept instead of shown once in a close-out receipt
 * and thrown away (api/_lib/project-milestones.ts).
 *
 * Deliberately not a percentage. A spine plans backwards from the finish
 * line 5-8 steps at a time, discovering only the next stretch as it goes
 * — there's no real denominator to compute a "68% done" out of, and
 * inventing one would be exactly the fabricated precision this app
 * refuses everywhere else. The honest signal is the most recent verdict's
 * own plain sentence: what's actually still missing, in the app's own
 * words about the user's own goal.
 *
 * A target date, when the user has volunteered one, gets the same
 * treatment — plain day-count arithmetic, never a projected pace. There
 * usually isn't enough data for a real rate, and a confident-sounding
 * wrong one is worse than an honest "no idea how fast this is going."
 *
 * Invisible when there's nothing to show: no milestones yet and no target
 * date is the common case for a project that's never had its list run out,
 * and that's not a gap to fill with a placeholder.
 */

import { Flag, Circle, CheckCircle2 } from 'lucide-react'
import type { ProjectMilestone } from '../../types'
import { daysUntil, targetDateLine, shortDate } from './projectArcOps'

const secondaryTextStyle = { color: 'var(--brand-text-secondary)' }

export interface ProjectArcProps {
  milestones: ProjectMilestone[]
  targetDate?: string | null
}

const HISTORY_SHOWN = 4

export function ProjectArc({ milestones, targetDate }: ProjectArcProps) {
  if (milestones.length === 0 && !targetDate) return null

  const ordered = [...milestones].reverse() // most recent first
  const shown = ordered.slice(0, HISTORY_SHOWN)
  const hiddenCount = ordered.length - shown.length

  return (
    <div className="space-y-3">
      <span className="text-[11px] font-medium tracking-wide flex items-center gap-1.5 lowercase" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.5 }}>
        <Flag className="h-3 w-3" /> the arc
      </span>

      {targetDate && (
        <p className="text-[13px]" style={secondaryTextStyle}>
          Target: {shortDate(targetDate)} — {targetDateLine(daysUntil(targetDate))}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="space-y-2.5">
          {shown.map(m => (
            <li key={m.n} className="flex items-start gap-2.5">
              {m.reached ? (
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.8 }} />
              ) : (
                <Circle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ ...secondaryTextStyle, opacity: 0.35 }} />
              )}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-[13px] leading-snug" style={{ color: 'var(--brand-text-primary)', opacity: 0.85 }}>
                  {m.reason}
                </p>
                <p className="text-[10.5px]" style={{ ...secondaryTextStyle, opacity: 0.45 }}>
                  {shortDate(m.at)}{m.steps.length > 0 ? ` · ${m.steps.length} step${m.steps.length === 1 ? '' : 's'}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && (
        <p className="text-[11px]" style={{ ...secondaryTextStyle, opacity: 0.4 }}>
          +{hiddenCount} further back
        </p>
      )}
    </div>
  )
}
