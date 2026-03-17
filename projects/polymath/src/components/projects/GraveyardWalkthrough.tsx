import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Skull, Sprout, ChevronRight, X, Loader2 } from 'lucide-react'
import { useToast } from '../ui/toast'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import type { Project } from '../../types'

const WALKTHROUGH_KEY = 'polymath_last_graveyard_walkthrough'

export function shouldShowGraveyardWalkthrough(graveyardCount: number): boolean {
  if (graveyardCount === 0) return false
  const last = localStorage.getItem(WALKTHROUGH_KEY)
  if (!last) return true
  const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince >= 30
}

export function markGraveyardWalkthroughDone() {
  localStorage.setItem(WALKTHROUGH_KEY, new Date().toISOString())
}

interface GraveyardWalkthroughProps {
  projects: Project[]
  isOpen: boolean
  onClose: () => void
}

export function GraveyardWalkthrough({ projects, isOpen, onClose }: GraveyardWalkthroughProps) {
  const { addToast } = useToast()
  const { fetchProjects } = useProjectStore()
  const [index, setIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())

  const current = projects[index]
  const isLast = index === projects.length - 1
  const allDone = reviewed.size === projects.length

  const daysBuried = current
    ? Math.floor((Date.now() - new Date(current.updated_at || current.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const advance = () => {
    if (isLast) {
      markGraveyardWalkthroughDone()
      fetchProjects()
      onClose()
    } else {
      setIndex(i => i + 1)
    }
  }

  const handleResurrect = async () => {
    if (!current) return
    setSubmitting(true)
    try {
      await api.post(`projects?resource=reaper&action=resurrect&id=${current.id}`, {})
      addToast({ title: `Resurrected "${current.title}"`, description: 'Back from the dead.', variant: 'success' })
      setReviewed(prev => new Set(prev).add(current.id))
      advance()
    } catch {
      addToast({ title: 'Error', description: 'Failed to resurrect.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeepBuried = () => {
    if (!current) return
    setReviewed(prev => new Set(prev).add(current.id))
    advance()
  }

  const handleClose = () => {
    markGraveyardWalkthroughDone()
    if (reviewed.size > 0) fetchProjects()
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16 }}
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(15,15,20,0.98), rgba(20,20,28,0.98))',
              border: '1px solid rgba(148,163,184,0.12)'
            }}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 transition-colors"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Monthly Graveyard Review · {index + 1} of {projects.length}
              </p>
              <h2 className="text-lg font-black uppercase tracking-tight text-[var(--brand-text-primary)]">
                The <span style={{ color: 'rgba(148,163,184,0.7)' }}>Buried</span>
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--brand-text-muted)' }}>
                These ideas are still yours. Some may be ready to breathe again.
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-0.5 rounded-full mb-6 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'rgba(148,163,184,0.3)' }}
                animate={{ width: `${((index) / projects.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Project card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={current?.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl p-4 mb-6"
                style={{
                  background: 'rgba(148,163,184,0.04)',
                  border: '1px solid rgba(148,163,184,0.1)'
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)' }}>
                    <Skull className="h-3.5 w-3.5" style={{ color: 'rgba(148,163,184,0.5)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black uppercase tracking-tight text-sm text-[var(--brand-text-primary)] mb-1">
                      {current?.title}
                    </h3>
                    {current?.description && (
                      <p className="text-xs line-clamp-3 mb-2" style={{ color: 'var(--brand-text-secondary)' }}>
                        {current.description}
                      </p>
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.4)' }}>
                      buried {daysBuried} day{daysBuried !== 1 ? 's' : ''} ago
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleResurrect}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  color: '#34d399'
                }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
                Resurrect
              </button>
              <button
                onClick={handleKeepBuried}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(148,163,184,0.06)',
                  border: '1px solid rgba(148,163,184,0.1)',
                  color: 'rgba(148,163,184,0.6)'
                }}
              >
                <ChevronRight className="h-4 w-4" />
                {isLast ? 'Done' : 'Keep buried'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
