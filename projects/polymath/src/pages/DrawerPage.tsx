import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Archive, Flame, Search, ListOrdered } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { SubtleBackground } from '../components/SubtleBackground'
import { useToast } from '../components/ui/toast'
import { haptic } from '../utils/haptics'
import type { Project } from '../types'

interface WarmedProject extends Project {
  heat_score?: number
  heat_reason?: string
}

export default function DrawerPage() {
  const { allProjects, fetchProjects, loading, setUpNext, replaceUpNext } = useProjectStore()
  const [query, setQuery] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleTogglePin = async (e: React.MouseEvent, project: WarmedProject) => {
    e.preventDefault()
    e.stopPropagation()
    haptic.light()
    const wasPinned = project.up_next_position != null
    try {
      await setUpNext(project.id)
      if (!wasPinned) {
        addToast({
          title: 'Added to Up Next',
          description: `"${project.title}" is in the queue.`,
          variant: 'success',
        })
      }
    } catch (err: any) {
      const body = err?.details || {}
      if (body?.error === 'up_next_cap_reached') {
        const current: Array<{ id: string; title: string }> = body?.current || []
        const replaceTarget = current.find((p) => p.id === body?.suggested_replace_id) || current[0]
        if (replaceTarget) {
          addToast({
            title: 'Up Next is full',
            description: `Replace "${replaceTarget.title}" with "${project.title}"?`,
            variant: 'default',
            action: {
              label: 'Replace',
              onClick: async () => {
                try {
                  await replaceUpNext(project.id, replaceTarget.id)
                  addToast({
                    title: 'Added to Up Next',
                    description: `"${project.title}" replaced "${replaceTarget.title}".`,
                    variant: 'success',
                  })
                } catch {
                  addToast({ title: 'Couldn\'t replace', variant: 'destructive' })
                }
              },
            },
          })
          return
        }
      }
      addToast({
        title: 'Couldn\'t pin to Up Next',
        description: err?.message || 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  const drawerProjects = useMemo(() => {
    const list = (Array.isArray(allProjects) ? allProjects : []) as WarmedProject[]

    // Drawer = everything not on the home page shelves.
    // Focus stack on the home: priority (1) + Up Next (up to 3) +
    // the single most-recent active non-pinned project (the "recent" slot
    // in Keep Going). Anything else is in the drawer.
    const priorityProjects = list.filter(p => p.is_priority).slice(0, 1)
    const priorityIds = new Set(priorityProjects.map(p => p.id))
    const upNextProjects = list.filter(p => p.up_next_position != null)
    const upNextIds = new Set(upNextProjects.map(p => p.id))
    const recentSlot = [...list]
      .filter(p =>
        !priorityIds.has(p.id) &&
        !upNextIds.has(p.id) &&
        ['active', 'upcoming'].includes(p.status) &&
        p.metadata?.is_shaped !== false
      )
      .sort((a, b) =>
        new Date(b.last_active || b.updated_at || b.created_at).getTime() -
        new Date(a.last_active || a.updated_at || a.created_at).getTime()
      )
      .slice(0, 1)
    const focusIds = new Set([...priorityProjects, ...upNextProjects, ...recentSlot].map(p => p.id))

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
          <header className="page-masthead">
            <div className="page-masthead-text">
              <h1 className="page-hero-sm">The drawer.</h1>
              <div className="page-eyebrow">{drawerProjects.length} resting · {warmedCount} warming</div>
            </div>
          </header>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
            <input
              type="text"
              placeholder="Rummage…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="soft-input pl-11"
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

          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {drawerProjects.map((p, i) => {
              const isWarm = (p.heat_score || 0) > 0 && !!p.heat_reason
              const isPinned = p.up_next_position != null
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="break-inside-avoid mb-4 relative"
                >
                  <Link
                    to={`/projects/${p.id}`}
                    className="block p-4 rounded-xl border transition-all hover:scale-[1.01]"
                    style={{
                      background: isWarm
                        ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.12), rgba(var(--brand-primary-rgb),0.04))'
                        : 'rgba(15, 24, 41, 0.5)',
                      borderColor: isWarm ? 'rgba(var(--brand-primary-rgb),0.4)' : 'rgba(255,255,255,0.1)',
                      boxShadow: isWarm ? '0 4px 16px rgba(var(--brand-primary-rgb),0.12)' : '0 2px 10px rgba(0,0,0,0.35)',
                      WebkitTouchCallout: 'none',
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="font-bold text-[var(--brand-text-primary)] text-[15px] leading-tight line-clamp-2 pr-9">
                        {p.title}
                      </h4>
                      {isWarm && (
                        <Flame className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                      )}
                    </div>
                    {p.description && (
                      <p className="text-[13px] text-[var(--brand-text-secondary)] line-clamp-3 mt-1.5 leading-relaxed">
                        {p.description}
                      </p>
                    )}
                    {isWarm && p.heat_reason && (
                      <p className="text-[12px] text-[var(--brand-text-secondary)] leading-relaxed mt-2.5 italic border-l-2 pl-2"
                        style={{ borderColor: 'rgba(var(--brand-primary-rgb),0.5)' }}>
                        {p.heat_reason}
                      </p>
                    )}
                  </Link>

                  {/* Pin to Up Next — visible on every tile, one tap to promote */}
                  <button
                    onClick={(e) => handleTogglePin(e, p)}
                    aria-label={isPinned ? `Remove ${p.title} from Up Next` : `Add ${p.title} to Up Next`}
                    title={isPinned ? `In Up Next (#${p.up_next_position})` : 'Add to Up Next'}
                    className="absolute top-2.5 right-2.5 h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    style={{
                      background: isPinned
                        ? 'rgba(var(--brand-primary-rgb), 0.18)'
                        : 'rgba(0,0,0,0.35)',
                      border: isPinned
                        ? '1px solid rgba(var(--brand-primary-rgb), 0.5)'
                        : '1px solid rgba(255,255,255,0.08)',
                      color: isPinned ? 'rgb(var(--brand-primary-rgb))' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
