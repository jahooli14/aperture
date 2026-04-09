/**
 * WeeklyIntersection — A/B test: classic mashups vs insight-driven crossovers.
 *
 * Single section with styled "inter·section" heading, containing two
 * swipeable card sets:
 *   - "mashups" — embedding-based discovery + AI narration (original approach)
 *   - "insights" — AI-primary structural pattern discovery (new approach)
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { ArrowRight, RefreshCw, FileText, MessageCircle, ChevronLeft, ChevronRight, Lightbulb, ListChecks, Folder } from 'lucide-react'
import { Link } from 'react-router-dom'

type NodeType = 'project' | 'memory' | 'list_item'

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
  nodes?: IntersectionNode[] // Preferred — supports mixed types
  score: number
  sharedFuel: IntersectionFuel[]
  reason?: string
  crossover?: CrossoverIdea
}

const STORAGE_KEY = 'polymath-weekly-intersections-v3'
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000 // A/B test: regenerate twice a day
const SWIPE_THRESHOLD = 50

/** Derive the unified node list, falling back to legacy `projects` field. */
function getNodes(i: Intersection): IntersectionNode[] {
  if (i.nodes && i.nodes.length > 0) return i.nodes
  return i.projects.map(p => ({ id: p.id, title: p.title, type: 'project' as const }))
}

interface CachedData {
  intersections: Intersection[]
  insights: Intersection[]
  fetchedAt: number
}

function getStoredData(): CachedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function storeData(intersections: Intersection[], insights: Intersection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ intersections, insights, fetchedAt: Date.now() }))
}

// --- Swipeable card set for a list of intersections ---

