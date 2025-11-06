/**
 * PWA Update Notification
 * Shows notification when a new version is available
 */

import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { usePWA } from '../hooks/usePWA'
import { haptic } from '../utils/haptics'
import { useState, useEffect } from 'react'

export function PWAUpdateNotification() {
  const { isUpdateAvailable } = usePWA()
  const [dismissed, setDismissed] = useState(false)

  // Check if this update was already dismissed
  useEffect(() => {
    if (isUpdateAvailable) {
      const dismissedUpdate = localStorage.getItem('pwa-update-dismissed')
      if (dismissedUpdate) {
        // If dismissed less than 1 hour ago, keep it dismissed
        const dismissedTime = parseInt(dismissedUpdate)
        const oneHour = 60 * 60 * 1000
        if (Date.now() - dismissedTime < oneHour) {
          setDismissed(true)
        } else {
          // Clear old dismissal
          localStorage.removeItem('pwa-update-dismissed')
        }
      }
    }
  }, [isUpdateAvailable])

  const handleUpdate = () => {
    haptic.light()
    // Clear dismissal flag before reloading
    localStorage.removeItem('pwa-update-dismissed')

    // Skip the waiting service worker to activate immediately
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          // Tell the waiting service worker to skip waiting and become active
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    }

    // Reload after a brief delay to let the skip_waiting message process
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const handleDismiss = () => {
    haptic.light()
    setDismissed(true)
    // Store dismissal time so it doesn't show again for an hour
    localStorage.setItem('pwa-update-dismissed', Date.now().toString())
  }

  if (!isUpdateAvailable || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-8 md:w-96"
      >
        <div
          className="premium-glass-strong border rounded-2xl p-4 shadow-2xl"
          style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
        >
          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--premium-text-tertiary)' }}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--premium-emerald), var(--premium-blue))'
              }}
            >
              <RefreshCw className="h-5 w-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                Update Available
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                A new version of Polymath is ready. Refresh to get the latest features and improvements.
              </p>
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handleUpdate}
            className="w-full px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--premium-emerald), var(--premium-blue))',
              color: 'white',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Update Now
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
