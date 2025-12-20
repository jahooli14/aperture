/**
 * Article Connections Dialog
 * Shows AI-suggested connections when user finishes reading an article
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Check, ChevronRight, Brain, Rocket, BookmarkCheck } from 'lucide-react'
import { ConnectionsList } from '../connections/ConnectionsList'

interface ArticleConnectionsDialogProps {
  article: {
    id: string
    title: string
    content: string
    excerpt?: string
  }
  isOpen: boolean
  onClose: () => void
  onConnectionsCreated?: () => void
  initialStage?: 'prompt' | 'discovering'
}

export function ArticleConnectionsDialog({
  article,
  isOpen,
  onClose,
  onConnectionsCreated,
  initialStage = 'prompt'
}: ArticleConnectionsDialogProps) {
  const [stage, setStage] = useState<'prompt' | 'discovering'>(initialStage)

  useEffect(() => {
    if (isOpen) {
      setStage(initialStage)
    }
  }, [isOpen, initialStage])

  const handleDiscover = () => {
    setStage('discovering')
  }

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
            <div className="premium-card border-2 shadow-2xl" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" style={{ color: 'var(--premium-text-secondary)' }} />
              </button>

              {stage === 'prompt' ? (
                <div className="p-8 text-center">
                  {/* Success Icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
                    style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(147, 197, 253, 0.8))' }}
                  >
                    <Check className="h-8 w-8 text-white" />
                  </motion.div>

                  <h2 className="text-2xl font-bold premium-text-platinum mb-2">
                    Great read!
                  </h2>

                  <p className="text-lg mb-6" style={{ color: 'var(--premium-text-secondary)' }}>
                    "{article.title}"
                  </p>

                  <p className="mb-8" style={{ color: 'var(--premium-text-tertiary)' }}>
                    Want to connect this to your projects or thoughts?
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={handleDiscover}
                      className="px-6 py-3 rounded-lg font-medium inline-flex items-center justify-center gap-2 transition-all"
                      style={{ background: 'var(--premium-blue-gradient)', color: 'white' }}
                    >
                      <Zap className="h-5 w-5" />
                      Discover Connections
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 rounded-lg font-medium border transition-all hover:bg-white/5"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--premium-text-secondary)' }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                      <Brain className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold premium-text-platinum">
                        AI-Suggested Connections
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        Based on "{article.title}"
                      </p>
                    </div>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto">
                    <ConnectionsList
                      itemType="article"
                      itemId={article.id}
                      content={`${article.title}\n\n${article.excerpt || article.content || ''}`}
                      onConnectionCreated={() => {
                        onConnectionsCreated?.()
                      }}
                      onConnectionDeleted={() => { }}
                    />
                  </div>

                  <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <button
                      onClick={onClose}
                      className="w-full px-6 py-3 rounded-lg font-medium border transition-all hover:bg-white/5"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--premium-text-secondary)' }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
