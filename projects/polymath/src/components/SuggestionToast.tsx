import { motion, AnimatePresence } from 'framer-motion'
import { Link2, X, Zap, ArrowRight } from 'lucide-react'
import { useAutoSuggestion } from '../contexts/AutoSuggestionContext'
import { useState, useEffect } from 'react'
import { useToast } from './ui/toast'

interface SuggestionToastProps {
  itemId: string
  itemType: 'project' | 'thought' | 'article'
  itemTitle: string
}

export function SuggestionToast({ itemId, itemType, itemTitle }: SuggestionToastProps) {
  const { pendingSuggestions, acceptSuggestion, dismissSuggestion } = useAutoSuggestion()
  const { addToast } = useToast()
  const [isVisible, setIsVisible] = useState(false)
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0)

  const suggestions = pendingSuggestions[itemId] || []
  const currentSuggestion = suggestions[currentSuggestionIndex]

  useEffect(() => {
    if (suggestions.length > 0) {
      setIsVisible(true)
      setCurrentSuggestionIndex(0)

      // Auto-dismiss after 15 seconds
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 15000)

      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [suggestions.length])

  const handleAccept = async () => {
    if (!currentSuggestion) return

    try {
      await acceptSuggestion(itemId, currentSuggestion)

      addToast({
        title: 'Connected!',
        description: `Linked to ${currentSuggestion.toItemTitle}`,
        variant: 'success'
      })

      // Move to next suggestion or close
      if (currentSuggestionIndex < suggestions.length - 1) {
        setCurrentSuggestionIndex(prev => prev + 1)
      } else {
        setIsVisible(false)
      }
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to create connection',
        variant: 'destructive'
      })
    }
  }

  const handleDismiss = () => {
    if (!currentSuggestion) return

    dismissSuggestion(itemId, currentSuggestion.id)

    // Move to next suggestion or close
    if (currentSuggestionIndex < suggestions.length - 1) {
      setCurrentSuggestionIndex(prev => prev + 1)
    } else {
      setIsVisible(false)
    }
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  if (!currentSuggestion) return null

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'project': return '📦'
      case 'article': return '📰'
      case 'thought': return '💭'
      default: return '📄'
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-md"
        >
          <div
            className="premium-glass-subtle rounded-2xl p-4 shadow-2xl"
            style={{
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Zap size={18} style={{ color: 'var(--premium-purple)' }} />
                </motion.div>
                <span
                  className="text-sm font-medium"
                  style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                >
                  This might connect to
                </span>
              </div>
              <button
                onClick={handleClose}
                className="text-white/40 hover:text-white/60 transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Suggestion Card */}
            <div
              className="premium-glass rounded-xl p-4 mb-3"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl">{getTypeIcon(currentSuggestion.toItemType)}</span>
                <div className="flex-1 min-w-0">
                  <h4
                    className="text-sm font-semibold mb-1 truncate"
                    style={{ color: 'rgba(255, 255, 255, 0.95)' }}
                  >
                    {currentSuggestion.toItemTitle}
                  </h4>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                  >
                    {currentSuggestion.reasoning}
                  </p>
                </div>
              </div>

              {/* Confidence indicator */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${currentSuggestion.confidence * 100}%` }}
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
                  {Math.round(currentSuggestion.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAccept}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--premium-blue)',
                  color: 'white',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <Link2 size={16} />
                Link these
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.6)',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                Not now
              </button>
            </div>

            {/* Counter */}
            {suggestions.length > 1 && (
              <div className="flex items-center justify-center gap-1 mt-3">
                {suggestions.map((_, index) => (
                  <div
                    key={index}
                    className="h-1 rounded-full transition-all"
                    style={{
                      width: index === currentSuggestionIndex ? '16px' : '6px',
                      backgroundColor: index === currentSuggestionIndex
                        ? 'var(--premium-blue)'
                        : 'rgba(255, 255, 255, 0.2)'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
