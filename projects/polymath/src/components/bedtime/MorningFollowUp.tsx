import { useState, useEffect } from 'react'
import { Sun, X, Zap, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface MorningFollowUpProps {
  onDismiss: () => void
  onCapture: (text: string) => void
}

export function MorningFollowUp({ onDismiss, onCapture }: MorningFollowUpProps) {
  const [lastPrompt, setLastPrompt] = useState<any>(null)
  const [response, setResponse] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Only show between 6am and 11am
    const hour = new Date().getHours()
    if (hour < 6 || hour >= 11) {
      onDismiss()
      return
    }

    // Fetch last night's breakthrough prompt
    fetch('/api/projects?resource=bedtime&action=last-breakthrough')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.prompt) {
          setLastPrompt(data.prompt)
        } else {
          onDismiss()
        }
        setLoading(false)
      })
      .catch(() => { setLoading(false); onDismiss() })
  }, [onDismiss])

  const handleSubmit = async () => {
    if (!response.trim()) return
    setSubmitted(true)
    onCapture(response)

    // Link the follow-up to the original prompt
    if (lastPrompt?.id) {
      try {
        await fetch(`/api/projects?resource=bedtime&action=follow-up&id=${lastPrompt.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response: response.trim() })
        })
      } catch (e) {
        console.warn('[MorningFollowUp] Failed to link follow-up:', e)
      }
    }

    setTimeout(onDismiss, 2000)
  }

  if (loading || !lastPrompt) return null

  return (
    <AnimatePresence>
      {!submitted ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mx-4 mb-4 p-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-brand-text-secondary" />
              <span className="text-sm font-medium text-brand-primary">Morning follow-up</span>
            </div>
            <button onClick={onDismiss} className="text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-[var(--brand-text-secondary)] mb-3">
            Last night you explored: <span className="text-brand-primary/80 italic">"{lastPrompt.prompt?.substring(0, 100)}..."</span>
          </p>
          <p className="text-xs text-[var(--brand-text-secondary)] mb-3">Did anything surface overnight?</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={response}
              onChange={e => setResponse(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="A thought, connection, or nothing at all..."
              className="flex-1 bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] rounded-xl px-3 py-2 text-sm text-[var(--brand-text-primary)] placeholder-gray-500 focus:outline-none focus:border-amber-500/30"
              autoFocus
            />
            <button
              onClick={handleSubmit}
              disabled={!response.trim()}
              className="px-3 py-2 rounded-xl bg-brand-primary/20 text-brand-text-secondary hover:bg-brand-primary/30 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mx-4 mb-4 p-4 rounded-2xl border border-emerald-500/20 bg-brand-primary/5 flex items-center gap-2"
        >
          <Zap className="w-4 h-4 text-brand-text-secondary" />
          <span className="text-sm text-brand-primary">Captured.</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
