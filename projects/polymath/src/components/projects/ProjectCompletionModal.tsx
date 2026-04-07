/**
 * ProjectCompletionModal
 * Celebrates completing a project and surfaces its origin thought if seeded from one.
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sprout, X, Brain } from 'lucide-react'
import type { Memory, Project } from '../../types'

interface ProjectCompletionModalProps {
  project: Project
  sparkedByMemories: Memory[]
  isOpen: boolean
  onClose: () => void
}

function formatDuration(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days < 1) return 'today'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month'
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 year' : `${years} years`
}

export function ProjectCompletionModal({ project, sparkedByMemories, isOpen, onClose }: ProjectCompletionModalProps) {
  const duration = formatDuration(project.created_at || new Date().toISOString())
  const firstSpark = sparkedByMemories[0]
  const [step, setStep] = useState<'celebration' | 'reflection'>('celebration')
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)
  const reflectionRef = useRef<HTMLTextAreaElement>(null)

  const handleReflectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReflection(e.target.value)
    const el = e.target
    requestAnimationFrame(() => {
      el.style.height = 'auto'
      el.style.height = Math.max(90, el.scrollHeight) + 'px'
    })
  }

  const handleDone = () => {
    setStep('reflection')
  }

  const handleSaveReflection = async () => {
    if (!reflection.trim()) { onClose(); return }
    setSaving(true)
    try {
      const resp = await fetch('/api/memories?capture=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: reflection.trim(),
          source_reference: `project:${project.id}`,
          tags: ['project-reflection']
        })
      })
      if (resp.ok) {
        const data = await resp.json()
        // Link reflection memory to the project
        if (data.memory?.id) {
          await fetch('/api/connections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source_type: 'memory', source_id: data.memory.id,
              target_type: 'project', target_id: project.id,
              connection_type: 'project_reflection', created_by: 'user',
              reasoning: 'Reflection captured at project completion'
            })
          }).catch(() => {})
        }
      }
    } catch { /* silent */ }
    onClose()
  }

  // Reset to celebration step whenever the modal opens
  useEffect(() => {
    if (isOpen) { setStep('celebration'); setReflection('') }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[9000] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed inset-x-4 bottom-8 sm:inset-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-[9001]"
          >
            <div
              className="relative p-8 rounded-2xl border border-[var(--glass-surface-hover)] overflow-hidden"
              style={{
                background: 'var(--brand-glass-bg)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 0 60px rgba(52, 211, 153, 0.15), 0 4px 16px rgba(0,0,0,0.5)',
              }}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'var(--brand-text-secondary)' }}
              >
                <X className="h-4 w-4" />
              </button>

              {/* Glow */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 50% 0%, rgba(52, 211, 153, 0.12), transparent 70%)'
              }} />

              <AnimatePresence mode="wait">
                {step === 'celebration' ? (
                  <motion.div key="celebration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 text-center">
                    {/* Check icon */}
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)' }}
                    >
                      <Check className="h-8 w-8" style={{ color: '#34d399' }} />
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: '#34d399' }}>
                      You built this
                    </p>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] mb-2">
                      {project.title}
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--brand-text-secondary)' }}>
                      {duration} in the making
                    </p>

                    {/* Origin thought */}
                    {firstSpark && (
                      <div className="mt-6 p-4 rounded-xl text-left"
                        style={{ background: 'rgba(52, 211, 153, 0.06)', border: '1px solid rgba(52, 211, 153, 0.2)' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Sprout className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#34d399' }}>
                            This started as a thought
                          </span>
                        </div>
                        <p className="text-sm italic leading-relaxed line-clamp-3" style={{ color: 'var(--brand-text-primary)' }}>
                          "{firstSpark.body || firstSpark.title}"
                        </p>
                        <p className="text-[10px] mt-1 opacity-50" style={{ color: 'var(--brand-primary)' }}>
                          {new Date(firstSpark.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleDone}
                      className="mt-6 w-full py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                      style={{
                        background: 'rgba(52, 211, 153, 0.15)',
                        border: '1px solid rgba(52, 211, 153, 0.3)',
                        color: '#34d399'
                      }}
                    >
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="reflection" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative z-10 text-center">
                    <Brain className="h-10 w-10 mb-4 mx-auto" style={{ color: '#34d399' }} />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: '#34d399' }}>
                      What did you learn?
                    </p>
                    <h2 className="text-lg font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] mb-1">
                      {project.title}
                    </h2>
                    <p className="text-xs mb-5" style={{ color: 'var(--brand-text-secondary)' }}>
                      Capture a reflection while it's fresh
                    </p>
                    <textarea
                      ref={reflectionRef}
                      autoFocus
                      value={reflection}
                      onChange={handleReflectionChange}
                      placeholder="What worked, what surprised you, what you'd do differently..."
                      className="w-full rounded-xl px-4 py-3 text-sm text-[var(--brand-text-primary)] placeholder:text-[var(--brand-text-primary)]/20 resize-none focus:outline-none mb-4 text-left"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '90px' }}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveReflection() }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveReflection}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                        style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}
                      >
                        {saving ? 'Saving...' : reflection.trim() ? 'Save reflection' : 'Done'}
                      </button>
                      <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                        style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'var(--brand-text-secondary)' }}
                      >
                        Skip
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
