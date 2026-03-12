import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Users, Hash, Heart, Link2 } from 'lucide-react'

interface ExtractionDetail {
  memoryId: string
  topics: number
  people: number
  themes: number
  tone: string | null
  connections: number
}

export function ExtractionSummary() {
  const [extraction, setExtraction] = useState<ExtractionDetail | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleExtraction = (e: CustomEvent<ExtractionDetail>) => {
      setExtraction(e.detail)
      setVisible(true)
      // Auto-dismiss after 4 seconds
      setTimeout(() => setVisible(false), 4000)
    }

    window.addEventListener('memory-extracted', handleExtraction as EventListener)
    return () => window.removeEventListener('memory-extracted', handleExtraction as EventListener)
  }, [])

  return (
    <AnimatePresence>
      {visible && extraction && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-[#1a1f35]/95 backdrop-blur-xl border border-[var(--glass-surface-hover)] shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-300 font-medium">Understood</span>
            </div>
            <div className="h-3 w-px bg-[rgba(255,255,255,0.1)]" />
            <div className="flex items-center gap-2.5 text-xs text-[var(--brand-text-secondary)]">
              {extraction.topics > 0 && (
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-emerald-400" />
                  {extraction.topics} topic{extraction.topics > 1 ? 's' : ''}
                </span>
              )}
              {extraction.people > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-violet-400" />
                  {extraction.people} {extraction.people > 1 ? 'people' : 'person'}
                </span>
              )}
              {extraction.tone && (
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-400" />
                  {extraction.tone}
                </span>
              )}
              {extraction.connections > 0 && (
                <span className="flex items-center gap-1">
                  <Link2 className="w-3 h-3 text-amber-400" />
                  {extraction.connections} link{extraction.connections > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
