/**
 * ProjectMiniCard — compact two-up card used in the home's project rows.
 *
 * Two variants drive the home's atmospheric stack:
 *   • glass — recent / active. Filled glass surface with accent dot + soft
 *     inner corner vignette in the project's accent colour.
 *   • ghost — soon / queued. Outline-only. Same anatomy, quieter material —
 *     reads as "further away" without anyone labelling it.
 *
 * Section identity on the home now lives in material, not in headings.
 * The card carries its own framing (accent dot, type icon, mode line).
 */

import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { getTheme, iconForType } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'
import { useStartProjectSession } from '../../hooks/useStartProjectSession'
import type { Project } from '../../types'

export type MiniCardVariant = 'glass' | 'ghost'

interface ProjectMiniCardProps {
  project: Project
  /** Mode-framing sub-line ("from your note last night", "#1 in queue", "3w ago"). */
  meta?: string
  /** Visual weight. Glass = filled (recent). Ghost = outline (soon). */
  variant?: MiniCardVariant
}

export function ProjectMiniCard({
  project,
  meta,
  variant = 'glass',
}: ProjectMiniCardProps) {
  const navigate = useNavigate()
  const theme = getTheme(project.type || 'other', project.title)
  const { start, loading } = useStartProjectSession(project.id)
  const TypeIcon = iconForType(project.type ?? undefined)

  const isGhost = variant === 'ghost'

  // Single restrained palette — mirrors ThoughtOfTheDay. Project identity
  // shows up only in the tiny accent dot. Cards read as one cohesive
  // editorial set, not a kaleidoscope.
  const surface = isGhost
    ? {
        background: 'rgba(15, 24, 41, 0.30)',
        border: '1px solid rgba(var(--brand-primary-rgb), 0.18)',
        boxShadow:
          '0 0 22px rgba(var(--brand-primary-rgb), 0.10),' +
          'inset 0 1px 0 rgba(255,255,255,0.03)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }
    : {
        background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.65) 60%)',
        border: '1px solid rgba(var(--brand-primary-rgb),0.32)',
        boxShadow:
          '0 0 32px rgba(var(--brand-primary-rgb),0.20),' +
          '0 8px 24px -10px rgba(0,0,0,0.55),' +
          'inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      }

  return (
    <button
      type="button"
      onClick={() => { haptic.light(); navigate(`/projects/${project.id}`) }}
      className="group relative w-full text-left transition-all hover:-translate-y-0.5 active:scale-[0.99] overflow-hidden"
      style={{
        ...surface,
        borderRadius: '18px',
        padding: '14px',
        minHeight: '120px',
      }}
    >
      {/* Top hairline glow — single editorial cue, mirrors ThoughtOfTheDay. */}
      {!isGhost && (
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.45), transparent)' }}
        />
      )}

      <div className="relative z-10 flex flex-col gap-1.5 h-full min-h-[92px]">
        {/* Top row: type icon sits inside a soft project-coloured halo.
            The area glows, not the icon — feels like ambient identity
            instead of a coloured pin. */}
        <div className="flex items-center justify-end">
          <div className="relative">
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
              style={{
                width: '40px',
                height: '40px',
                background: `radial-gradient(circle, rgba(${theme.rgb}, 0.38) 0%, rgba(${theme.rgb}, 0.14) 45%, transparent 75%)`,
                filter: 'blur(4px)',
              }}
            />
            <TypeIcon
              className="relative h-4 w-4"
              style={{ color: 'rgba(255, 255, 255, 0.85)' }}
              strokeWidth={1.75}
            />
          </div>
        </div>

        {/* Title — canonical .card-title (serif, full primary). Ghost
            variant used to fade to 0.82 opacity which dropped contrast
            below readable on the outline surface; both variants now share
            the same spec. */}
        <h4 className="card-title line-clamp-3 mt-0.5">
          {project.title}
        </h4>

        {/* Mode framing sub-line — uppercase tracked caps, single tone. */}
        {meta && (
          <span
            className="text-[9.5px] uppercase tracking-[0.24em] font-semibold mt-1"
            style={{ color: 'rgba(var(--brand-primary-rgb), 0.6)' }}
          >
            {meta}
          </span>
        )}

        {/* Bottom row: refined play glyph in brand-primary, single tone. */}
        <div className="mt-auto flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic.medium(); start() }}
            disabled={loading}
            aria-label={`Start session for ${project.title}`}
            className="h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
            style={{
              background: 'rgba(var(--brand-primary-rgb), 0.10)',
              border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
              color: 'rgb(var(--brand-primary-rgb))',
            }}
          >
            {loading ? (
              <span
                className="block w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'rgb(var(--brand-primary-rgb))' }}
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
