/**
 * WeeklyIntersection — The Medici Effect in your knowledge graph.
 *
 * "The most valuable companies, ideas, and breakthroughs emerge at the
 * intersection of previously unrelated fields." — Packy McCormick
 *
 * Finds where your projects collide in non-obvious ways: shared fuel
 * (memories/articles) that bridge multiple domains, scored by
 * projectCount × relevance. The best ideas live between fields,
 * not within them.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, RefreshCw, FileText, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
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

interface Intersection {
  id: string
  projectIds: string[]
  projects: IntersectionProject[]
  score: number
  sharedFuel: IntersectionFuel[]
  reason?: string
}

const STORAGE_KEY = 'polymath-weekly-intersection'
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

function getStoredIntersection(): { data: Intersection; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function storeIntersection(data: Intersection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
}

export function WeeklyIntersection() {
  const [intersection, setIntersection] = useState<Intersection | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const stored = getStoredIntersection()
    if (stored && Date.now() - stored.fetchedAt < ONE_WEEK_MS) {
      setIntersection(stored.data)
      return
    }
    fetchIntersection()
  }, [])

  const fetchIntersection = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects?resource=intersections')
      if (!res.ok) return
      const data = await res.json()
      if (data.intersections?.length > 0) {
        const top = data.intersections[0]
        setIntersection(top)
        storeIntersection(top)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  if (dismissed || (!intersection && !loading)) return null

  return (
    <section className="pb-6">
      <h2 className="section-header">
        <span>intersection</span>
      </h2>

      {loading && !intersection ? (
        <div className="p-6 rounded-2xl border border-brand-primary/10 bg-brand-primary/5 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 text-brand-primary animate-spin" />
        </div>
      ) : intersection ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl border border-brand-primary/15 bg-gradient-to-br from-brand-primary/5 to-brand-primary/5"
        >
          {/* Project names as intersection */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {intersection.projects.map((p, i) => (
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
              {intersection.projects.length} domains colliding
            </span>
          </div>

          {/* AI reasoning */}
          {intersection.reason && (
            <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-3">
              {intersection.reason}
            </p>
          )}

          {/* Shared fuel — the ideas bridging domains */}
          {intersection.sharedFuel.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {intersection.sharedFuel.slice(0, 4).map((fuel) => (
                <span
                  key={fuel.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] text-[var(--brand-text-secondary)]"
                >
                  {fuel.type === 'article' ? <FileText className="h-3 w-3 flex-shrink-0" /> : <MessageCircle className="h-3 w-3 flex-shrink-0" />} {fuel.title.length > 30 ? fuel.title.substring(0, 30) + '...' : fuel.title}
                </span>
              ))}
            </div>
          )}

          {/* Expanded detail — shows all projects with links */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="pt-3 border-t border-[var(--glass-border)] space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand-text-muted)] mb-2">
                    Explore each domain
                  </p>
                  {intersection.projects.map((p) => (
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
                  {intersection.sharedFuel.length > 4 && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand-text-muted)] mb-2">
                        All bridging ideas ({intersection.sharedFuel.length})
                      </p>
                      {intersection.sharedFuel.slice(4).map((fuel) => (
                        <span
                          key={fuel.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] text-[var(--brand-text-secondary)] mr-1.5 mb-1.5"
                        >
                          {fuel.type === 'article' ? <FileText className="h-3 w-3 flex-shrink-0" /> : <MessageCircle className="h-3 w-3 flex-shrink-0" />} {fuel.title.length > 40 ? fuel.title.substring(0, 40) + '...' : fuel.title}
                        </span>
                      ))}
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
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-[var(--brand-text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      ) : null}
    </section>
  )
}
