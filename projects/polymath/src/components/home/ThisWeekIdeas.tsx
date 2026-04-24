/**
 * ThisWeekIdeas — one deck, five cards, one CTA.
 *
 * Replaces TrySomethingNewCarousel + WeeklyIntersection (mashups + insights).
 * All candidate ideas are merged, ranked, and capped at 5 so the homepage
 * has a single surface for "what should I make next?".
 *
 * Ranking:
 *   1. Weekly intersections (mashups — AI cross-domain observations)
 *   2. Weekly insights (pattern-only observations)
 *   3. AI suggestions from the synthesis pipeline
 *   4. Drawer projects (highest heat, not in focus)
 *
 * "Shape this idea" routes to:
 *   - intersections/insights: POST …&action=promote → navigate to new project
 *   - suggestions: CreateProjectDialog via onShapeIdea (seeded conversation)
 *   - drawer: jump to existing project detail
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, Layers, RefreshCw, Sparkles, ThumbsDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSuggestionStore } from '../../stores/useSuggestionStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { haptic } from '../../utils/haptics'

const SWIPE_THRESHOLD = 50
const MAX_IDEAS = 5

type CardKind = 'intersection' | 'insight' | 'suggestion' | 'drawer'

interface UnifiedCard {
  id: string
  kind: CardKind
  title: string
  pattern?: string
  experiment?: string
  description?: string
  firstSteps?: string[]
  sourceLabels?: string[]
  /** Raw backend IDs — used by shape handlers. */
  intersectionId?: string
  suggestionId?: string
  projectId?: string
}

interface IntersectionApiNode {
  id: string
  title: string
  type: 'project' | 'memory' | 'list_item'
}

interface IntersectionApiCard {
  id: string
  projectIds: string[]
  projects: Array<{ id: string; title: string }>
  nodes?: IntersectionApiNode[]
  reason?: string
  crossover?: {
    crossover_title?: string
    the_pattern?: string
    the_experiment?: string
    first_steps?: string[]
    why_it_works?: string
    concept?: string
  }
}

interface IntersectionApiResponse {
  intersections: IntersectionApiCard[]
  insights: IntersectionApiCard[]
  feedback: Record<string, 'good' | 'bad'>
  next_refresh_at: string | null
}

interface ThisWeekIdeasProps {
  onShapeSuggestion: (suggestion: { title: string; description: string }) => void
}

function intersectionToCard(c: IntersectionApiCard, kind: 'intersection' | 'insight'): UnifiedCard | null {
  const title = c.crossover?.crossover_title?.trim() || ''
  const pattern = (c.crossover?.the_pattern || c.crossover?.why_it_works || '').trim()
  const experiment = (c.crossover?.the_experiment || c.crossover?.concept || '').trim()
  if (!title || !pattern) return null

  const nodes = c.nodes && c.nodes.length > 0
    ? c.nodes
    : c.projects.map(p => ({ id: p.id, title: p.title, type: 'project' as const }))

  return {
    id: `ix-${c.id}`,
    kind,
    title,
    pattern,
    experiment,
    firstSteps: c.crossover?.first_steps?.slice(0, 2),
    sourceLabels: nodes.slice(0, 4).map(n => n.title),
    intersectionId: c.id,
  }
}

