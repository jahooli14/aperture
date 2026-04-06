/**
 * NetflixHeroCards — Dual side-by-side hero cards on the home page
 *
 * Left: "Keep going" — up to 3 active/priority projects to continue
 * Right: "Try something new" — saved ideas ready to act on
 *
 * On narrow mobile: stacked vertically. On tablet/desktop: side by side.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, ChevronLeft, ChevronRight, Zap, ArrowRight, Wand2 } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSuggestionStore } from '../../stores/useSuggestionStore'
import { getTheme } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'
import type { Project } from '../../types'

const FOCUS_CAP = 3

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'not started yet'
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function KeepGoingCard() {
  const navigate = useNavigate()
  const { allProjects } = useProjectStore()
  const [idx, setIdx] = useState(0)

  const activeProjects = allProjects.filter(p => ['active', 'upcoming', 'maintaining'].includes(p.status))
  const pinned = activeProjects.filter(p => p.is_priority).slice(0, FOCUS_CAP)
  const slots: (Project | null)[] = [...pinned]

  // Auto-fill empty slots with most recently active
  if (slots.length < FOCUS_CAP) {
    const pinnedIds = new Set(slots.map(p => p?.id))
    const recent = [...activeProjects]
      .filter(p => !p.is_priority && !pinnedIds.has(p.id))
      .sort((a, b) => new Date(b.last_active || b.updated_at || b.created_at).getTime() - new Date(a.last_active || a.updated_at || a.created_at).getTime())
      .slice(0, FOCUS_CAP - slots.length)
    slots.push(...recent)
  }

  // Pad to show empty state if truly no projects
  while (slots.length === 0) break

  const current = slots[idx] || null
  const total = slots.length

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6 text-center">
        <Zap className="h-8 w-8 text-[var(--brand-primary)] opacity-30 mb-3" />
        <p className="text-sm font-medium text-[var(--brand-text-secondary)] opacity-60">No active projects yet</p>
        <button
          onClick={() => navigate('/projects')}
          className="mt-3 text-xs text-[var(--brand-primary)] opacity-70 hover:opacity-100 transition-opacity underline"
        >
          Start one
        </button>
      </div>
    )
  }

  const theme = current ? getTheme(current.type || 'other', current.title) : { text: '#63B3ED', rgb: '99,179,237' }
  const nextStep = current?.metadata?.next_step || current?.metadata?.tasks?.find((t: any) => !t.done)?.text || 'Continue where you left off'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-text-secondary)] opacity-50">
          keep going
        </span>
        {total > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { haptic.light(); setIdx(i => (i - 1 + total) % total) }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
            <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-40">{idx + 1}/{total}</span>
            <button
              onClick={() => { haptic.light(); setIdx(i => (i + 1) % total) }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1"
          >
            {/* Project colour accent */}
            <div className="h-1 rounded-full mb-4 opacity-60" style={{ background: theme.text }} />

            <h3 className="text-lg font-bold text-[var(--brand-text-primary)] leading-tight mb-1 aperture-header line-clamp-2">
              {current.title}
            </h3>
            <p className="text-[11px] text-[var(--brand-text-secondary)] opacity-40 mb-3">
              {formatRelativeTime(current.last_active || current.updated_at)}
            </p>

            {/* What's next */}
            <div className="flex-1 p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text-secondary)] opacity-40 mb-1">What's next</p>
              <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed line-clamp-3">{nextStep}</p>
            </div>

            <button
              onClick={() => {
                haptic.medium()
                navigate(`/projects/${current.id}`)
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110"
              style={{ background: theme.text, color: 'black', boxShadow: `0 4px 16px rgba(${theme.rgb},0.2)` }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Start session
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Unified idea item — either an unstarted project (upcoming, not priority)
 * or an AI-generated intersection suggestion (pending/saved).
 */
interface IdeaItem {
  id: string
  title: string
  description: string
  isAISuggestion: boolean
  /** For projects: has it been reshaped? For suggestions: always true. */
  hasEvolved: boolean
  navigateTo: string
  sortKey: number // ms timestamp, higher = more recent
}

function TrySomethingNewCard() {
  const navigate = useNavigate()
  const { allProjects } = useProjectStore()
  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const [idx, setIdx] = useState(0)

  // Fetch AI suggestions once on mount
  React.useEffect(() => { fetchSuggestions() }, [fetchSuggestions])

  // Unstarted project ideas — upcoming status, not priority (idea has been considered but never started)
  const unstartedProjects: IdeaItem[] = allProjects
    .filter(p => p.status === 'upcoming' && !p.is_priority)
    .map(p => ({
      id: `proj-${p.id}`,
      title: p.title,
      description: p.description || 'An idea waiting to be explored.',
      isAISuggestion: false,
      hasEvolved: !!(p.metadata?.versions?.length),
      navigateTo: `/projects/${p.id}`,
      sortKey: new Date(p.metadata?.versions?.at(-1)?.created_at || p.updated_at || p.created_at).getTime(),
    }))

  // AI intersection suggestions — pending or saved, not yet built
  const aiSuggestions: IdeaItem[] = suggestions
    .filter(s => s.status === 'pending' || s.status === 'saved' || s.status === 'spark')
    .map(s => ({
      id: `sug-${s.id}`,
      title: s.title,
      description: s.description,
      isAISuggestion: true,
      hasEvolved: true,
      navigateTo: '/projects/drawer',
      sortKey: new Date(s.created_at).getTime(),
    }))

  // Merge: AI suggestions first (most recent), then unstarted projects (most evolved/recent)
  const ideas: IdeaItem[] = [
    ...aiSuggestions.sort((a, b) => b.sortKey - a.sortKey),
    ...unstartedProjects.sort((a, b) => b.sortKey - a.sortKey),
  ].slice(0, 6)

  const total = ideas.length
  const current = ideas[idx] || null

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6 text-center">
        <p className="text-sm font-medium text-[var(--brand-text-secondary)] opacity-60">No saved ideas yet</p>
        <p className="text-xs text-[var(--brand-text-secondary)] opacity-40 mt-1">Add voice notes to get ideas shaped for you</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-text-secondary)] opacity-50">
          try something new
        </span>
        {total > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { haptic.light(); setIdx(i => (i - 1 + total) % total) }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
            <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-40">{idx + 1}/{total}</span>
            <button
              onClick={() => { haptic.light(); setIdx(i => (i + 1) % total) }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1"
          >
            <div className="h-1 rounded-full mb-4 opacity-60" style={{ background: 'linear-gradient(90deg, var(--brand-primary), rgba(168,85,247,0.8))' }} />

            {/* AI suggestion badge */}
            {current.isAISuggestion && (
              <div className="flex items-center gap-1.5 mb-2">
                <Wand2 className="h-3 w-3" style={{ color: 'var(--brand-primary)', opacity: 0.6 }} />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-primary)', opacity: 0.6 }}>
                  AI intersection
                </span>
              </div>
            )}

            <h3 className="text-lg font-bold text-[var(--brand-text-primary)] leading-tight mb-1 aperture-header line-clamp-2">
              {current.title}
            </h3>
            <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-4 line-clamp-3 opacity-70">
              {current.description}
            </p>

            <div className="flex-1" />

            <button
              onClick={() => { haptic.medium(); navigate(current.navigateTo) }}
              className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-[var(--glass-surface)]"
              style={{ border: '1px solid rgba(99,179,237,0.2)', color: 'var(--brand-primary)' }}
            >
              <Zap className="h-3.5 w-3.5" />
              Explore idea
            </button>

            <Link
              to="/projects/drawer"
              className="mt-3 text-center text-[10px] text-[var(--brand-text-secondary)] opacity-40 hover:opacity-70 transition-opacity flex items-center justify-center gap-1"
            >
              See all saved ideas
              <ArrowRight className="h-3 w-3" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function NetflixHeroCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Keep going */}
      <div
        className="rounded-2xl p-5 flex flex-col"
        style={{
          background: 'var(--brand-glass-bg)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
          minHeight: '280px',
        }}
      >
        <KeepGoingCard />
      </div>

      {/* Try something new */}
      <div
        className="rounded-2xl p-5 flex flex-col"
        style={{
          background: 'var(--brand-glass-bg)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
          minHeight: '280px',
        }}
      >
        <TrySomethingNewCard />
      </div>
    </div>
  )
}
