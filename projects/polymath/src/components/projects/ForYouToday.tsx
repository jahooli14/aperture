/**
 * ForYouToday — the Attention strip on the Projects page.
 *
 * This is the only component allowed to surface drawer content on the main
 * page. It shows warmed projects (those the metabolism has found newly
 * relevant) along with their cited reason. If there is nothing warmed and no
 * unread digest, **it renders nothing** — not an empty state, not a
 * placeholder. Silence is a feature.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { api } from '../../lib/apiClient'
import type { Project } from '../../types'

interface WarmedProject extends Project {
  heat_score?: number
  heat_reason?: string
}

interface DrawerResponse {
  warmed: WarmedProject[]
  shuffle: Project[]
  total: number
}

export function ForYouToday() {
  const navigate = useNavigate()
  const [warmed, setWarmed] = useState<WarmedProject[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = (await api.get('projects?resource=drawer')) as DrawerResponse | null
        if (cancelled) return
        const items = (res?.warmed || [])
          .filter(p => !!p.heat_reason) // enforce cite-or-silence at the view layer too
          .slice(0, 3)
        setWarmed(items)
      } catch {
        // Silent failure — this strip never interrupts the user
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Invisible when empty. This is the whole point of the strip.
  if (!loaded || warmed.length === 0) return null

  return (
    <section className="mb-8">
      <div className="mb-4 px-1 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--brand-primary)' }} />
        <h3 className="text-xs font-bold text-[var(--brand-text-muted)] uppercase tracking-widest aperture-header">
          For you today
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence>
          {warmed.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="text-left p-4 rounded-xl border transition-all hover:scale-[1.01]"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
                borderColor: 'rgba(59,130,246,0.25)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-black italic text-[var(--brand-text-primary)] text-base leading-tight">
                  {p.title}
                </h4>
              </div>
              {p.heat_reason && (
                <p className="text-xs text-[var(--brand-text-muted)] leading-relaxed mt-1.5 italic">
                  {p.heat_reason}
                </p>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}