export function ThisWeekIdeas({ onShapeSuggestion }: ThisWeekIdeasProps) {
  const navigate = useNavigate()
  const suggestions = useSuggestionStore(s => s.suggestions)
  const allProjects = useProjectStore(s => s.allProjects)

  const showRegenerateInsights = useThemeStore(s => s.showRegenerateInsights)

  const [apiData, setApiData] = useState<IntersectionApiResponse | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [shapingId, setShapingId] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const inflight = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/projects?resource=intersections')
        if (res.ok) {
          const data = (await res.json()) as IntersectionApiResponse
          if (!cancelled) setApiData(data)
        }
      } catch {
        // non-fatal — we fall back to suggestion-only cards
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleRegenerate = useCallback(async () => {
    if (regenerating) return
    setRegenerating(true)
    haptic.light()
    try {
      const seed = await fetch('/api/projects?resource=intersections&action=seed&force=1', {
        method: 'POST',
      })
      if (!seed.ok) return
      const fresh = await fetch('/api/projects?resource=intersections')
      if (fresh.ok) {
        const data = (await fresh.json()) as IntersectionApiResponse
        setApiData(data)
        setIdx(0)
        setDismissed(new Set())
      }
    } catch {
      // swallow — the deck just stays stale
    } finally {
      setRegenerating(false)
    }
  }, [regenerating])

  const focusIds = useMemo(() => {
    const active = allProjects.filter(p =>
      ['active', 'upcoming'].includes(p.status) && p.status !== 'graveyard'
    )
    const priority = active.filter(p => p.is_priority)
    const recent = active
      .filter(p => !p.is_priority)
      .sort((a, b) => {
        const at = new Date(a.updated_at || a.last_active || '0').getTime()
        const bt = new Date(b.updated_at || b.last_active || '0').getTime()
        return bt - at
      })
    return new Set([...priority, ...recent].slice(0, 3).map(p => p.id))
  }, [allProjects])

  const cards: UnifiedCard[] = useMemo(() => {
    const feedback = apiData?.feedback ?? {}
    const out: UnifiedCard[] = []

    // 1. Intersections (skip those the user already rejected)
    for (const ix of apiData?.intersections ?? []) {
      if (feedback[ix.id] === 'bad') continue
      const c = intersectionToCard(ix, 'intersection')
      if (c) out.push(c)
    }
    // 2. Insights
    for (const ins of apiData?.insights ?? []) {
      if (feedback[ins.id] === 'bad') continue
      const c = intersectionToCard(ins, 'insight')
      if (c) out.push(c)
    }
    // 3. AI suggestions (dedupe against intersection titles to avoid doubles)
    const seenTitles = new Set(out.map(c => c.title.toLowerCase()))
    const relevantSuggestions = suggestions
      .filter(s => s.status === 'pending' || s.status === 'saved' || s.status === 'spark')
      .filter(s => !seenTitles.has(s.title.toLowerCase()))
      .sort((a, b) => new Date(b.suggested_at).getTime() - new Date(a.suggested_at).getTime())

    for (const s of relevantSuggestions) {
      if (out.length >= MAX_IDEAS) break
      // Synthesis now emits the same crossover shape as INSIGHT/MASHUP,
      // stored on metadata.crossover so no DB migration was needed. Read
      // it when present; fall back to legacy description/reasoning for
      // older rows.
      const crossover = s.metadata?.crossover as
        | {
            crossover_title?: string
            hook?: string
            the_pattern?: string
            the_experiment?: string
            first_steps?: string[]
          }
        | undefined
      const sourceSnippets =
        (s.metadata?.source_snippets as string[] | undefined) || []
      out.push({
        id: `sug-${s.id}`,
        kind: 'suggestion',
        title: crossover?.crossover_title?.trim() || s.title,
        pattern: (crossover?.the_pattern || s.synthesis_reasoning || '').trim() || undefined,
        experiment: crossover?.the_experiment?.trim() || undefined,
        firstSteps: crossover?.first_steps?.slice(0, 2),
        description: !crossover?.the_pattern ? s.description : undefined,
        sourceLabels: sourceSnippets.slice(0, 4),
        suggestionId: s.id,
      })
    }

    // 4. Drawer projects — only to fill empty slots
    const drawer = allProjects
      .filter(p =>
        !focusIds.has(p.id) &&
        p.status !== 'completed' &&
        p.status !== 'graveyard' &&
        p.status !== 'abandoned'
      )
      .sort((a, b) => (b.heat_score || 0) - (a.heat_score || 0))

    for (const p of drawer) {
      if (out.length >= MAX_IDEAS) break
      out.push({
        id: `proj-${p.id}`,
        kind: 'drawer',
        title: p.title,
        description: p.heat_reason || p.description || '',
        projectId: p.id,
      })
    }

    return out.slice(0, MAX_IDEAS).filter(c => !dismissed.has(c.id))
  }, [apiData, suggestions, allProjects, focusIds, dismissed])

  const total = cards.length
  const current = cards[idx] || null

  // Keep idx in range when the deck shrinks (e.g. after dismiss).
  useEffect(() => {
    if (idx > 0 && idx >= total) setIdx(Math.max(0, total - 1))
  }, [idx, total])

  const next = useCallback(() => {
    if (total <= 1) return
    setDirection(1)
    haptic.light()
    setIdx(i => (i + 1) % total)
  }, [total])

  const prev = useCallback(() => {
    if (total <= 1) return
    setDirection(-1)
    haptic.light()
    setIdx(i => (i - 1 + total) % total)
  }, [total])

  const onDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD) return
    if (info.offset.x < 0) next()
    else prev()
  }, [next, prev])

  const sendFeedback = useCallback(async (cardId: string, rating: 'good' | 'bad') => {
    const key = `${cardId}:${rating}`
    if (inflight.current.has(key)) return
    inflight.current.add(key)
    try {
      await fetch('/api/projects?resource=intersections&action=feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, rating }),
      })
    } catch {
      // swallow — feedback is best-effort
    } finally {
      inflight.current.delete(key)
    }
  }, [])

  const handleShape = useCallback(async () => {
    if (!current || shapingId) return
    haptic.medium()

    if (current.kind === 'drawer' && current.projectId) {
      navigate(`/projects/${current.projectId}`)
      return
    }

    if (current.kind === 'suggestion') {
      onShapeSuggestion({ title: current.title, description: current.description || '' })
      return
    }

    if ((current.kind === 'intersection' || current.kind === 'insight') && current.intersectionId) {
      setShapingId(current.id)
      try {
        const res = await fetch('/api/projects?resource=intersections&action=promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_id: current.intersectionId }),
        })
        if (!res.ok) { setShapingId(null); return }
        const data = (await res.json()) as { project_id?: string }
        if (data.project_id) navigate(`/projects/${data.project_id}`)
        else setShapingId(null)
      } catch {
        setShapingId(null)
      }
    }
  }, [current, shapingId, navigate, onShapeSuggestion])

  const handleDismiss = useCallback(() => {
    if (!current) return
    haptic.light()
    if (current.intersectionId) sendFeedback(current.intersectionId, 'bad')
    setDismissed(prev => new Set(prev).add(current.id))
  }, [current, sendFeedback])

  if (!loaded) return null

  if (total === 0) {
    return (
      <section className="pb-6">
        <h2 className="section-header">this <span>week</span></h2>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-5 text-center">
          <p className="text-sm text-[var(--brand-text-secondary)]">
            Ideas are cooking. Add voice notes and new crossovers will appear here.
          </p>
        </div>
      </section>
    )
  }

  // All three AI sources (intersection engine, synthesis, classic mashup)
  // now render with the same structure and the same label. The distinction
  // was cosmetic and inconsistent — users don't need three badges for three
  // internal pipelines that produce the same card.
  const kindLabel: Record<CardKind, string> = {
    intersection: 'insight',
    insight: 'insight',
    suggestion: 'insight',
    drawer: 'in the drawer',
  }
  const isShaping = current ? shapingId === current.id : false
  const domains = current?.sourceLabels?.length ?? 0
  const isRare = current?.kind !== 'drawer' && domains >= 3

  return (
    <section className="pb-6">
      <div className="flex items-end justify-between mb-2">
        <h2 className="section-header">this <span>week</span></h2>
        <div className="flex items-center gap-1">
          {showRegenerateInsights && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors disabled:opacity-50"
              aria-label={regenerating ? 'Regenerating this week' : 'Regenerate this week'}
              title={regenerating ? 'Regenerating…' : 'Regenerate this week'}
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-60 ${regenerating ? 'animate-spin' : ''}`} />
            </button>
          )}
          {total > 1 && (
            <>
              <button
                onClick={prev}
                className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
                aria-label="Previous idea"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-60" />
              </button>
              <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-50 font-mono">
                {idx + 1}/{total}
              </span>
              <button
                onClick={next}
                className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
                aria-label="Next idea"
              >
                <ChevronRight className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-60" />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: isRare
            ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.14) 0%, rgba(15,24,41,0.65) 60%)'
            : 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.08) 0%, rgba(15,24,41,0.55) 60%)',
          backdropFilter: 'blur(16px)',
          border: isRare
            ? '1px solid rgba(var(--brand-primary-rgb),0.42)'
            : '1px solid rgba(var(--brand-primary-rgb),0.2)',
          boxShadow: '0 0 30px rgba(var(--brand-primary-rgb),0.06), 0 4px 16px rgba(0,0,0,0.4)',
          minHeight: '300px',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.4), transparent)' }}
        />

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
              className="flex flex-col touch-pan-y"
              style={{ cursor: total > 1 ? 'grab' : undefined }}
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-primary/12 border border-brand-primary/25">
                  {current.kind === 'drawer' ? (
                    <Sparkles className="h-3 w-3 text-brand-primary/80" />
                  ) : (
                    <Layers className="h-3 w-3 text-brand-primary/80" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary/90">
                    {kindLabel[current.kind]}
                  </span>
                </span>
                {isRare && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
                    rare
                  </span>
                )}
                {current.sourceLabels && current.sourceLabels.length > 0 && (
                  <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-60 truncate">
                    {current.sourceLabels.join(' × ')}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-[var(--brand-text-primary)] leading-tight mb-3 aperture-header">
                {current.title}
              </h3>

              {current.pattern && (
                <div className="mb-3">
                  <p
                    className="text-[10px] font-semibold tracking-widest uppercase mb-1.5"
                    style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
                  >
                    the pattern
                  </p>
                  <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed">
                    {current.pattern}
                  </p>
                </div>
              )}

              {current.experiment && (
                <div className="mb-3">
                  <p
                    className="text-[10px] font-semibold tracking-widest uppercase mb-1.5"
                    style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
                  >
                    to try
                  </p>
                  <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed">
                    {current.experiment}
                  </p>
                </div>
              )}

              {!current.pattern && current.description && (
                <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-3 opacity-80">
                  {current.description}
                </p>
              )}

              {current.firstSteps && current.firstSteps.length > 0 && (
                <div className="mb-4">
                  <p
                    className="text-[10px] font-semibold tracking-widest uppercase mb-1.5"
                    style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
                  >
                    first steps
                  </p>
                  <div className="space-y-1">
                    {current.firstSteps.map((step, i) => (
                      <p
                        key={i}
                        className="text-xs text-[var(--brand-text-secondary)] opacity-75 flex items-start gap-2"
                      >
                        <span className="text-brand-primary opacity-60 mt-0.5 font-mono">{i + 1}.</span>
                        <span>{step}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={handleShape}
                  disabled={isShaping}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
                >
                  {isShaping ? 'Opening…' : current.kind === 'drawer' ? 'Open' : 'Shape this idea'}
                </button>
                {current.kind !== 'drawer' && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)] hover:bg-[var(--glass-surface)] transition-colors"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Not for me
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
