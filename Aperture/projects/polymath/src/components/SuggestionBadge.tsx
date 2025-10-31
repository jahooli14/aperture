import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Link2, X } from 'lucide-react'
import { useAutoSuggestion } from '../contexts/AutoSuggestionContext'
import { useState } from 'react'
import { useToast } from '../hooks/useToast'

interface SuggestionBadgeProps {
  itemId: string
  itemType: 'project' | 'thought' | 'article'
}

export function SuggestionBadge({ itemId, itemType }: SuggestionBadgeProps) {
  const { pendingSuggestions, acceptSuggestion, dismissSuggestion } = useAutoSuggestion()
  const { addToast } = useToast()
  const [isExpanded, setIsExpanded] = useState(false)

  const suggestions = pendingSuggestions[itemId] || []
  const count = suggestions.length

  if (count === 0) return null

  const handleAccept = async (suggestion: any) => {
    try {
      await acceptSuggestion(itemId, suggestion)

      addToast({
        title: 'Connected!',
        description: `Linked to ${suggestion.toItemTitle}`,
        type: 'success'
      })

      // Close if no more suggestions
      if (suggestions.length === 1) {
        setIsExpanded(false)
      }
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to create connection',
        type: 'error'
      })
    }
  }

  const handleDismiss = (suggestionId: string) => {
    dismissSuggestion(itemId, suggestionId)

    // Close if no more suggestions
    if (suggestions.length === 1) {
      setIsExpanded(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'project': return '📦'
      case 'article': return '📰'
      case 'thought': return '💭'
      default: return '📄'
    }
  }

  return (
    <>
      {/* Badge Button */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: '28px',
          height: '28px',
          backgroundColor: 'var(--premium-purple)',
          WebkitTapHighlightColor: 'transparent'
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={isExpanded ? {} : {
          boxShadow: [
            '0 0 0 0 rgba(168, 85, 247, 0.4)',
            '0 0 0 8px rgba(168, 85, 247, 0)',
          ]
        }}
        transition={{
          boxShadow: {
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeOut'
          }
        }}
      >
        <span className="text-xs font-bold text-white">{count}</span>
        <motion.div
          className="absolute -top-1 -right-1"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles size={12} color="white" fill="white" />
        </motion.div>
      </motion.button>

      {/* Expanded Suggestions */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              style={{ backdropFilter: 'blur(4px)' }}
              onClick={() => setIsExpanded(false)}
            />

            {/* Suggestions Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
              style={{
                maxHeight: '70vh',
                backgroundColor: 'var(--premium-bg)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              {/* Handle */}
              <div className="flex justify-center py-3">
                <div
                  className="w-12 h-1 rounded-full"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                />
              </div>

              {/* Header */}
              <div className="px-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={20} style={{ color: 'var(--premium-purple)' }} />
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: 'rgba(255, 255, 255, 0.95)' }}
                  >
                    Suggested connections
                  </h3>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-white/40 hover:text-white/60 transition-colors p-2"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Suggestions List */}
              <div className="px-6 pb-6 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 100px)' }}>
                {suggestions.map((suggestion) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="premium-glass rounded-2xl p-4"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{getTypeIcon(suggestion.toItemType)}</span>
                      <div className="flex-1 min-w-0">
                        <h4
                          className="text-sm font-semibold mb-1"
                          style={{ color: 'rgba(255, 255, 255, 0.95)' }}
                        >
                          {suggestion.toItemTitle}
                        </h4>
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                        >
                          {suggestion.reasoning}
                        </p>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${suggestion.confidence * 100}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{
                            background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-purple))'
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                      >
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(suggestion)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-all active:scale-95"
                        style={{
                          backgroundColor: 'var(--premium-blue)',
                          color: 'white',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                      >
                        <Link2 size={14} />
                        Link
                      </button>
                      <button
                        onClick={() => handleDismiss(suggestion.id)}
                        className="px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'rgba(255, 255, 255, 0.6)',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
