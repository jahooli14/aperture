import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Archive, Flame, Search } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { SubtleBackground } from '../components/SubtleBackground'
import type { Project } from '../types'

interface WarmedProject extends Project {
  heat_score?: number
  heat_reason?: string
}

const FOCUS_CAP = 3

export default function DrawerPage() {
  const { allProjects, fetchProjects, loading } = useProjectStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchProjects()
  }, [])

  const drawerProjects = useMemo(() => {
    const list = (Array.isArray(allProjects) ? allProjects : []) as WarmedProject[]

    // Compute the focus set (priority + recent) so drawer = everything else
    const priorityProjects = list.filter(p => p.is_priority).slice(0, FOCUS_CAP)
    const priorityIds = new Set(priorityProjects.map(p => p.id))
    const recentNonPriority = [...list]
      .sort((a, b) =>
        new Date(b.last_active || b.updated_at || b.created_at).getTime() -
        new Date(a.last_active || a.updated_at || a.created_at).getTime()
      )
      .filter(p => !p.is_priority && !priorityIds.has(p.id))
      .slice(0, Math.max(0, FOCUS_CAP - priorityProjects.length))
    const focusIds = new Set([...priorityProjects, ...recentNonPriority].map(p => p.id))

    const filtered = list.filter(p => !focusIds.has(p.id))
    const q = query.trim().toLowerCase()
    const searched = q
      ? filtered.filter(p =>
          p.title.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        )
      : filtered
    // Sort by heat_score desc, then by last_active desc
    return [...searched].sort((a, b) => {
      const ha = a.heat_score || 0
      const hb = b.heat_score || 0
      if (hb !== ha) return hb - ha
      const da = new Date(a.last_active || a.created_at).getTime()
      const db = new Date(b.last_active || b.created_at).getTime()
      return db - da
    })
  }, [allProjects, query])

  const warmedCount = drawerProjects.filter(p => (p.heat_score || 0) > 0 && !!p.heat_reason).length

  return (
    <>
      <SubtleBackground />
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-24">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--glass-surface)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Archive className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
            </div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)]">
                the <span className="text-brand-primary">drawer</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                {drawerProjects.length} resting · {warmedCount} warming
              </p>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
            <input
              type="text"
              placeholder="Rummage..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-all focus:outline-none"
              style={{
                backgroundColor: 'var(--glass-surface)',
                borderColor: query ? 'var(--brand-primary)' : 'rgba(255,255,255,0.1)',
                color: 'var(--brand-text-primary)',
              }}
            />
          </div>

          {loading && drawerProjects.length === 0 && (
            <div className="text-center py-12 text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">
              Opening the drawer…
            </div>
          )}

          {!loading && drawerProjects.length === 0 && (
            <div className="text-center py-24">
              <Archive className="h-10 w-10 mx-auto mb-4 opacity-30" style={{ color: 'var(--brand-text-muted)' }} />
              <p className="text-sm text-[var(--brand-text-muted)]">
                The drawer is empty. Everything is either in motion or already done.
              </p>
            </div>
          )}

          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {drawerProjects.map((p, i) => {
              const isWarm = (p.heat_score || 0) > 0 && !!p.heat_reason
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="break-inside-avoid mb-4"
                >
                  <Link
                    to={`/projects/${p.id}`}
                    className="block p-4 rounded-xl border transition-all hover:scale-[1.01]"
                    style={{
                      background: isWarm
                        ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.08), rgba(var(--brand-primary-rgb),0.02))'
                        : 'var(--brand-glass-bg)',
                      borderColor: isWarm ? 'rgba(var(--brand-primary-rgb),0.25)' : 'var(--glass-surface-hover)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-bold text-[var(--brand-text-primary)] text-sm leading-tight">
                        {p.title}
                      </h4>
                      {isWarm && (
                        <Flame className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-[var(--brand-text-secondary)] line-clamp-2 mt-1">
                        {p.description}
                      </p>
                    )}
                    {isWarm && p.heat_reason && (
                      <p className="text-[11px] text-[var(--brand-text-muted)] leading-relaxed mt-2 italic">
                        {p.heat_reason}
                      </p>
                    )}
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