function CardSet({ items, label }: { items: Intersection[]; label: string }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [expanded, setExpanded] = useState(false)

  const total = items.length
  const current = items[activeIdx] || null

  const onDragEnd = useCallback((_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD || total <= 1) return
    if (info.offset.x < 0) {
      setDirection(1)
      setActiveIdx(i => (i + 1) % total)
      setExpanded(false)
    } else {
      setDirection(-1)
      setActiveIdx(i => (i - 1 + total) % total)
      setExpanded(false)
    }
  }, [total])

  if (!current) return null

  return (
    <div className="space-y-2">
      {/* Sub-label */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-widest uppercase text-[var(--brand-text-muted)]">
          {label}
        </span>
        {total > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setDirection(-1); setActiveIdx(i => (i - 1 + total) % total); setExpanded(false) }}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronLeft className="h-3 w-3 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
            <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-40 font-mono">
              {activeIdx + 1}/{total}
            </span>
            <button
              onClick={() => { setDirection(1); setActiveIdx(i => (i + 1) % total); setExpanded(false) }}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronRight className="h-3 w-3 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
          </div>
        )}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-brand-primary/25 bg-gradient-to-br from-brand-primary/8 to-brand-primary/[0.02] relative overflow-hidden"
        style={{
          boxShadow: '0 0 0 1px rgba(var(--brand-primary-rgb),0.08), 0 8px 40px -12px rgba(var(--brand-primary-rgb),0.25)'
        }}
      >
        {/* Shimmer layer 1 — wide sweep, brand color */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(100deg, transparent 20%, rgba(var(--brand-primary-rgb),0.18) 50%, transparent 80%)',
            backgroundSize: '250% 100%',
            animation: 'premiumShimmer 5s linear infinite',
          }} />
        </div>
        {/* Shimmer layer 2 — tighter bright streak, offset timing */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.08) 50%, transparent 58%)',
            backgroundSize: '250% 100%',
            animation: 'premiumShimmer 5s linear infinite',
            animationDelay: '1.2s',
          }} />
        </div>

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
              {/* Collision header — mixed node types with a clearer separator */}
              <div className="flex items-center gap-x-1.5 gap-y-2 mb-3 flex-wrap">
                {getNodes(current).map((node, i) => {
                  const Icon = node.type === 'project' ? Folder : node.type === 'memory' ? Lightbulb : ListChecks
                  const inner = (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-text-primary)]">
                      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${node.type === 'project' ? 'text-brand-primary/80' : 'text-brand-primary/60'}`} />
                      <span className="truncate max-w-[180px]">{node.title}</span>
                    </span>
                  )
                  return (
                    <span key={`${node.type}-${node.id}`} className="inline-flex items-center gap-1.5">
                      {i > 0 && (
                        <span
                          aria-hidden
                          className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-brand-primary/15 border border-brand-primary/30 text-brand-primary text-[13px] font-bold leading-none"
                          style={{ fontFamily: 'var(--brand-font-body)' }}
                        >
                          +
                        </span>
                      )}
                      {node.type === 'project' ? (
                        <Link
                          to={`/projects/${node.id}`}
                          className="hover:text-brand-primary transition-colors"
                        >
                          {inner}
                        </Link>
                      ) : inner}
                    </span>
                  )
                })}
                <span className="ml-auto text-[10px] text-brand-primary/60 font-mono tracking-wide uppercase">
                  {getNodes(current).length} {getNodes(current).length === 1 ? 'node' : 'nodes'}
                </span>
              </div>

              {/* AI reasoning */}
              {current.reason && (
                <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-3">
                  {current.reason}
                </p>
              )}

              {/* Shared fuel pills */}
              {current.sharedFuel.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {current.sharedFuel.slice(0, 4).map((fuel) => (
                    <span
                      key={fuel.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] text-[var(--brand-text-secondary)]"
                    >
                      {fuel.type === 'article' ? <FileText className="h-3 w-3 flex-shrink-0" /> : <MessageCircle className="h-3 w-3 flex-shrink-0" />}
                      <span className="truncate max-w-[120px]">{fuel.title}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded — Crossover detail */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-3"
                  >
                    <div className="pt-3 border-t border-[var(--glass-border)] space-y-4">
                      {current.crossover && (
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}>
                          <p className="text-[10px] font-medium tracking-wide lowercase mb-2" style={{ color: 'var(--brand-primary)', opacity: 0.6 }}>
                            crossover concept
                          </p>
                          <h4 className="text-base font-bold text-[var(--brand-text-primary)] mb-2">
                            {current.crossover.crossover_title}
                          </h4>
                          <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-2">
                            {current.crossover.why_it_works}
                          </p>
                          <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed opacity-80 mb-3">
                            {current.crossover.concept}
                          </p>
                          {current.crossover.first_steps.length > 0 && (
                            <div className="space-y-1">
                              {current.crossover.first_steps.map((step, i) => (
                                <p key={i} className="text-xs text-[var(--brand-text-secondary)] opacity-60 flex items-start gap-2">
                                  <span className="text-brand-primary opacity-50 mt-0.5">{i + 1}.</span>
                                  {step}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-medium tracking-wide lowercase text-[var(--brand-text-muted)] mb-2">
                          what's colliding here
                        </p>
                        {getNodes(current).map((node) => {
                          const Icon = node.type === 'project' ? Folder : node.type === 'memory' ? Lightbulb : ListChecks
                          const typeLabel = node.type === 'project' ? 'project' : node.type === 'memory' ? 'thought' : 'list item'
                          const row = (
                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--glass-surface)] transition-colors group">
                              <span className="flex items-center gap-2 min-w-0">
                                <Icon className="h-3.5 w-3.5 text-brand-primary/60 flex-shrink-0" />
                                <span className="text-sm text-[var(--brand-text-secondary)] group-hover:text-[var(--brand-text-primary)] transition-colors truncate">
                                  {node.title}
                                </span>
                                <span className="text-[9px] uppercase tracking-wide text-[var(--brand-text-muted)] opacity-60 flex-shrink-0">
                                  {typeLabel}
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

                      {current.sharedFuel.length > 4 && (
                        <div>
                          <p className="text-[10px] font-medium tracking-wide lowercase text-[var(--brand-text-muted)] mb-2">
                            all bridging ideas ({current.sharedFuel.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {current.sharedFuel.slice(4).map((fuel) => (
                              <span
                                key={fuel.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] text-[var(--brand-text-secondary)]"
                              >
                                {fuel.type === 'article' ? <FileText className="h-3 w-3 flex-shrink-0" /> : <MessageCircle className="h-3 w-3 flex-shrink-0" />}
                                <span className="truncate max-w-[140px]">{fuel.title}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:text-brand-primary transition-colors"
                >
                  {expanded ? 'Less' : 'Explore'}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// --- Main component ---

export function WeeklyIntersection() {
  const [intersections, setIntersections] = useState<Intersection[]>([])
  const [insights, setInsights] = useState<Intersection[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = getStoredData()
    if (stored && Date.now() - stored.fetchedAt < TWELVE_HOURS_MS) {
      setIntersections(stored.intersections || [])
      setInsights(stored.insights || [])
      return
    }
    // Clear old cache keys
    localStorage.removeItem('polymath-weekly-intersections')
    localStorage.removeItem('polymath-weekly-intersections-v2')
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects?resource=intersections')
      if (!res.ok) return
      const data = await res.json()
      const newIntersections = data.intersections || []
      const newInsights = data.insights || []
      setIntersections(newIntersections)
      setInsights(newInsights)
      if (newIntersections.length > 0 || newInsights.length > 0) {
        storeData(newIntersections, newInsights)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  const hasData = intersections.length > 0 || insights.length > 0

  if (!hasData && !loading) return null

  return (
    <section className="pb-6">
      {/* Section heading: "inter" in white (default), "section" in primary (via .section-header span rule) */}
      <h2 className="section-header">inter<span>section</span></h2>

      {loading && !hasData ? (
        <div className="p-6 rounded-2xl border border-brand-primary/10 bg-brand-primary/5 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 text-brand-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {intersections.length > 0 && (
            <CardSet items={intersections} label="mashups" />
          )}
          {insights.length > 0 && (
            <CardSet items={insights} label="insights" />
          )}
        </div>
      )}
    </section>
  )
}
