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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
  /** Zero-based index within its row. Drives the corner vignette side — even
   *  cards vignette top-left, odd cards top-right. Subtle, but each card
   *  breathes in its own direction. */
  index?: number
  /** Visual weight. Glass = filled (recent). Ghost = outline (soon). */
  variant?: MiniCardVariant
}

export function ProjectMiniCard({
  project,
  meta,
  index = 0,
  variant = 'glass',
}: ProjectMiniCardProps) {
  const navigate = useNavigate()
  const theme = getTheme(project.type || 'other', project.title)
  const { start, loading } = useStartProjectSession(project.id)
  const TypeIcon = iconForType(project.type)

  const isOdd = index % 2 === 1
  const isGhost = variant === 'ghost'

  // Surface treatment: glass = filled with project ambient + vignette.
  // Ghost = nearly transparent, hairline border only. Same anatomy
  // inside, different material outside.
  const surface = isGhost
    ? {
        background: 'rgba(15, 24, 41, 0.30)',
        border: `1px solid rgba(${theme.rgb}, 0.18)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.025)`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }
    : {
        background: `linear-gradient(155deg, rgba(${theme.rgb}, 0.11) 0%, rgba(15,24,41,0.55) 70%)`,
        border: `1px solid rgba(${theme.rgb}, 0.28)`,
        boxShadow:
          `0 10px 26px -12px rgba(0,0,0,0.5),` +
          `0 0 22px rgba(${theme.rgb}, 0.10),` +
          `inset 0 1px 0 rgba(255,255,255,0.05)`,
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      }

  // Alternating corner vignette — top-left on even cards, top-right on odd.
  // Subtle radial wash in the project accent. Read as "lit from a corner"
  // rather than a flat panel. Skipped on ghost cards (they're meant quiet).
  const vignetteCorner = isOdd ? '100% 0%' : '0% 0%'
  const vignette = isGhost
    ? null
    : `radial-gradient(circle at ${vignetteCorner}, rgba(${theme.rgb}, 0.16) 0%, transparent 55%)`

  return (
    <button
      type="button"
      onClick={() => { haptic.light(); navigate(`/projects/${project.id}`) }}
      className="group relative w-full text-left transition-all hover:-translate-y-0.5 active:scale-[0.99]"
      style={{
        ...surface,
        borderRadius: '18px',
        padding: '14px',
        minHeight: '120px',
      }}
    >
      {/* Corner vignette — only on glass variant. */}
      {vignette && (
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{ inset: 0, background: vignette, borderRadius: '18px' }}
        />
      )}

      <div className="relative z-10 flex flex-col gap-1.5 h-full min-h-[92px]">
        {/* Top row: accent dot (left), type icon (right). */}
        <div className="flex items-center justify-between">
          <span
            aria-hidden
            className="block rounded-full"
            style={{
              width: '6px',
              height: '6px',
              background: `rgb(${theme.rgb})`,
              boxShadow: isGhost ? 'none' : `0 0 8px rgba(${theme.rgb}, 0.6)`,
            }}
          />
          <TypeIcon
            className="h-3.5 w-3.5"
            style={{ color: `rgba(${theme.rgb}, ${isGhost ? 0.45 : 0.6})` }}
            strokeWidth={1.75}
          />
        </div>

        {/* Title. */}
        <h4
          className="text-[13px] font-bold leading-snug line-clamp-3 text-[var(--brand-text-primary)] mt-0.5"
          style={{
            textShadow: isGhost ? 'none' : '0 1px 2px rgba(0,0,0,0.4)',
            opacity: isGhost ? 0.85 : 1,
          }}
        >
          {project.title}
        </h4>

        {/* Mode framing sub-line. Plain — no italic, no serif. */}
        {meta && (
          <p
            className="text-[10.5px] font-medium leading-snug"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {meta}
          </p>
        )}

        {/* Bottom row: small play glyph. Inherits project accent. */}
        <div className="mt-auto flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic.medium(); start() }}
            disabled={loading}
            aria-label={`Start session for ${project.title}`}
            className="h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
            style={isGhost
              ? {
                  background: 'transparent',
                  border: `1px solid rgba(${theme.rgb}, 0.45)`,
                  color: `rgb(${theme.rgb})`,
                }
              : {
                  background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.95), rgba(${theme.rgb}, 0.70))`,
                  boxShadow: `0 4px 12px -2px rgba(${theme.rgb}, 0.45), inset 0 1px 0 rgba(255,255,255,0.22)`,
                  border: `1px solid rgba(${theme.rgb}, 0.45)`,
                  color: '#0b0f1a',
                }
            }
          >
            {loading ? (
              <span
                className="block w-2 h-2 rounded-full animate-pulse"
                style={{ background: isGhost ? `rgb(${theme.rgb})` : '#0b0f1a' }}
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
