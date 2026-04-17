/**
 * Session Brief Card
 *
 * The first thing you see when you open a project. Replaces the static
 * "Next Action" card with an AI-generated session briefing that adapts
 * to where the project actually is: shaping, building, closing, or stale.
 *
 * Shows: AI greeting, phase indicator, focus suggestion, knowledge nudge.
 * Feels like a collaborator catching you up, not a dashboard widget.
 */

import { useState, useEffect } from 'react'
import { Compass, Hammer, Flag, Sunrise, ArrowRight, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import type { Project } from '../../types'

type Phase = 'shaping' | 'building' | 'closing' | 'stale' | 'fresh'
type Momentum = 'rising' | 'steady' | 'fading' | 'cold'

interface SessionBrief {
  greeting: string
  phase: Phase
  phaseLabel: string
  focusSuggestion: string
  knowledgeNudge: string | null
  momentum: Momentum
  completedSinceLastVisit: string[]
  stats: {
    totalTasks: number
    completedTasks: number
    daysSinceActive: number
    progressPercent: number
  }
}

interface SessionBriefCardProps {
  project: Project
  onOpenChat: (message?: string) => void
  onBriefLoaded?: (data: { phase: Phase; focusSuggestion: string; knowledgeNudge: string | null }) => void
}

const PHASE_CONFIG: Record<Phase, {
  icon: typeof Compass
  gradient: string
  border: string
  glow: string
  accent: string
}> = {
  shaping: {
    icon: Compass,
    gradient: 'from-brand-primary/15 to-brand-primary/10',
    border: 'rgba(var(--brand-primary-rgb),0.35)',
    glow: 'rgba(var(--brand-primary-rgb),0.1)',
    accent: 'rgb(var(--brand-primary-rgb))',
  },
  building: {
    icon: Hammer,
    gradient: 'from-brand-primary/15 to-brand-primary/10',
    border: 'rgba(var(--brand-primary-rgb),0.35)',
    glow: 'rgba(var(--brand-primary-rgb),0.1)',
    accent: 'rgb(59,130,246)',
  },
  closing: {
    icon: Flag,
    gradient: 'from-brand-primary/15 to-brand-primary/10',
    border: 'rgba(16,185,129,0.35)',
    glow: 'rgba(16,185,129,0.1)',
    accent: 'rgb(16,185,129)',
  },
  stale: {
    icon: Sunrise,
    gradient: 'from-brand-primary/15 to-brand-primary/10',
    border: 'rgba(245,158,11,0.35)',
    glow: 'rgba(245,158,11,0.08)',
    accent: 'rgb(245,158,11)',
  },
  fresh: {
    icon: Zap,
    gradient: 'from-brand-primary/15 to-brand-primary/10',
    border: 'rgba(var(--brand-primary-rgb),0.35)',
    glow: 'rgba(var(--brand-primary-rgb),0.1)',
    accent: 'rgb(var(--brand-primary-rgb))',
  },
}

const MOMENTUM_LABELS: Record<Momentum, string> = {
  rising: 'Gaining speed',
  steady: 'Steady pace',
  fading: 'Slowing down',
  cold: 'On ice',
}

export function SessionBriefCard({ project, onOpenChat, onBriefLoaded }: SessionBriefCardProps) {
  const [brief, setBrief] = useState<SessionBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchBrief() {
      setLoading(true)
      setError(false)

      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/utilities?resource=session-brief&projectId=${project.id}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        )

        if (!res.ok) throw new Error(`${res.status}`)

        const data = await res.json()
        if (!cancelled) {
          setBrief(data)
          onBriefLoaded?.({
            phase: data.phase,
            focusSuggestion: data.focusSuggestion,
            knowledgeNudge: data.knowledgeNudge,
          })
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchBrief()
    return () => { cancelled = true }
  }, [project.id])

  // Loading skeleton
  if (loading) {
    return (
      <div
        className="rounded-2xl p-6 animate-pulse"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-xl bg-white/5" />
          <div className="h-3 w-24 rounded bg-white/5" />
        </div>
        <div className="h-5 w-3/4 rounded bg-white/5 mb-3" />
        <div className="h-4 w-1/2 rounded bg-white/4" />
      </div>
    )
  }

  // Error fallback — show a minimal static card
  if (error || !brief) {
    const tasks = (project.metadata?.tasks || []) as { done: boolean; text: string }[]
    const nextTask = tasks.find(t => !t.done)
    return (
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1.5px solid rgba(var(--brand-primary-rgb),0.2)',
        }}
      >
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--brand-text-primary)', opacity: 0.8 }}>
          {nextTask ? `Next up: ${nextTask.text}` : 'Ready when you are.'}
        </p>
      </div>
    )
  }

  const config = PHASE_CONFIG[brief.phase]
  const PhaseIcon = config.icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`rounded-2xl p-4 sm:p-6 relative overflow-hidden bg-gradient-to-br ${config.gradient}`}
        style={{
          border: `1.5px solid ${config.border}`,
          boxShadow: `0 0 32px ${config.glow}`,
        }}
      >
        {/* Phase + Momentum header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: `${config.accent}20`, border: `1px solid ${config.accent}30` }}
            >
              <PhaseIcon className="h-4 w-4" style={{ color: config.accent }} />
            </div>
            <span
              className="text-[10px] font-black uppercase tracking-[0.25em]"
              style={{ color: config.accent, opacity: 0.8 }}
            >
              {brief.phaseLabel}
            </span>
          </div>

          {brief.stats.totalTasks > 0 && (
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
              >
                {MOMENTUM_LABELS[brief.momentum]}
              </span>
              {/* Progress pip */}
              <div
                className="h-1.5 w-12 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: config.accent }}
                  initial={{ width: 0 }}
                  animate={{ width: `${brief.stats.progressPercent}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                />
              </div>
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: config.accent, opacity: 0.6 }}
              >
                {brief.stats.progressPercent}%
              </span>
            </div>
          )}
        </div>

        {/* AI Greeting */}
        <p
          className="text-[15px] sm:text-[19px] leading-relaxed font-medium mb-3"
          style={{ color: 'var(--brand-text-primary)' }}
        >
          {brief.greeting}
        </p>

        {/* Focus suggestion */}
        <div
          className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-3"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Zap className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: config.accent }} />
          <p
            className="text-[13px] sm:text-[14px] leading-snug"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            {brief.focusSuggestion}
          </p>
        </div>

        {/* Knowledge nudge */}
        {brief.knowledgeNudge && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            onClick={() => onOpenChat(brief.knowledgeNudge!)}
            className="flex items-center gap-2 text-left w-full px-3.5 py-3 rounded-xl transition-all hover:bg-white/[0.06] active:scale-[0.98] group min-h-[44px]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: config.accent }} />
            <span
              className="text-[13px] leading-snug flex-1"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              {brief.knowledgeNudge}
            </span>
            <ArrowRight
              className="h-4 w-4 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--brand-text-secondary)' }}
            />
          </motion.button>
        )}

        {/* Completed since last visit */}
        {brief.completedSinceLastVisit.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.2em] block mb-1.5"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}
            >
              Recent wins
            </span>
            <div className="flex flex-wrap gap-1.5">
              {brief.completedSinceLastVisit.slice(0, 3).map((text, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: `${config.accent}10`,
                    color: config.accent,
                    opacity: 0.5,
                    border: `1px solid ${config.accent}15`,
                  }}
                >
                  {text}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
