/**
 * ReviewRotation — the forgotten projects, surfaced on home and dealt with
 * on home.
 *
 * A few priority projects live in the user's head fine. Everything else goes
 * out of sight and stops being able to do the one thing a dormant project is
 * good for: sparking the next one. A complete list on another page doesn't fix
 * that — nobody opens a list of forty things on purpose. So: two or three at a
 * time, right here, one tap each.
 *
 * Acting never navigates. The projects page stays for browsing; this is the
 * review, and it finishes where it started. Cards leave as they're handled and
 * the whole section disappears once the batch is clear — same
 * invisible-when-empty contract as the rest of the home stack.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { haptic } from '../../utils/haptics'

interface ReviewCandidate {
  id: string
  title: string
  description: string | null
  tags: string[]
  status: string
  reason: string
  shared_tags: string[]
  days_since_touched: number
}

type ReviewAction = 'keep' | 'park' | 'promote'

export function ReviewRotation() {
  const navigate = useNavigate()
  const fetchProjects = useProjectStore(s => s.fetchProjects)
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = (await api.get('projects?resource=review-queue')) as
          | { candidates: ReviewCandidate[] }
          | null
        if (cancelled) return
        if (Array.isArray(res?.candidates)) setCandidates(res.candidates)
      } catch {
        // Silent — the review never interrupts.
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (candidates.length === 0) return null

  const act = async (id: string, action: ReviewAction) => {
    const index = candidates.findIndex(c => c.id === id)
    const removed = candidates[index]
    if (!removed) return

    setBusy(id)
    haptic.medium()
    // Drop the card immediately. The decision is the user's, not the
    // server's — making them watch a spinner to confirm what they just chose
    // turns a one-tap review into a wait.
    setCandidates(prev => prev.filter(c => c.id !== id))
    try {
      await api.post('projects?resource=review-act', { project_id: id, action })
      if (action === 'promote') await fetchProjects()
    } catch {
      // Put it back where it was if the write failed — a silently dropped
      // decision would mean the project quietly leaves the rotation without
      // anything actually being recorded.
      setCandidates(prev => {
        if (prev.some(c => c.id === id)) return prev
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, removed)
        return next
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="section-seam" aria-hidden />
      <h2 className="section-header" style={{ margin: '0 0 10px' }}>worth a <span>look</span></h2>
      <p
        className="text-[11px] mb-3"
        style={{ color: 'var(--brand-text-muted)' }}
      >
        You haven't touched these in a while.
      </p>

      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {candidates.map(c => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="rounded-xl border overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.07), rgba(15,24,41,0.45))',
                borderColor: 'rgba(var(--brand-primary-rgb),0.22)',
              }}
            >
              <div className="p-3.5">
                <button
                  type="button"
                  onClick={() => { haptic.light(); navigate(`/projects/${c.id}`) }}
                  className="text-left w-full"
                >
                  <h3 className="card-title line-clamp-2">{c.title}</h3>
                </button>

                {/* Labels — the thing that makes a resurfaced project a
                    building block rather than a random pick. Shared ones (it
                    overlaps with what you're pushing on now) are lit; the
                    rest sit quiet. */}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {c.tags.map(tag => {
                      const shared = c.shared_tags.includes(tag)
                      return (
                        <span
                          key={tag}
                          className="text-[9.5px] uppercase tracking-[0.16em] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: shared
                              ? 'rgba(var(--brand-primary-rgb),0.16)'
                              : 'rgba(255,255,255,0.05)',
                            color: shared
                              ? 'rgb(var(--brand-primary-rgb))'
                              : 'var(--brand-text-muted)',
                            border: shared
                              ? '1px solid rgba(var(--brand-primary-rgb),0.3)'
                              : '1px solid transparent',
                          }}
                        >
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}

                <p
                  className="text-[11px] mt-2 italic"
                  style={{ color: 'var(--brand-text-secondary)' }}
                >
                  {c.reason}
                </p>

                {/* Keep is the common answer, so it's the solid one. Park and
                    start sit quiet beside it rather than competing. */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => act(c.id, 'keep')}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      background: 'rgba(var(--brand-primary-rgb),0.14)',
                      border: '1px solid rgba(var(--brand-primary-rgb),0.34)',
                      color: 'rgb(var(--brand-primary-rgb))',
                    }}
                  >
                    Still mine
                  </button>
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => act(c.id, 'promote')}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'var(--brand-text-secondary)',
                    }}
                  >
                    Pick it up
                  </button>
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => act(c.id, 'park')}
                    className="ml-auto text-[11px] font-medium transition-opacity hover:opacity-100 opacity-50 disabled:opacity-30"
                    style={{ color: 'var(--brand-text-muted)' }}
                  >
                    Park it
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
