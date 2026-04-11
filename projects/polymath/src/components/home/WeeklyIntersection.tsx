/**
 * WeeklyIntersection — weekly-refresh feedback deck.
 *
 * Cards are generated once a week by the cron (api/_lib/intersection-weekly.ts),
 * persisted to Supabase, and served instantly from /api/projects?resource=intersections.
 * The user can:
 *   - "Shape this idea" (good signal) — promotes the card to a real upcoming
 *     project and navigates to its detail page so they can develop the idea
 *     via the same chat (InlineGuide) used for any other project.
 *   - "Not for me" (bad signal) — greys the card in place and steers the
 *     next week's prompts away from similar themes.
 *
 * A countdown badge in the section header builds anticipation for the
 * weekly refresh.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import {
  ArrowRight,
  FileText,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  ListChecks,
  Folder,
  Layers,
  ThumbsDown,
  Sparkles,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

type NodeType = 'project' | 'memory' | 'list_item'
type FeedbackRating = 'good' | 'bad'

interface IntersectionNode {
  id: string
  title: string
  type: NodeType
}

interface IntersectionProject {
  id: string
  title: string
}

interface IntersectionFuel {
  type: 'memory' | 'article'
  title: string
  id: string
}

interface CrossoverIdea {
  crossover_title: string
  why_it_works: string
  concept: string
  first_steps: string[]
}

interface Intersection {
  id: string
  projectIds: string[]
  projects: IntersectionProject[]
  nodes?: IntersectionNode[]
  score: number
  sharedFuel: IntersectionFuel[]
  reason?: string
  crossover?: CrossoverIdea
}

interface ApiResponse {
  intersections: Intersection[]
  insights: Intersection[]
  feedback: Record<string, FeedbackRating>
  generated_at: string | null
  expires_at: string | null
  next_refresh_at: string | null
}

const SWIPE_THRESHOLD = 50

function getNodes(i: Intersection): IntersectionNode[] {
  if (i.nodes && i.nodes.length > 0) return i.nodes
  return i.projects.map(p => ({ id: p.id, title: p.title, type: 'project' as const }))
}

// ---------- Countdown helpers ----------

interface CountdownParts {
  label: string
  soon: boolean
  expired: boolean
}

function formatCountdown(target: Date, now: Date = new Date()): CountdownParts {
  const ms = target.getTime() - now.getTime()
  if (ms <= 0) return { label: 'now', soon: true, expired: true }
  const mins = Math.floor(ms / (60 * 1000))
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const soon = ms < 24 * 60 * 60 * 1000
  if (days >= 1) return { label: `${days}d ${hours % 24}h`, soon: false, expired: false }
  if (hours >= 1) return { label: `${hours}h ${mins % 60}m`, soon, expired: false }
  return { label: `${mins}m`, soon, expired: false }
}

function useCountdown(target: string | null): CountdownParts | null {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    if (!target) return
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000)
    return () => window.clearInterval(id)
  }, [target])
  return useMemo(() => {
    if (!target) return null
    return formatCountdown(new Date(target), now)
  }, [target, now])
}

// ---------- Card set ----------

interface CardSetProps {
  items: Intersection[]
  label: string
  feedback: Record<string, FeedbackRating>
  onFeedback: (cardId: string, rating: FeedbackRating) => void
  onShape: (cardId: string) => void
  shapingId: string | null
}

function CardSet({ items, label, feedback, onFeedback, onShape, shapingId }: CardSetProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [nodesExpanded, setNodesExpanded] = useState(false)

  const total = items.length
  const current = items[activeIdx] || null
  const currentFeedback = current ? feedback[current.id] : undefined
  const isDisliked = currentFeedback === 'bad'
  const isLiked = currentFeedback === 'good'
  const isShaping = current ? shapingId === current.id : false

  const onDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD || total <= 1) return
    if (info.offset.x < 0) {
      setDirection(1)
      setActiveIdx(i => (i + 1) % total)
    } else {
      setDirection(-1)
      setActiveIdx(i => (i - 1 + total) % total)
    }
    setNodesExpanded(false)
  }, [total])

  const handleShape = useCallback(() => {
    if (!current || isShaping) return
    onShape(current.id)
  }, [current, isShaping, onShape])

  const handleDislike = useCallback(() => {
    if (!current) return
    onFeedback(current.id, 'bad')
  }, [current, onFeedback])

  if (!current) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-widest uppercase text-[var(--brand-text-muted)]">
          {label}
        </span>
        {total > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setDirection(-1)
                setActiveIdx(i => (i - 1 + total) % total)
                setNodesExpanded(false)
              }}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
              aria-label="Previous card"
            >
              <ChevronLeft className="h-3 w-3 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
            <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-40 font-mono">
              {activeIdx + 1}/{total}
            </span>
            <button
              onClick={() => {
                setDirection(1)
                setActiveIdx(i => (i + 1) % total)
                setNodesExpanded(false)
              }}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
              aria-label="Next card"
            >
              <ChevronRight className="h-3 w-3 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: isDisliked ? 0.55 : 1, y: 0 }}
        className="rounded-2xl border border-brand-primary/25 bg-gradient-to-br from-brand-primary/8 to-brand-primary/[0.02] relative overflow-hidden"
        style={{
          boxShadow: isDisliked
            ? 'none'
            : '0 0 0 1px rgba(var(--brand-primary-rgb),0.08), 0 8px 40px -12px rgba(var(--brand-primary-rgb),0.25)',
          filter: isDisliked ? 'grayscale(0.8)' : undefined,
        }}
      >
        {!isDisliked && (
          <>
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(100deg, transparent 20%, rgba(var(--brand-primary-rgb),0.18) 50%, transparent 80%)',
                backgroundSize: '250% 100%',
                animation: 'premiumShimmer 5s linear infinite',
              }} />
            </div>
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.08) 50%, transparent 58%)',
                backgroundSize: '250% 100%',
                animation: 'premiumShimmer 5s linear infinite',
                animationDelay: '1.2s',
              }} />
            </div>
          </>
        )}

        <div className="p-5 relative z-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -30 }}
              transition={{ duration: 0.2 }}
              drag={total > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={onDragEnd}
              className="touch-pan-y"
            >
              {isDisliked && (
                <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                  <ThumbsDown className="h-3 w-3 text-[var(--brand-text-muted)]" />
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--brand-text-muted)]">
                    not for me
                  </span>
                </div>
              )}
              {isLiked && !isDisliked && (
                <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-primary/15 border border-brand-primary/30">
                  <Sparkles className="h-3 w-3 text-brand-primary" />
                  <span className="text-[10px] font-medium uppercase tracking-wide text-brand-primary">
                    shaping in projects
                  </span>
                </div>
              )}

              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setNodesExpanded(v => !v)}
                  className="inline-flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/25 hover:bg-brand-primary/15 transition-colors disabled:hover:bg-brand-primary/10"
                  aria-expanded={nodesExpanded}
                  disabled={isDisliked}
                >
                  <Layers className="h-3.5 w-3.5 text-brand-primary/80" />
                  <span className="text-[11px] font-mono tracking-wide uppercase text-brand-primary/90">
                    {getNodes(current).length} {getNodes(current).length === 1 ? 'item' : 'items'}
                  </span>
                  <ChevronDown className={`h-3 w-3 text-brand-primary/60 transition-transform ${nodesExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {nodesExpanded && !isDisliked && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 mb-3">
                      {getNodes(current).map((node) => {
                        const Icon =
                          node.type === 'project' ? Folder : node.type === 'memory' ? Lightbulb : ListChecks
                        const row = (
                          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--glass-surface)] transition-colors group">
                            <span className="flex items-center gap-2 min-w-0">
                              <Icon className="h-3.5 w-3.5 text-brand-primary/70 flex-shrink-0" />
                              <span className="text-sm font-medium text-[var(--brand-text-primary)] truncate">
                                {node.title}
                              </span>
                            </span>
                            {node.type === 'project' && (
                              <ArrowRight className="h-3 w-3 text-[var(--brand-text-muted)] group-hover:text-brand-primary transition-colors flex-shrink-0" />
                            )}
                          </div>
                        )
                        return node.type === 'project' ? (
                          <Link key={`${node.type}-${node.id}`} to={`/projects/${node.id}`}>
                            {row}
                          </Link>
                        ) : (
                          <div key={`${node.type}-${node.id}`}>{row}</div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {current.reason && (
                <p className="text-[15px] text-[var(--brand-text-primary)] leading-relaxed mb-3">
                  {current.reason}
                </p>
              )}

              {!isDisliked && current.crossover && (
                <div
                  className="mb-3 p-4 rounded-xl"
                  style={{
                    background: 'rgba(var(--brand-primary-rgb),0.06)',
                    border: '1px solid rgba(var(--brand-primary-rgb),0.15)',
                  }}
                >
                  <p
                    className="text-[10px] font-medium tracking-wide lowercase mb-2"
                    style={{ color: 'var(--brand-primary)', opacity: 0.6 }}
                  >
                    crossover concept
                  </p>
                  <h4 className="text-base font-bold text-[var(--brand-text-primary)] mb-2">
                    {current.crossover.crossover_title}
                  </h4>
                  <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-2">
                    {current.crossover.why_it_works}
                  </p>
                  <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed opacity-80">
                    {current.crossover.concept}
                  </p>
                  {current.crossover.first_steps.length > 0 && (
                    <div className="space-y-1 mt-3">
                      {current.crossover.first_steps.map((step, i) => (
                        <p
                          key={i}
                          className="text-xs text-[var(--brand-text-secondary)] opacity-60 flex items-start gap-2"
                        >
                          <span className="text-brand-primary opacity-50 mt-0.5">{i + 1}.</span>
                          {step}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isDisliked && current.sharedFuel.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-medium tracking-wide lowercase text-[var(--brand-text-muted)] mb-2">
                    bridging ideas ({current.sharedFuel.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {current.sharedFuel.map((fuel) => (
                      <span
                        key={fuel.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] text-[var(--brand-text-secondary)]"
                      >
                        {fuel.type === 'article' ? (
                          <FileText className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <MessageCircle className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[140px]">{fuel.title}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!isDisliked && (
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={handleShape}
                    disabled={isShaping}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isShaping ? 'Opening…' : 'Shape this idea'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDislike}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)] hover:bg-[var(--glass-surface)] transition-colors"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Not for me
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// ---------- Main component ----------

export function WeeklyIntersection() {
  const navigate = useNavigate()
  const [intersections, setIntersections] = useState<Intersection[]>([])
  const [insights, setInsights] = useState<Intersection[]>([])
  const [feedback, setFeedback] = useState<Record<string, FeedbackRating>>({})
  const [nextRefreshAt, setNextRefreshAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [shapingId, setShapingId] = useState<string | null>(null)
  const inflightFeedback = useRef(new Set<string>())

  useEffect(() => {
    // Clean up old client-side caches from the previous on-demand era.
    try {
      localStorage.removeItem('polymath-weekly-intersections')
      localStorage.removeItem('polymath-weekly-intersections-v2')
      localStorage.removeItem('polymath-weekly-intersections-v3')
      localStorage.removeItem('polymath-weekly-intersections-v4')
    } catch {
      // ignore
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/projects?resource=intersections')
        if (!res.ok) {
          console.warn('[WeeklyIntersection] fetch failed', res.status)
          if (!cancelled) setLoaded(true)
          return
        }
        const data = (await res.json()) as ApiResponse
        if (cancelled) return
        setIntersections(data.intersections || [])
        setInsights(data.insights || [])
        setFeedback(data.feedback || {})
        setNextRefreshAt(data.next_refresh_at)
        setLoaded(true)
      } catch (err) {
        console.warn('[WeeklyIntersection] fetch error', err)
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleFeedback = useCallback(async (cardId: string, rating: FeedbackRating) => {
    setFeedback(prev => ({ ...prev, [cardId]: rating }))
    const dedupeKey = `${cardId}:${rating}`
    if (inflightFeedback.current.has(dedupeKey)) return
    inflightFeedback.current.add(dedupeKey)
    try {
      await fetch('/api/projects?resource=intersections&action=feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, rating }),
      })
    } catch (err) {
      console.warn('[WeeklyIntersection] feedback failed', err)
    } finally {
      inflightFeedback.current.delete(dedupeKey)
    }
  }, [])

  const handleShape = useCallback(async (cardId: string) => {
    if (shapingId) return
    setShapingId(cardId)
    setFeedback(prev => ({ ...prev, [cardId]: 'good' }))
    try {
      const res = await fetch('/api/projects?resource=intersections&action=promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId }),
      })
      if (!res.ok) {
        console.warn('[WeeklyIntersection] promote failed', res.status)
        setShapingId(null)
        return
      }
      const data = (await res.json()) as { project_id?: string }
      if (data.project_id) {
        navigate(`/projects/${data.project_id}`)
      } else {
        setShapingId(null)
      }
    } catch (err) {
      console.warn('[WeeklyIntersection] promote error', err)
      setShapingId(null)
    }
  }, [shapingId, navigate])

  const countdown = useCountdown(nextRefreshAt)
  const hasData = intersections.length > 0 || insights.length > 0

  if (!loaded) return null

  // No row at all → hide the section. Empty row with a refresh date → render
  // the heading + countdown placeholder so the user knows something's coming.
  if (!hasData && !nextRefreshAt) return null

  return (
    <section className="pb-6">
      <div className="flex items-end justify-between mb-2">
        <h2 className="section-header">inter<span>section</span></h2>
        {countdown && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wide border ${
              countdown.soon
                ? 'border-brand-primary/40 text-brand-primary bg-brand-primary/10 animate-pulse'
                : 'border-[var(--glass-border)] text-[var(--brand-text-muted)] bg-[var(--glass-surface)]'
            }`}
            title={countdown.soon ? 'New cards arriving soon!' : `Next refresh in ${countdown.label}`}
          >
            {countdown.expired
              ? 'refreshing…'
              : countdown.soon
                ? `new in ${countdown.label} — soon!`
                : `new in ${countdown.label}`}
          </span>
        )}
      </div>

      {hasData ? (
        <div className="space-y-5">
          {intersections.length > 0 && (
            <CardSet
              items={intersections}
              label="mashups"
              feedback={feedback}
              onFeedback={handleFeedback}
              onShape={handleShape}
              shapingId={shapingId}
            />
          )}
          {insights.length > 0 && (
            <CardSet
              items={insights}
              label="insights"
              feedback={feedback}
              onFeedback={handleFeedback}
              onShape={handleShape}
              shapingId={shapingId}
            />
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-5 text-center">
          <p className="text-sm text-[var(--brand-text-secondary)]">
            Ideas are cooking. New crossovers
            {countdown ? ` in ${countdown.label}` : ' soon'}.
          </p>
        </div>
      )}
    </section>
  )
}
