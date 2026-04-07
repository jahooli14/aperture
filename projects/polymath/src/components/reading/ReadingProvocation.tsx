import { useState, useEffect } from 'react'
import { AlertTriangle, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

interface Provocation {
  article_id: string
  article_title: string
  project_id: string
  project_title: string
  type: 'challenges' | 'complements' | 'brewing'
  message: string
}

export function ReadingProvocation() {
  const [provocation, setProvocation] = useState<Provocation | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/reading?resource=provocations')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.provocation) {
          setProvocation(data.provocation)
        }
      })
      .catch(() => {})
  }, [])

  if (!provocation || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="mx-4 mb-3 p-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertTriangle className="w-4 h-4 text-brand-text-secondary mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-gray-200 leading-relaxed">{provocation.message}</p>
              <button
                onClick={() => navigate(`/reading/${provocation.article_id}`)}
                className="flex items-center gap-1 mt-1.5 text-xs text-brand-text-secondary hover:text-brand-primary"
              >
                Read it <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-gray-600 hover:text-[var(--brand-text-secondary)] flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
