/**
 * ProjectMiniCard — compact two-up card used in the Recently Active
 * and Up Next sections on the home page.
 *
 * Editorial newspaper treatment:
 *   • Big serif italic numeral watermark (01 / 02 …) behind the title
 *   • Vertical theme stripe on the left edge — the "section spine"
 *   • Even-indexed cards stagger down ~10px so the row reads like a
 *     magazine spread, not a rigid 2-up grid
 *   • Small inline ▶ button starts a focus session without navigating
 */

import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { getTheme } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'
import { useStartProjectSession } from '../../hooks/useStartProjectSession'
import type { Project } from '../../types'

interface ProjectMiniCardProps {
  project: Project
  /** Small meta line under the title (e.g. "yesterday", "#1 in queue"). */
  meta?: string
  /** Zero-based index within its row. Drives the editorial numeral + the
   *  asymmetric stagger so the two cards don't read as a flat 2×2 table. */
  index?: number
}

export function ProjectMiniCard({ project, meta, index = 0 }: ProjectMiniCardProps) {
  const navigate = useNavigate()
  const theme = getTheme(project.type || 'other', project.title)
  const { start, loading } = useStartProjectSession(project.id)

  const isOdd = index % 2 === 1
  const numeral = String(index + 1).padStart(2, '0')

  return (
    <button
      type="button"
      onClick={() => { haptic.light(); navigate(`/projects/${project.id}`) }}
      className="group relative w-full text-left rounded-2xl px-3.5 py-3.5 pl-5 transition-all hover:brightness-110 hover:-translate-y-1 active:scale-[0.99]"
      style={{
        background: `linear-gradient(155deg, rgba(${theme.rgb}, 0.12) 0%, rgba(15,24,41,0.55) 65%)`,
        border: `1px solid rgba(${theme.rgb}, 0.30)`,
        boxShadow:
          `0 14px 32px -12px rgba(0,0,0,0.55),` +
          `0 4px 10px rgba(0,0,0,0.20),` +
          `0 0 22px rgba(${theme.rgb}, 0.12),` +
          `inset 0 1px 0 rgba(255,255,255,0.06)`,
        minHeight: '108px',
        backdropFilter: 'blur(14px) saturate(160%)',
        WebkitBackdropFilter: 'blur(14px) saturate(160%)',
        transform: isOdd ? 'translateY(12px)' : 'translateY(0)',
      }}
    >
      {/* Left-edge "section spine" — replaces the top hairline */}
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
        style={{
          background: `linear-gradient(180deg, rgba(${theme.rgb}, 0.9), rgba(${theme.rgb}, 0.25))`,
          boxShadow: `0 0 12px rgba(${theme.rgb}, 0.55)`,
        }}
      />

      {/* Editorial numeral, faint serif italic, sits behind the title */}
      <span
        aria-hidden
        className="absolute top-1 right-3 select-none pointer-events-none italic font-bold leading-none"
        style={{
          fontFamily: 'var(--brand-font-serif)',
          fontSize: '44px',
          color: theme.text,
          opacity: 0.10,
          letterSpacing: '-0.04em',
        }}
      >
        {numeral}
      </span>

      <div className="relative z-10 flex flex-col gap-1.5 h-full min-h-[88px]">
        <h4
          className="text-[13px] font-bold leading-snug line-clamp-3 text-[var(--brand-text-primary)] pr-7"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {project.title}
        </h4>

        {meta && (
          <p
            className="text-[10.5px] italic opacity-75"
            style={{ color: theme.text, fontFamily: 'var(--brand-font-serif)' }}
          >
            {meta}
          </p>
        )}

        <div className="mt-auto flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic.medium(); start() }}
            disabled={loading}
            aria-label={`Start session for ${project.title}`}
            className="h-7 w-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-60"
            style={{
              background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.95), rgba(${theme.rgb}, 0.65))`,
              boxShadow: `0 4px 12px -2px rgba(${theme.rgb}, 0.45), inset 0 1px 0 rgba(255,255,255,0.25)`,
              border: `1px solid rgba(${theme.rgb}, 0.45)`,
              color: '#0b0f1a',
            }}
          >
            {loading ? (
              <span
                className="block w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ background: '#0b0f1a' }}
              />
            ) : (
              <Play className="h-3 w-3 fill-current" style={{ marginLeft: '1px' }} />
            )}
          </button>
        </div>
      </div>
    </button>
  )
}
