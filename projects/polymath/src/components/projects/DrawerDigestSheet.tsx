import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, ArrowRight, Check } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'

interface WarmedItem {
  id: string
  title: string
  heat_score?: number
  heat_reason?: string
}

interface Evolution {
  project_id: string
  project_title: string
  mode: 'shrink' | 'merge' | 'split' | 'reframe' | 'snapshot' | 'handoff'
  title: string
  proposal: string
  evidence: string
}

interface Digest {
  id: string
  generated_at: string
  warmed: WarmedItem[]
  evolutions: Evolution[]
  status: 'unread' | 'read' | 'acted'
}

const MODE_COPY: Record<Evolution['mode'], { label: string; blurb: string }> = {
  shrink:   { label: 'Shrink',   blurb: 'Smaller, concrete version' },
  merge:    { label: 'Merge',    blurb: 'Combine with a related project' },
  split:    { label: 'Split',    blurb: 'Break into focused children' },
  reframe:  { label: 'Reframe',  blurb: 'New angle on the same idea' },
  snapshot: { label: 'Snapshot', blurb: 'Capture as a standalone artifact' },
  handoff:  { label: 'Handoff',  blurb: 'Let someone else carry it' },
}

export function DrawerDigestSheet() {
  const { fetchProjects } = useProjectStore()
  const [digest, setDigest] = useState<Digest | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = (await api.get('projects?resource=digest')) as { digest: Digest | null } | null
        if (cancelled) return
        if (res?.digest && Array.isArray(res.digest.evolutions) && res.digest.evolutions.length > 0) {
          setDigest(res.digest)
        }
      } catch {
        // Silent failure — the digest is optional.
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!digest) return null

  const dismiss = async () => {
    try {
      await api.post('projects?resource=digest-act', { digest_id: digest.id, action: 'read' })
    } catch {}
    setDigest(null)
    setOpen(false)
  }

  const accept = async (idx: number) => {
    setBusy(idx)
    try {
      await api.post('projects?resource=digest-act', {
        digest_id: digest.id,
        action: 'accept',
        evolution_index: idx,
      })
      await fetchProjects()
      setDigest(null)
      setOpen(false)
    } catch {
      // Swallow — user can retry.
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {/* Quiet banner */}
      <button
        onClick={() => setOpen(true)}
        className="w-full mb-4 p-3 rounded-xl border flex items-center gap-3 text-left transition-all hover:scale-[1.005]"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.04))',
          borderColor: 'rgba(168,85,247,0.25)',
        }}
      >
        <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: '#a855f7' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#a855f7' }}>
            Weekly drawer digest
          </p>
          <p className="text-xs text-[var(--brand-text-primary)] leading-snug">
            {digest.evolutions.length} project{digest.evolutions.length === 1 ? '' : 's'} ready to evolve
          </p>
        </div>
        <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--brand-text-muted)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border p-6"
              style={{
                background: 'var(--brand-bg)',
                borderColor: 'var(--glass-surface-hover)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="h-4 w-4" style={{ color: '#a855f7' }} />
                <h2 className="text-lg font-black italic uppercase tracking-tight text-[var(--brand-text-primary)]">
                  Drawer digest
                </h2>
              </div>

              <p className="text-xs text-[var(--brand-text-muted)] leading-relaxed mb-5 italic">
                A handful of dormant projects stirred this week. Here's what each could become, with the evidence that surfaced them.
              </p>

              <div className="space-y-4">
                {digest.evolutions.map((evo, i) => {
                  const mode = MODE_COPY[evo.mode] || { label: evo.mode, blurb: '' }
                  return (
                    <div
                      key={i}
                      className="p-4 rounded-xl border"
                      style={{
                        background: 'rgba(168,85,247,0.04)',
                        borderColor: 'rgba(168,85,247,0.15)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest"
                          style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
                          {mode.label}
                        </span>
                        <span className="text-[10px] text-[var(--brand-text-muted)]">{mode.blurb}</span>
                      </div>

                      <p className="text-[10px] uppercase tracking-widest text-[var(--brand-text-muted)] mb-1">
                        from · {evo.project_title}
                      </p>
                      <h3 className="text-base font-bold text-[var(--brand-text-primary)] mb-2">
                        {evo.title}
                      </h3>
                      <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-3">
                        {evo.proposal}
                      </p>
                      <p className="text-[11px] text-[var(--brand-text-muted)] italic leading-relaxed mb-3">
                        {evo.evidence}
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => accept(i)}
                          disabled={busy !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-50"
                          style={{
                            background: 'rgba(52,211,153,0.12)',
                            border: '1px solid rgba(52,211,153,0.3)',
                            color: '#34d399',
                          }}
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={dismiss}
                className="mt-5 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-text-muted)] hover:text-[var(--brand-text-primary)] transition-colors"
              >
                Dismiss digest
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
