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
import {
  Play, PenLine, Cpu, Palette, Music, Briefcase, Sparkles, Wand2, BookOpen, Box,
  type LucideIcon,
} from 'lucide-react'
import { getTheme } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'
import { useStartProjectSession } from '../../hooks/useStartProjectSession'
import type { Project } from '../../types'

const TYPE_ICONS: Record<string, LucideIcon> = {
  writing: PenLine,
  tech: Cpu,
  art: Palette,
  music: Music,
  business: Briefcase,
  life: Sparkles,
  creative: Wand2,
  learning: BookOpen,
}

function iconForType(type?: string): LucideIcon {
  const t = (type || '').toLowerCase().trim()
  return TYPE_ICONS[t] || Box
}

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
        border: '1px solid rgba(var(--brand-primary-rgb), 0.10)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }
    : {
        background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.08) 0%, rgba(15,24,41,0.65) 60%)',
        border: '1px solid rgba(var(--brand-primary-rgb),0.14)',
        boxShadow:
          '0 0 48px -14px rgba(var(--brand-primary-rgb),0.14),' +
          '0 8px 28px -12px rgba(0,0,0,0.55),' +
          'inset 0 1px 0 rgba(255,255,255,0.04)',
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
        {/* Top row: tiny project-accent dot (left), type icon (right). */}
        <div className="flex items-center justify-between">
          <span
            aria-hidden
            className="block rounded-full"
            style={{
              width: '5px',
              height: '5px',
              background: `rgba(${theme.rgb}, 0.7)`,
            }}
          />
          <TypeIcon
            className="h-3.5 w-3.5"
            style={{ color: 'rgba(var(--brand-primary-rgb), 0.55)' }}
            strokeWidth={1.5}
          />
        </div>

        {/* Title — editorial serif, mirrors ThoughtOfTheDay text. */}
        <h4
          className="text-[14px] leading-snug line-clamp-3 mt-0.5"
          style={{
            color: 'var(--brand-text-primary)',
            fontFamily: 'var(--brand-font-serif)',
            fontWeight: 500,
            opacity: isGhost ? 0.82 : 0.96,
          }}
        >
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
