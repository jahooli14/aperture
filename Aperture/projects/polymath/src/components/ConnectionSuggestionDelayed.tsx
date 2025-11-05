/**
 * Connection Suggestion with Smart Timing
 * Delays appearance and adds smooth animations
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConnectionSuggestion } from './ConnectionSuggestion'
import type { ConnectionSuggestion as ConnectionSuggestionType } from '../types'

interface ConnectionSuggestionDelayedProps {
  suggestions: ConnectionSuggestionType[]
  sourceType: 'memory' | 'article' | 'project'
  sourceId: string
  onLinkCreated?: (targetId: string, targetType: string) => void
  onDismiss?: () => void
  delay?: number // Delay in milliseconds before showing
}

export function ConnectionSuggestionDelayed({
  suggestions,
  sourceType,
  sourceId,
  onLinkCreated,
  onDismiss,
  delay = 3000
}: ConnectionSuggestionDelayedProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if user has dismissed suggestions for this item
    const dismissedKey = `connection-dismissed-${sourceType}-${sourceId}`
    const wasDismissed = sessionStorage.getItem(dismissedKey) === 'true'

    if (wasDismissed) {
      setIsDismissed(true)
      return
    }

    // Delay the appearance
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [sourceType, sourceId, delay])

  const handleDismiss = () => {
    // Remember dismissal for this session
    const dismissedKey = `connection-dismissed-${sourceType}-${sourceId}`
    sessionStorage.setItem(dismissedKey, 'true')
    setIsVisible(false)
    onDismiss?.()
  }

  if (isDismissed || suggestions.length === 0) {
    return null
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            duration: 0.4
          }}
        >
          <ConnectionSuggestion
            suggestions={suggestions}
            sourceType={sourceType}
            sourceId={sourceId}
            onLinkCreated={onLinkCreated}
            onDismiss={handleDismiss}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
