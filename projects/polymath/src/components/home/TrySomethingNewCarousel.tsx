/**
 * TrySomethingNewCarousel — Swipeable idea cards from synthesis + drawer + bedtime insights.
 * "Shape this idea" opens shaping conversation. Last card links to drawer.
 */

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, Wand2, Sparkles, ArrowRight } from 'lucide-react'
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
}

interface TrySomethingNewCarouselProps {
  onShapeIdea: (idea: IdeaItem) => void
}

export function TrySomethingNewCarousel({ onShapeIdea }: TrySomethingNewCarouselProps) {
  const allProjects = useProjectStore(s => s.allProjects)
  const suggestions = useSuggestionStore(s => s.suggestions)
  const fetchSuggestions = useSuggestionStore(s => s.fetchSuggestions)
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(1)

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

  // AI suggestions
  const aiIdeas: IdeaItem[] = suggestions
    .filter(s => s.status === 'pending' || s.status === 'saved' || s.status === 'spark')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(s => ({
      id: `sug-${s.id}`,
      title: s.title,
      description: s.description,
      reasoning: s.synthesis_reasoning,
      source: 'suggestion' as const,
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
            background: 'linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(15,24,41,0.5) 60%)',
            border: '1px solid rgba(168,85,247,0.12)',
            boxShadow: '0 0 30px rgba(168,85,247,0.04), 3px 3px 0 rgba(0,0,0,0.4)',
            minHeight: '220px',
          }}
        >
          <Sparkles className="h-8 w-8 opacity-30 mb-3" style={{ color: 'rgba(168,85,247,0.6)' }} />
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
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(15,24,41,0.5) 60%)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(168,85,247,0.12)',
          boxShadow: '0 0 30px rgba(168,85,247,0.04), 3px 3px 0 rgba(0,0,0,0.4)',
          minHeight: '280px',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.4), transparent)' }} />

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
              <div className="h-1 rounded-full mb-4 opacity-60" style={{ background: 'linear-gradient(90deg, var(--brand-primary), rgba(168,85,247,0.8))' }} />

              {current.source === 'suggestion' && (
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

              {/* Show reasoning/description */}
              <div className="flex-1 mb-4">
                {current.reasoning && (
                  <p className="text-xs text-[var(--brand-text-secondary)] leading-relaxed line-clamp-3 opacity-60 mb-2 italic">
                    {current.reasoning}
                  </p>
                )}
                <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed line-clamp-3 opacity-70">
                  {current.description}
                </p>
              </div>

              <button
                onClick={() => {
                  haptic.medium()
                  onShapeIdea(current)
                }}
                className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-[var(--glass-surface)]"
                style={{ border: '1px solid rgba(168,85,247,0.25)', color: 'rgba(168,85,247,0.8)' }}
              >
                <Sparkles className="h-3.5 w-3.5" />
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
