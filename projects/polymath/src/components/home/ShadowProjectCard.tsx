/**
 * ShadowProjectCard
 *
 * Surfaces the single most important synthesis output: the project the user
 * is building toward without having named it yet.
 *
 * - Fetches from the evolution endpoint (same data as InsightsPage)
 * - Cached in localStorage keyed by generation timestamp — free on subsequent renders
 * - Session-dismissible
 * - One-tap "Create project" CTA that navigates to /projects
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, ArrowRight, FolderPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ShadowProjectData {
  title: string
  description: string
  data: {
    project_name?: string
    how_long?: string
    evidence?: string[]
    recommendation?: string
  }
  action?: string
  is_new?: boolean
}

const CACHE_KEY = 'polymath_shadow_project_cache'
const DISMISSED_KEY = 'polymath_shadow_project_dismissed'

export function ShadowProjectCard() {
  const [shadow, setShadow] = useState<ShadowProjectData | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Session-level dismissal (reappears on next app open)
    const dismissedSession = sessionStorage.getItem(DISMISSED_KEY)
    if (dismissedSession) { setDismissed(true); return }

    // Try cache first — avoid blocking render
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const { data, ts } = JSON.parse(raw)
        // Cache valid for 1 hour
        if (data && Date.now() - ts < 60 * 60 * 1000) {
          setShadow(data)
          return
        }
      }
    } catch {}

    // Fetch fresh — reuse the same endpoint InsightsPage uses
    fetch('/api/memories?action=evolution')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.shadow_project) {
          setShadow(d.shadow_project)
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d.shadow_project, ts: Date.now() }))
        }
      })
      .catch(() => {})
  }, [])

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissed(true)
    sessionStorage.setItem(DISMISSED_KEY, '1')
  }

  const handleCreate = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate('/projects', { state: { suggestedProjectName: shadow?.data?.project_name || shadow?.title } })
  }

  if (dismissed || !shadow) return null

  const projectName = shadow.data?.project_name || shadow.title
  const evidence = shadow.data?.evidence?.slice(0, 3) || []

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative rounded-2xl overflow-hidden mb-4"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.08) 100%)',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 4px 24px rgba(139,92,246,0.1), 3px 3px 0 rgba(0,0,0,0.4)',
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.08) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center h-6 w-6 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.2)' }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: 'rgb(167,139,250)' }} />
              </div>
              <span
                className="text-[10px] font-black uppercase tracking-[0.25em]"
                style={{ color: 'rgb(167,139,250)' }}
              >
                You might be building this
              </span>
              {shadow.is_new && (
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(139,92,246,0.3)', color: 'rgb(196,181,253)' }}
                >
                  New
                </span>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="h-6 w-6 rounded-lg flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity flex-shrink-0"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Project name — the headline */}
          <h3
            className="text-lg font-bold mb-2 leading-snug"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            {projectName}
          </h3>

          {/* The insight itself */}
          <p
            className="text-sm leading-relaxed mb-3 line-clamp-3"
            style={{ color: 'var(--brand-text-secondary)' }}
          >
            {shadow.description}
          </p>

          {/* How long + evidence */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {shadow.data?.how_long && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: 'rgba(139,92,246,0.15)',
                  color: 'rgb(196,181,253)',
                }}
              >
                {shadow.data.how_long}
              </span>
            )}
            {evidence.map((e, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--brand-text-secondary)',
                }}
              >
                {e.length > 28 ? e.slice(0, 28) + '…' : e}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{
                background: 'rgba(139,92,246,0.25)',
                border: '1px solid rgba(139,92,246,0.4)',
                color: 'rgb(196,181,253)',
              }}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Create project
            </button>
            <button
              onClick={() => navigate('/insights')}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 opacity-60 hover:opacity-90"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              Full analysis
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
