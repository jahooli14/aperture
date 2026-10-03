import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, BookOpen, ListPlus, ArrowRight } from 'lucide-react'
import { useJourneyStore } from '../../stores/useJourneyStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { CreateProjectDialog } from '../projects/CreateProjectDialog'

interface ExtractionDetail {
  memoryId: string
  triageCategory: string | null
  suggestedProjectId: string | null
}

/** How long the line stays up on its own. */
const AUTO_DISMISS_MS = 8000

/**
 * After a thought is saved: ONE line saying where it went, and only when it
 * went somewhere — "Added to <project>", "Added to a list", "Sounds like a
 * project". The topic/people/tone counts and the model's "bridge" remark are
 * gone: they described the machine, not what happened to the thought, and the
 * bridge was the app offering ideas straight after you'd spoken.
 */
export function ExtractionSummary() {
  const navigate = useNavigate()
  const [extraction, setExtraction] = useState<ExtractionDetail | null>(null)
  const [visible, setVisible] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const { incrementDataPoints, onboardingCompletedAt } = useJourneyStore()
  const allProjects = useProjectStore(s => s.allProjects)

  useEffect(() => {
    const handleExtraction = (e: CustomEvent<ExtractionDetail>) => {
      setExtraction(e.detail)
      setVisible(true)
      if (onboardingCompletedAt) incrementDataPoints()
    }
    window.addEventListener('memory-extracted', handleExtraction as EventListener)
    return () => window.removeEventListener('memory-extracted', handleExtraction as EventListener)
  }, [onboardingCompletedAt])

  useEffect(() => {
    if (!visible) return
    const id = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [visible, extraction])

  const project = extraction?.suggestedProjectId
    ? allProjects.find(p => p.id === extraction.suggestedProjectId)
    : undefined
  const category = extraction?.triageCategory ?? null

  const line = (() => {
    if (!extraction) return null
    if (category === 'new_project_idea') {
      return (
        <>
          <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Sounds like a project —</span>
          {project && (
            <button onClick={() => { setVisible(false); navigate(`/projects/${project.id}`) }} className="text-xs font-bold underline" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
              add to {project.title}
            </button>
          )}
          <button onClick={() => { setVisible(false); setCreateOpen(true) }} className="text-xs font-bold underline" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
            start something new
          </button>
        </>
      )
    }
    if (category === 'task_update' && project) {
      return (
        <>
          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Added to</span>
          <button onClick={() => { setVisible(false); navigate(`/projects/${project.id}`) }} className="text-xs font-bold underline" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
            {project.title}
          </button>
        </>
      )
    }
    if (category === 'list_item') {
      return (
        <>
          <ListPlus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Added to a list.</span>
          <button onClick={() => { setVisible(false); navigate('/lists') }} className="text-xs font-bold underline" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
            see lists
          </button>
        </>
      )
    }
    if (category === 'reading_lead') {
      return (
        <>
          <BookOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Added to your reading queue.</span>
          <button onClick={() => { setVisible(false); navigate('/reading') }} className="text-xs font-bold underline" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
            open
          </button>
        </>
      )
    }
    return null
  })()

  return (
    <>
      <CreateProjectDialog isOpen={createOpen} onOpenChange={setCreateOpen} hideTrigger />
      <AnimatePresence>
        {visible && line && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-24 left-4 right-4 z-50 md:left-1/2 md:-translate-x-1/2 md:w-auto md:max-w-sm"
          >
            <div className="px-4 py-3 rounded-2xl bg-[#1a1f35]/95 backdrop-blur-xl border border-[var(--glass-surface-hover)] shadow-2xl flex items-center gap-2 flex-wrap">
              {line}
              <button
                onClick={() => setVisible(false)}
                className="ml-auto flex-shrink-0 p-1 rounded-md transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                style={{ color: 'var(--brand-text-muted)' }}
                title="Dismiss"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
