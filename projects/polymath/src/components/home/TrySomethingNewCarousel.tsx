/**
 * TrySomethingNewCarousel — Swipeable idea cards from synthesis + drawer + bedtime insights.
 * "Shape this idea" opens shaping conversation. Last card links to drawer.
 *
 * Intersection-sourced suggestions render as collision cards: showing which projects
 * collided, why it works, and the first actionable steps — matching the richness of
 * the WeeklyIntersection section they originated from.
 */

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSuggestionStore } from '../../stores/useSuggestionStore'
import { haptic } from '../../utils/haptics'

const SWIPE_THRESHOLD = 50
const MAX_IDEAS = 5

interface IdeaItem {
  id: string
  title: string
  description: string
  reasoning?: string
  source: 'suggestion' | 'drawer' | 'insight'
  projectId?: string // For drawer projects, the real project ID
  isIntersection?: boolean // True only for intersection-detector-sourced suggestions
  sourceProjectIds?: string[] // Project IDs that collided to produce this idea
  firstSteps?: string[] // Actionable next steps from the intersection crossover
}

interface TrySomethingNewCarouselProps {
  onShapeIdea: (idea: IdeaItem) => void
}

export function TrySomethingNewCarousel({ onShapeIdea }: TrySomethingNewCarouselProps) {
  const allProjects = useProjectStore(s => s.allProjects)
  const suggestions = useSuggestionStore(s => s.suggestions)
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(1)

  // Fast lookup: project ID → title (for rendering collision headers)
  const projectMap = React.useMemo(
    () => new Map(allProjects.map(p => [p.id, p.title])),
    [allProjects]
  )

  // Build focused project IDs (same logic as useFocusedProjects)
  const focusIds = React.useMemo(() => {
    const active = allProjects.filter(p =>
      ['active', 'upcoming'].includes(p.status) && p.status !== 'graveyard'
    )
    const priority = active.filter(p => p.is_priority)
    const recent = active
      .filter(p => !p.is_priority)
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.last_active || '0').getTime()
        const bTime = new Date(b.updated_at || b.last_active || '0').getTime()
        return bTime - aTime
      })
    return new Set([...priority, ...recent].slice(0, 3).map(p => p.id))
  }, [allProjects])

  // AI suggestions — intersection cards surfaced first, then by recency
  const aiIdeas: IdeaItem[] = suggestions
    .filter(s => s.status === 'pending' || s.status === 'saved' || s.status === 'spark')
    .sort((a, b) => {
      const aIsIntersection = a.metadata?.observation_basis === 'intersection'
      const bIsIntersection = b.metadata?.observation_basis === 'intersection'
      if (aIsIntersection && !bIsIntersection) return -1
      if (!aIsIntersection && bIsIntersection) return 1
      return new Date(b.suggested_at).getTime() - new Date(a.suggested_at).getTime()
    })
    .map(s => ({
      id: `sug-${s.id}`,
      title: s.title,
      description: s.description,
      reasoning: s.synthesis_reasoning,
      source: 'suggestion' as const,
      isIntersection: s.metadata?.observation_basis === 'intersection',
      sourceProjectIds: s.metadata?.observation_basis === 'intersection'
        ? (s.metadata?.source_project_ids as string[] | undefined)
        : undefined,
      firstSteps: s.metadata?.observation_basis === 'intersection'
        ? (s.metadata?.first_steps as string[] | undefined)
        : undefined,
    }))

  // Drawer projects (not in focus set, not completed/graveyard)
  const drawerIdeas: IdeaItem[] = allProjects
    .filter(p =>
      !focusIds.has(p.id) &&
      p.status !== 'completed' && p.status !== 'graveyard' && p.status !== 'abandoned'
    )
    .sort((a, b) => (b.heat_score || 0) - (a.heat_score || 0))
    .slice(0, 5)
    .map(p => ({
      id: `proj-${p.id}`,
      title: p.title,
      description: p.heat_reason || p.description || '',
      source: 'drawer' as const,
      projectId: p.id,
    }))

  const ideas = [...aiIdeas, ...drawerIdeas].slice(0, MAX_IDEAS)
  const total = ideas.length
  const current = ideas[idx] || null

  const onDragEnd = useCallback((_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD || total <= 1) return
    if (info.offset.x < 0) {
      setDirection(1)
      haptic.light()
      setIdx(i => (i + 1) % total)
    } else {
      setDirection(-1)
      haptic.light()
      setIdx(i => (i - 1 + total) % total)
    }
  }, [total])

  if (total === 0) {
    return (
      <div>
        <h2 className="section-header">try something <span>new</span></h2>
        <div
          className="rounded-2xl p-6 flex flex-col items-center justify-center text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.06) 0%, rgba(15,24,41,0.5) 60%)',
            border: '1px solid rgba(var(--brand-primary-rgb),0.15)',
            boxShadow: '0 0 30px rgba(var(--brand-primary-rgb),0.05), 0 4px 16px rgba(0,0,0,0.4)',
            minHeight: '220px',
          }}
        >
          <p className="text-sm font-medium text-[var(--brand-text-secondary)] opacity-60">No ideas yet</p>
          <p className="text-xs text-[var(--brand-text-secondary)] opacity-40 mt-1">Add voice notes to get ideas shaped for you</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="section-header">try something <span>new</span></h2>
      <div
        className="rounded-2xl p-5 flex flex-col overflow-hidden relative"
        style={(() => {
          const domains = current?.sourceProjectIds?.length ?? 0
          const isRare = current?.isIntersection && domains >= 3
          return {
            background: isRare
              ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.14) 0%, rgba(15,24,41,0.65) 60%)'
              : current?.isIntersection
                ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.6) 60%)'
                : 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.06) 0%, rgba(15,24,41,0.5) 60%)',
            backdropFilter: 'blur(16px)',
            border: isRare
              ? '1px solid rgba(var(--brand-primary-rgb),0.45)'
              : current?.isIntersection
                ? '1px solid rgba(var(--brand-primary-rgb),0.25)'
                : '1px solid rgba(var(--brand-primary-rgb),0.15)',
            boxShadow: isRare
              ? '0 0 40px rgba(var(--brand-primary-rgb),0.12), 0 4px 16px rgba(0,0,0,0.4)'
              : '0 0 30px rgba(var(--brand-primary-rgb),0.05), 0 4px 16px rgba(0,0,0,0.4)',
            minHeight: '300px',
            transition: 'border-color 0.3s, background 0.3s, box-shadow 0.3s',
          }
        })()}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.4), transparent)' }} />

        {total > 1 && (
          <div className="flex items-center justify-end gap-1 mb-3">
            <button
              onClick={() => { haptic.light(); setDirection(-1); setIdx(i => (i - 1 + total) % total) }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
            <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-40">{idx + 1}/{total}</span>
            <button
              onClick={() => { haptic.light(); setDirection(1); setIdx(i => (i + 1) % total) }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.2 }}
              drag={total > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={onDragEnd}
              className="flex flex-col flex-1 touch-pan-y"
              style={{ cursor: total > 1 ? 'grab' : undefined }}
            >
              <div className="h-1 rounded-full mb-4 opacity-60" style={{ background: 'var(--brand-primary)' }} />

              {/* Source badge / collision header */}
              {current.isIntersection && current.sourceProjectIds?.length ? (
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {current.sourceProjectIds.map((id, i) =>
                    i === 0 ? (
                      <span key={id} className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text-primary)] opacity-80">
                        {projectMap.get(id) ?? '—'}
                      </span>
                    ) : (
                      <span key={id} className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[var(--brand-primary)] font-bold text-sm leading-none">×</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text-primary)] opacity-80">
                          {projectMap.get(id) ?? '—'}
                        </span>
                      </span>
                    )
                  )}
                  <span className="ml-auto flex items-center gap-1.5 shrink-0">
                    {current.sourceProjectIds.length >= 3 && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(var(--brand-primary-rgb),0.15)',
                          color: 'var(--brand-primary)',
                          border: '1px solid rgba(var(--brand-primary-rgb),0.3)',
                        }}
                      >
                        rare
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--brand-primary)] opacity-60 font-mono">
                      {current.sourceProjectIds.length} domains
                    </span>
                  </span>
                </div>
              ) : current.source === 'suggestion' ? (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--brand-primary)] opacity-60">
                    AI synthesized
                  </span>
                </div>
              ) : null}

              <h3 className="text-lg font-bold text-[var(--brand-text-primary)] leading-tight mb-1 aperture-header line-clamp-2">
                {current.title}
              </h3>

              <div className="flex-1 mb-4">
                {current.isIntersection ? (
                  // Intersection card: why it works + first steps (description as fallback)
                  <>
                    {(current.reasoning || current.description) && (
                      <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed opacity-70 mb-3">
                        {current.reasoning || current.description}
                      </p>
                    )}
                    {current.firstSteps && current.firstSteps.length > 0 && (
                      <div className="space-y-1.5">
                        {current.firstSteps.slice(0, 2).map((step, i) => (
                          <p key={i} className="text-xs text-[var(--brand-text-secondary)] opacity-60 flex items-start gap-2">
                            <span className="text-[var(--brand-primary)] opacity-50 shrink-0 mt-0.5">{i + 1}.</span>
                            {step}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : current.reasoning && current.description ? (
                  // Synthesis card with both fields
                  <>
                    <p className="text-xs text-[var(--brand-text-secondary)] leading-relaxed opacity-60 mb-2 italic">
                      {current.reasoning}
                    </p>
                    <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed line-clamp-2 opacity-70">
                      {current.description}
                    </p>
                  </>
                ) : current.reasoning ? (
                  <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed line-clamp-4 opacity-70 italic">
                    {current.reasoning}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed line-clamp-4 opacity-70">
                    {current.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  haptic.medium()
                  onShapeIdea(current)
                }}
                className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-[var(--glass-surface)]"
                style={{ border: '1px solid rgba(var(--brand-primary-rgb),0.25)', color: 'var(--brand-primary)' }}
              >
                Shape this idea
              </button>

              <Link
                to="/projects/drawer"
                className="mt-3 text-center text-[10px] text-[var(--brand-text-secondary)] opacity-40 hover:opacity-70 transition-opacity flex items-center justify-center gap-1"
              >
                See more ideas
                <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export type { IdeaItem }
