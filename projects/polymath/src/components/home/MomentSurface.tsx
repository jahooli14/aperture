/**
 * MomentSurface — the AI-found-you-an-idea hero, top of home.
 *
 * Renders when the cron has pre-baked a high-confidence Read idea (the
 * longitudinal pattern reader self-scored ≥ TEASER_CONFIDENCE_THRESHOLD).
 * Otherwise returns null and the home falls back to Keep Going as the lead.
 *
 * This is the "killer surface" — when the system has earned the click, the
 * idea leads the page. Compact hero version: pattern → title → pitch →
 * your move → save/dismiss/build. The full editorial card (with why_now,
 * evidence, drop caps) still lives in `ProjectIdeasHome` further down for
 * users who want to dive deeper.
 *
 * Cross-component sync: this and ProjectIdeasHome both fetch the queue
 * independently. After any feedback action, dispatch
 * `polymath:ideas-invalidate` so the other surface refetches and stops
 * showing rows that have just been resolved.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookmarkPlus, X, Hammer } from 'lucide-react'
import { haptic } from '../../utils/haptics'
import { api } from '../../lib/apiClient'

const TEASER_CONFIDENCE_THRESHOLD = 70

export const IDEAS_INVALIDATE_EVENT = 'polymath:ideas-invalidate'

interface ProjectIdea {
  id: string
  title: string
  pitch: string
  next_step: string
  status: 'pending' | 'saved' | 'rejected' | 'built'
  mode?: 'crossover' | 'read'
  pattern?: string | null
  confidence?: number | null
}

const READ_VISUAL = {
  glyph: '◉',
  accentRgb: '244, 114, 182',
  eyebrow: 'what i see across your work',
}

export function MomentSurface() {
  const navigate = useNavigate()
  const [idea, setIdea] = useState<ProjectIdea | null>(null)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('utilities?resource=project-ideas') as { ideas: ProjectIdea[] }
      const queued = (res.ideas ?? []).find(i =>
        i.mode === 'read'
        && (i.confidence ?? 0) >= TEASER_CONFIDENCE_THRESHOLD
        && i.status === 'pending'
      )
      setIdea(queued ?? null)
    } catch {
      setIdea(null)
    }
  }, [])

  useEffect(() => {
    void load()
    const handler = () => void load()
    window.addEventListener(IDEAS_INVALIDATE_EVENT, handler)
    return () => window.removeEventListener(IDEAS_INVALIDATE_EVENT, handler)
  }, [load])

  const sendFeedback = useCallback(async (status: 'saved' | 'rejected' | 'built') => {
    if (!idea || pending) return
    setPending(true)
    haptic.medium()
    try {
      await api.post('utilities?resource=project-ideas-feedback', { id: idea.id, status })
      if (status === 'built') {
        const description = idea.pattern ? `${idea.pattern}\n\n${idea.pitch}` : idea.pitch
        const params = new URLSearchParams({
          title: idea.title,
          description,
          first_task: idea.next_step,
          from_idea: idea.id,
        })
        navigate(`/projects?create=1&${params.toString()}`)
        return
      }
      setIdea(null)
      window.dispatchEvent(new Event(IDEAS_INVALIDATE_EVENT))
    } catch {
      // User can retry from the pill further down the page.
    } finally {
      setPending(false)
    }
  }, [idea, navigate, pending])

  if (!idea) return null

  const accent = READ_VISUAL.accentRgb

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="relative"
    >
      <div
        aria-hidden
        className="absolute -inset-x-6 -top-10 h-[120%] pointer-events-none -z-10"
        style={{
          background: `
            radial-gradient(ellipse 70% 45% at 30% 10%, rgba(${accent}, 0.22), transparent 65%),
            radial-gradient(ellipse 50% 35% at 80% 25%, rgba(${accent}, 0.12), transparent 60%)
          `,
          filter: 'blur(32px)',
        }}
      />

      <div className="relative flex items-center gap-3 mb-5">
        <span
          aria-hidden
          className="text-[24px] leading-none flex-shrink-0"
          style={{
            color: `rgb(${accent})`,
            fontFamily: 'var(--brand-font-serif)',
            textShadow: `0 0 18px rgba(${accent}, 0.45)`,
          }}
        >
          {READ_VISUAL.glyph}
        </span>
        <span
          className="h-px w-8 flex-shrink-0"
          style={{ background: `linear-gradient(to right, rgba(${accent}, 0.6), rgba(${accent}, 0.1))` }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.32em] font-semibold flex-1 truncate"
          style={{ color: `rgb(${accent})`, opacity: 0.85 }}
        >
          {READ_VISUAL.eyebrow}
        </span>
      </div>

      {idea.pattern && (
        <p
          className="text-[24px] sm:text-[32px] leading-[1.18] italic mb-4"
          style={{
            color: 'var(--brand-text-primary)',
            fontFamily: 'var(--brand-font-serif)',
            fontWeight: 400,
            letterSpacing: '-0.018em',
          }}
        >
          {idea.pattern}
        </p>
      )}

      <span
        className="block text-[10px] uppercase tracking-[0.32em] mb-2 font-semibold"
        style={{ color: `rgb(${accent})`, opacity: 0.85 }}
      >
        the project this points to
      </span>

      <h3
        className="text-[22px] sm:text-[28px] leading-[1.05] mb-3"
        style={{
          color: 'var(--brand-text-primary)',
          fontFamily: 'var(--brand-font-serif)',
          fontWeight: 500,
          letterSpacing: '-0.022em',
        }}
      >
        {idea.title}
      </h3>

      <div
        aria-hidden
        className="h-[2px] w-16 mb-5 rounded-full"
        style={{
          background: `linear-gradient(to right, rgb(${accent}), rgba(${accent}, 0.15))`,
          boxShadow: `0 0 12px rgba(${accent}, 0.4)`,
        }}
      />

      <p
        className="text-[15px] leading-[1.6] mb-5 line-clamp-3"
        style={{
          color: 'var(--brand-text-primary)',
          fontFamily: 'var(--brand-font-serif)',
          fontWeight: 400,
          opacity: 0.92,
        }}
      >
        {idea.pitch}
      </p>

      <div
        className="relative mb-5 p-4 sm:p-5 rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, rgba(${accent}, 0.14), rgba(${accent}, 0.04) 60%, transparent)`,
          border: `1px solid rgba(${accent}, 0.22)`,
          boxShadow: `0 8px 32px -12px rgba(${accent}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)`,
        }}
      >
        <span
          className="block text-[10px] uppercase tracking-[0.32em] mb-2 font-semibold"
          style={{ color: `rgb(${accent})` }}
        >
          your move
        </span>
        <p
          className="text-[15px] sm:text-[17px] leading-[1.45] font-medium"
          style={{ color: 'var(--brand-text-primary)', fontFamily: 'var(--brand-font-serif)' }}
        >
          {idea.next_step}
        </p>
      </div>

      <div
        className="flex items-center gap-2 pt-3"
        style={{ borderTop: `1px solid rgba(${accent}, 0.12)` }}
      >
        <button
          type="button"
          onClick={() => sendFeedback('rejected')}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] tracking-wide transition-opacity opacity-50 hover:opacity-100 disabled:opacity-30"
          style={{ color: 'var(--brand-text-muted)' }}
        >
          <X className="h-3.5 w-3.5" />
          <span>not for me</span>
        </button>

        <span className="flex-1" aria-hidden />

        <button
          type="button"
          onClick={() => sendFeedback('saved')}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11.5px] font-medium tracking-wide transition-all"
          style={{
            color: 'var(--brand-text-secondary)',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          <span>save</span>
        </button>

        <button
          type="button"
          onClick={() => sendFeedback('built')}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold tracking-wide transition-all disabled:opacity-60"
          style={{
            color: 'var(--brand-bg)',
            background: `linear-gradient(135deg, rgb(${accent}), rgba(${accent}, 0.8))`,
            boxShadow: `0 4px 16px -4px rgba(${accent}, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          <Hammer className="h-3.5 w-3.5" />
          <span>building it</span>
        </button>
      </div>
    </motion.section>
  )
}
