/**
 * WeeklyIntersection — Highlights the most interesting multi-project crossover.
 * Shows 1x/week, scored by (number of projects × relevance).
 * Finds shared fuel (memories/articles) that bridge multiple projects.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, RefreshCw, FileText, MessageCircle } from 'lucide-react'
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
        weekly <span>intersection</span>
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
            <Sparkles className="h-4 w-4 text-brand-primary flex-shrink-0" />
            {intersection.projects.map((p, i) => (
              <span key={p.id} className="flex items-center gap-2">
                {i > 0 && <span className="text-brand-primary font-bold">×</span>}
                <Link
                  to={`/projects/${p.id}`}
                  className="text-sm font-semibold text-[var(--brand-text-primary)] hover:text-brand-primary transition-colors"
                >
                  {p.title}
                </Link>
              </span>
            ))}
            <span className="ml-auto text-xs text-brand-primary/60 font-mono">
              {intersection.projects.length} projects · {intersection.score.toFixed(1)} score
            </span>
          </div>

          {/* AI reasoning */}
          {intersection.reason && (
            <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-3">
              {intersection.reason}
            </p>
          )}

          {/* Shared fuel */}
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

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1">
            <Link
              to={`/projects/${intersection.projects[0]?.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:text-brand-primary transition-colors"
            >
              Explore <ArrowRight className="h-3 w-3" />
            </Link>
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
