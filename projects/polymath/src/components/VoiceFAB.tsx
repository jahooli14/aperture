/**
 * Universal Action FAB (Formerly VoiceFAB)
 * Android Material Design pattern for global creation
 * Tap to open voice capture / Long-press for menu
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Brain, Layers, BookmarkPlus, Mic } from 'lucide-react'
import { VoiceInput } from './VoiceInput'
import { cn } from '../lib/utils'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { haptic } from '../utils/haptics'
import { CreateMemoryDialog } from './memories/CreateMemoryDialog'
import { CreateProjectDialog } from './projects/CreateProjectDialog'
import { SaveArticleDialog } from './reading/SaveArticleDialog'
import { AnimatePresence, motion } from 'framer-motion'

interface VoiceFABProps {
  onTranscript: (text: string) => void
  maxDuration?: number
  enablePressAndHold?: boolean // Allow disabling press-and-hold for specific pages
  hidden?: boolean
  onTap?: () => boolean | void // Return true to prevent default voice open
}

export function VoiceFAB({
  onTranscript,
  maxDuration = 60,
  enablePressAndHold = true,
  hidden = false,
  onTap
}: VoiceFABProps) {
  const [isVoiceOpen, setIsVoiceOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Dialog States
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showThoughtDialog, setShowThoughtDialog] = useState(false)
  const [showArticleDialog, setShowArticleDialog] = useState(false)

  const { isOnline } = useOnlineStatus()
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const isLongPress = useRef(false)

  // Listen for external open triggers
  useEffect(() => {
    const handleOpenVoiceCapture = () => {
      if (!hidden) {
        setIsVoiceOpen(true)
      }
    }
    window.addEventListener('openVoiceCapture', handleOpenVoiceCapture)
    return () => window.removeEventListener('openVoiceCapture', handleOpenVoiceCapture)
  }, [isOnline, hidden])

  const handleTranscript = (text: string) => {
    onTranscript(text)
    setIsVoiceOpen(false)
  }

  const startPress = () => {
    isLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      if (enablePressAndHold) {
        haptic.medium()
        setIsMenuOpen(true)
      }
    }, 500) // 500ms long press
  }

  const handleClick = (e: React.MouseEvent) => {
    // Stop propagation to prevent accidental backdrop clicks if any
    e.stopPropagation()

    if (!isLongPress.current && !isMenuOpen) {
      if (onTap) {
        const handled = onTap()
        if (handled) return
      }

      console.log('[VoiceFAB] Short press - opening voice capture')
      haptic.light()
      setIsVoiceOpen(true)
    }
  }

  const endPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }

    // Handle touch snappy behavior but prevent ghost clicks
    if (e.type === 'touchend' && !isLongPress.current && !isMenuOpen) {
      e.preventDefault() // Stop ghost click from hitting whatever appears underneath

      if (onTap) {
        const handled = onTap()
        if (handled) return
      }

      console.log('[VoiceFAB] Touchend - opening voice capture')
      haptic.light()
      setIsVoiceOpen(true)
    }
  }

  const cancelPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Close menu when clicking outside (handled by backdrop in menu render)

  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!isVoiceOpen && !isMenuOpen && !hidden && (
          <motion.button
            data-voice-fab
            onClick={handleClick}
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={cancelPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "fixed z-[10000]",
              "bottom-24 md:bottom-6 right-4 md:right-6",
              "h-14 w-14 md:h-16 md:w-16 rounded-full",
              "shadow-lg hover:shadow-xl",
              "flex items-center justify-center",
              "group"
            )}
            style={{
              background: 'var(--premium-bg-3)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            aria-label="Create - Tap for Voice, Hold for Menu"
          >
            {/* Pulsing effect container */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-blue-500"></div>
            </div>

            <Plus className="h-6 w-6 relative z-10 transition-transform group-hover:rotate-90 group-active:scale-90" style={{ color: 'var(--premium-blue)' }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Long Press Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[11000] bg-black/60 backdrop-blur-sm flex items-end justify-end p-6 md:p-8"
            onClick={() => setIsMenuOpen(false)}
          >
            <div className="flex flex-col items-end gap-4 mb-20 md:mb-0">

              {/* Menu Items */}
              <motion.button
                initial={{ opacity: 0, x: 20, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20, y: 20 }}
                transition={{ delay: 0.1 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProjectDialog(true)
                  setIsMenuOpen(false)
                }}
                className="flex items-center gap-3 group"
              >
                <span className="bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-medium backdrop-blur-md border border-white/10 shadow-lg">New Project</span>
                <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg border border-white/20 group-hover:scale-110 transition-transform">
                  <Layers className="h-5 w-5 text-white" />
                </div>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 20, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20, y: 20 }}
                transition={{ delay: 0.05 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowThoughtDialog(true)
                  setIsMenuOpen(false)
                }}
                className="flex items-center gap-3 group"
              >
                <span className="bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-medium backdrop-blur-md border border-white/10 shadow-lg">New Thought</span>
                <div className="h-12 w-12 rounded-full bg-purple-600 flex items-center justify-center shadow-lg border border-white/20 group-hover:scale-110 transition-transform">
                  <Brain className="h-5 w-5 text-white" />
                </div>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 20, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20, y: 20 }}
                transition={{ delay: 0 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowArticleDialog(true)
                  setIsMenuOpen(false)
                }}
                className="flex items-center gap-3 group"
              >
                <span className="bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-medium backdrop-blur-md border border-white/10 shadow-lg">Save Article</span>
                <div className="h-12 w-12 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg border border-white/20 group-hover:scale-110 transition-transform">
                  <BookmarkPlus className="h-5 w-5 text-white" />
                </div>
              </motion.button>

              {/* Close Menu Button (Trigger position) */}
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-slate-800 flex items-center justify-center shadow-xl border border-white/10 mt-2 hover:bg-slate-700 transition-colors"
              >
                <X className="h-6 w-6 text-white" />
              </motion.button>
            </div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* Voice Recording Modal */}
      <AnimatePresence>
        {isVoiceOpen && createPortal(
          <div className="fixed inset-0 z-[11000] flex items-end md:items-center md:justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation()
                // Small delay to prevent accidental closures from the same event
                console.log('[VoiceFAB] Backdrop clicked - closing')
                setIsVoiceOpen(false)
              }}
            />

            {/* Bottom Sheet / Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full md:w-[500px] premium-card rounded-t-3xl md:rounded-2xl shadow-2xl z-10 overflow-hidden"
              style={{ backgroundColor: 'var(--premium-surface-1)' }}
            >
              <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Handle */}
                <div className="flex justify-center pt-4 pb-2">
                  <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: 'var(--premium-text-tertiary)', opacity: 0.3 }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
                      Voice Capture
                    </h3>
                    {!isOnline && (
                      <p className="text-sm mt-1" style={{ color: 'var(--premium-amber)' }}>Offline mode</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      haptic.light()
                      setIsVoiceOpen(false)
                    }}
                    className="h-11 w-11 rounded-full premium-glass-subtle flex items-center justify-center transition-all active:scale-90 touch-manipulation hover:bg-white/10 btn-ripple"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" style={{ color: 'var(--premium-text-secondary)' }} />
                  </button>
                </div>

                {/* Voice Input */}
                <div className="px-6 pb-6">
                  <VoiceInput
                    onTranscript={handleTranscript}
                    maxDuration={maxDuration}
                    autoSubmit={true}
                    autoStart={true}
                  />
                  {!isOnline && (
                    <p className="mt-4 text-sm p-3 rounded-lg border" style={{
                      color: 'var(--premium-amber)',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      borderColor: 'rgba(245, 158, 11, 0.3)'
                    }}>
                      You're offline. This capture will sync automatically when you're back online.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Connected Dialogs */}
      <CreateProjectDialog
        isOpen={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        hideTrigger={true}
      />
      <CreateMemoryDialog
        isOpen={showThoughtDialog}
        onOpenChange={setShowThoughtDialog}
        hideTrigger={true}
      />
      <SaveArticleDialog
        open={showArticleDialog}
        onClose={() => setShowArticleDialog(false)}
      />
    </>
  )
}
