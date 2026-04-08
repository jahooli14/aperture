/**
 * WeeklyIntersection — The Medici Effect in your knowledge graph.
 *
 * "The most valuable companies, ideas, and breakthroughs emerge at the
 * intersection of previously unrelated fields." — Packy McCormick
 *
 * Finds where your projects collide in non-obvious ways: shared fuel
 * (memories/articles) that bridge multiple domains, scored by
 * projectCount × relevance. Now with pre-generated crossover ideas
 * and browsable top intersections.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { ArrowRight, RefreshCw, FileText, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

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
  score: number
  sharedFuel: IntersectionFuel[]
  reason?: string
  crossover?: CrossoverIdea
}

const STORAGE_KEY = 'polymath-weekly-intersections'
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const SWIPE_THRESHOLD = 50

function getStoredIntersections(): { data: Intersection[]; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function storeIntersections(data: Intersection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
}

export function WeeklyIntersection() {
  const [intersections, setIntersections] = useState<Intersection[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const stored = getStoredIntersections()
    if (stored && Date.now() - stored.fetchedAt < ONE_WEEK_MS) {
      setIntersections(stored.data)
      return
    }
    fetchIntersections()
  }, [])

  const fetchIntersections = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects?resource=intersections')
      if (!res.ok) return
      const data = await res.json()
      if (data.intersections?.length > 0) {
        setIntersections(data.intersections)
        storeIntersections(data.intersections)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  const onDragEnd = useCallback((_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD || intersections.length <= 1) return
    if (info.offset.x < 0) {
      setDirection(1)
      setActiveIdx(i => (i + 1) % intersections.length)
    } else {
      setDirection(-1)
      setActiveIdx(i => (i - 1 + intersections.length) % intersections.length)
    }
  }, [intersections.length])

  const current = intersections[activeIdx] || null
  const total = intersections.length

  if (dismissed || (!current && !loading)) return null

  return (
    <section className="pb-6">
      <h2 className="section-header">
        <span>intersection</span>
      </h2>

      {loading && !current ? (
        <div className="p-6 rounded-2xl border border-brand-primary/10 bg-brand-primary/5 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 text-brand-primary animate-spin" />
        </div>
      ) : current ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-brand-primary/15 bg-gradient-to-br from-brand-primary/5 to-brand-primary/5 relative overflow-hidden"
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(var(--brand-primary-rgb),0.06) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'premiumShimmer 4s linear infinite',
            }} />
          </div>

          <div className="p-5 relative z-10">
            {/* Carousel nav */}
            {total > 1 && (
              <div className="flex items-center justify-end gap-1 mb-3">
                <button
                  onClick={() => { setDirection(-1); setActiveIdx(i => (i - 1 + total) % total); setExpanded(false) }}
                  className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
                </button>
                <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-40 font-mono">
                  {activeIdx + 1}/{total}
                </span>
                <button
                  onClick={() => { setDirection(1); setActiveIdx(i => (i + 1) % total); setExpanded(false) }}
                  className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
                </button>
              </div>
            )}

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
                {/* Project names as intersection */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {current.projects.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-2">
                      {i > 0 && <span className="text-brand-primary font-bold">&times;</span>}
                      <Link
                        to={`/projects/${p.id}`}
                        className="text-sm font-semibold text-[var(--brand-text-primary)] hover:text-brand-primary transition-colors"
                      >
                        {p.title}
                      </Link>
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-brand-primary/60 font-mono">
                    {current.projects.length} domains
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

                {/* Expanded — Crossover idea + domain links */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mb-3"
                    >
                      <div className="pt-3 border-t border-[var(--glass-border)] space-y-4">
                        {/* Crossover idea */}
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

                        {/* Domain links */}
                        <div>
                          <p className="text-[10px] font-medium tracking-wide lowercase text-[var(--brand-text-muted)] mb-2">
                            explore each domain
                          </p>
                          {current.projects.map((p) => (
                            <Link
                              key={p.id}
                              to={`/projects/${p.id}`}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--glass-surface)] transition-colors group"
                            >
                              <span className="text-sm text-[var(--brand-text-secondary)] group-hover:text-[var(--brand-text-primary)] transition-colors">
                                {p.title}
                              </span>
                              <ArrowRight className="h-3 w-3 text-[var(--brand-text-muted)] group-hover:text-brand-primary transition-colors" />
                            </Link>
                          ))}
                        </div>

                        {/* Extra fuel items */}
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
                  <button
                    onClick={() => setDismissed(true)}
                    className="text-xs text-[var(--brand-text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </section>
  )
}
