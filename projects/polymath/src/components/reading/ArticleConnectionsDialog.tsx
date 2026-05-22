/**
 * Article Connections Dialog
 * Shows AI-suggested connections when user finishes reading an article
 */

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { ItemInsightStrip } from '../ItemInsightStrip'

interface ArticleConnectionsDialogProps {
  article: {
    id: string
    title: string
    content: string
    excerpt?: string
    themes?: string[]
  }
  isOpen: boolean
  onClose: () => void
}

export function ArticleConnectionsDialog({
  article,
  isOpen,
  onClose,
}: ArticleConnectionsDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl"
          >
            <div className="glass-card border-2 shadow-2xl" style={{ borderColor: 'rgba(var(--brand-primary-rgb), 0.3)' }}>
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
              </button>

              <div className="p-6">
                <p className="text-sm mb-4" style={{ color: "var(--brand-text-secondary)" }}>
                  "{article.title}"
                </p>
                <ItemInsightStrip title={article.title} themes={article.themes ?? undefined} />

                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <button
                    onClick={onClose}
                    className="w-full px-6 py-3 rounded-lg font-medium border transition-all hover:bg-[var(--glass-surface)]"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--brand-text-secondary)' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
