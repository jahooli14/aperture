import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Check } from 'lucide-react'
import { api } from '../../lib/apiClient'
import type { Project } from '../../types'

interface CompletionRitualProps {
  project: Project
  isOpen: boolean
  onClose: () => void
}

interface CreatedSpark {
  id?: string
  title: string
  description: string
}

export function CompletionRitual({ project, isOpen, onClose }: CompletionRitualProps) {
  const [whatWorked, setWhatWorked] = useState('')
  const [whatSurprised, setWhatSurprised] = useState('')
  const [whatNext, setWhatNext] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sparks, setSparks] = useState<CreatedSpark[] | null>(null)

  const canSubmit = whatWorked.trim().length > 0 || whatSurprised.trim().length > 0 || whatNext.trim().length > 0

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = (await api.post('projects?resource=complete-with-retro', {
        project_id: project.id,
        answers: {
          what_worked: whatWorked.trim(),
          what_surprised: whatSurprised.trim(),
          what_next: whatNext.trim(),
        },
      })) as { sparks?: CreatedSpark[] } | null
      setSparks(res?.sparks || [])
    } catch {
      setSparks([])
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setWhatWorked('')
    setWhatSurprised('')
    setWhatNext('')
    setSparks(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[85] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={reset}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="relative w-full max-w-lg rounded-2xl border p-4 sm:p-6 max-h-[88vh] overflow-y-auto"
            style={{
              background: 'var(--brand-bg)',
              borderColor: 'rgba(255,255,255,0.12)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={reset}
              className="absolute top-3 right-3 h-11 w-11 rounded-full flex items-center justify-center hover:bg-white/10 bg-white/5 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {!sparks && (
              <>
                <div className="mb-5">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'rgb(var(--color-accent-light-rgb))' }}>
                    Finished · {project.title}
                  </p>
                  <h2 className="text-2xl font-black italic uppercase tracking-tight text-[var(--brand-text-primary)]">
                    Three questions
                  </h2>
                  <p className="text-xs text-[var(--brand-text-muted)] leading-relaxed mt-2 italic">
                    Nothing is wasted. Your answers feed the next sparks.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--brand-text-secondary)] mb-2">
                      What worked?
                    </label>
                    <textarea
                      value={whatWorked}
                      onChange={e => setWhatWorked(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-lg border text-[15px] text-[var(--brand-text-primary)] focus:outline-none focus:border-brand-primary transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }}
                      placeholder="The thing you'd do again without thinking."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--brand-text-secondary)] mb-2">
                      What surprised you?
                    </label>
                    <textarea
                      value={whatSurprised}
                      onChange={e => setWhatSurprised(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-lg border text-[15px] text-[var(--brand-text-primary)] focus:outline-none focus:border-brand-primary transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }}
                      placeholder="Something you didn't expect when you started."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--brand-text-secondary)] mb-2">
                      What's next?
                    </label>
                    <textarea
                      value={whatNext}
                      onChange={e => setWhatNext(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-lg border text-[15px] text-[var(--brand-text-primary)] focus:outline-none focus:border-brand-primary transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }}
                      placeholder="A thread worth pulling on."
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    onClick={reset}
                    className="min-h-[44px] px-4 text-xs font-bold uppercase tracking-widest text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)] hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={submit}
                    disabled={!canSubmit || submitting}
                    className="flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-40"
                    style={{
                      background: 'rgba(52,211,153,0.18)',
                      border: '1px solid rgba(52,211,153,0.45)',
                      color: 'rgb(var(--color-accent-light-rgb))',
                    }}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {submitting ? 'Sparking…' : 'Finish & spark'}
                  </button>
                </div>
              </>
            )}

            {sparks && (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)' }}>
                    <Check className="h-5 w-5" style={{ color: 'rgb(var(--color-accent-light-rgb))' }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgb(var(--color-accent-light-rgb))' }}>
                      Retrospective saved
                    </p>
                    <h3 className="text-lg font-black italic uppercase tracking-tight text-[var(--brand-text-primary)]">
                      {sparks.length > 0 ? `${sparks.length} new spark${sparks.length === 1 ? '' : 's'}` : 'Filed for later'}
                    </h3>
                  </div>
                </div>

                {sparks.length > 0 ? (
                  <div className="space-y-3">
                    {sparks.map((s, i) => (
                      <div key={i} className="p-3 rounded-xl border"
                        style={{
                          background: 'rgba(var(--brand-primary-rgb),0.04)',
                          borderColor: 'rgba(var(--brand-primary-rgb),0.15)',
                        }}
                      >
                        <p className="text-sm font-bold text-[var(--brand-text-primary)] mb-1">{s.title}</p>
                        {s.description && (
                          <p className="text-xs text-[var(--brand-text-secondary)] leading-relaxed">{s.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--brand-text-muted)] italic leading-relaxed">
                    No sparks this time — the answers were too brief to seed anything concrete. That's fine. Silence over slop.
                  </p>
                )}

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={reset}
                    className="min-h-[44px] px-5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:scale-105"
                    style={{
                      background: 'var(--glass-surface)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--brand-text-primary)',
                    }}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
