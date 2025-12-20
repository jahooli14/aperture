/**
 * PWA Install Banner
 * Prompts users to install the app on their device
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone } from 'lucide-react'
import { usePWA } from '../hooks/usePWA'
import { haptic } from '../utils/haptics'

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, promptInstall, dismissInstall } = usePWA()
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      const daysSinceDismiss = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)

      // Show again after 7 days
      if (daysSinceDismiss < 7) {
        return
      }
    }

    // Show banner if installable and not already installed
    if (isInstallable && !isInstalled) {
      // Delay showing banner by 3 seconds to not interrupt initial load
      const timer = setTimeout(() => {
        setShowBanner(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isInstallable, isInstalled])

  const handleInstall = async () => {
    haptic.light()
    setShowBanner(false)
    await promptInstall()
  }

  const handleDismiss = () => {
    haptic.light()
    setShowBanner(false)
    dismissInstall()
  }

  if (!showBanner) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-24 left-4 right-4 z-50 md:left-auto md:right-8 md:w-96"
      >
        <div
          className="premium-glass-strong border rounded-2xl p-5 shadow-2xl"
          style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}
        >
          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--premium-text-tertiary)' }}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Icon */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))'
              }}
            >
              <Smartphone className="h-6 w-6 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                Install Aperture
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                Install on your device for a faster, app-like experience with offline support
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2 mb-4">
            {[
              'Works offline',
              'Faster loading',
              'Home screen shortcut',
              'No browser chrome'
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--premium-blue)' }} />
                {feature}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium border transition-all"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-secondary)'
              }}
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                color: 'white',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              <Download className="h-4 w-4" />
              Install
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
