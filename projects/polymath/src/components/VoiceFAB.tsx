/**
 * Universal Action FAB (Formerly VoiceFAB)
 * Android Material Design pattern for global creation
 * Tap to open voice capture / Long-press for menu
 * 
 * DESIGN: Premium Glassmorphic, Fixed position, High Z-Index
 * BEHAVIOR: Robust touch/click handling to prevent vanishing or ghost clicks
 */

import { useState, useRef, useEffect, useCallback } from 'react'
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
  enablePressAndHold?: boolean
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

  // Timing refs for press handling
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pressStartTimeRef = useRef<number>(0)
  const isLongPressRef = useRef<boolean>(false)

  // Global trigger listener
  useEffect(() => {
    const handleOpenVoiceCapture = () => {
      if (!hidden) setIsVoiceOpen(true)
    }
    window.addEventListener('openVoiceCapture', handleOpenVoiceCapture)
    return () => window.removeEventListener('openVoiceCapture', handleOpenVoiceCapture)
  }, [hidden])

  const handleTranscript = (text: string) => {
    onTranscript(text)
    setIsVoiceOpen(false)
  }

  // --- PRESS HANDLING ---

  const onStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default context menu on long press for touch
    if (e.type === 'touchstart') {
      // We don't preventDefault here as it might block scroll if not positioned fixed correctly,
      // but since it's a FAB, it's fine. 
      // Actually, better to just let it be.
    }

    isLongPressRef.current = false
    pressStartTimeRef.current = Date.now()

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)

    pressTimerRef.current = setTimeout(() => {
      if (enablePressAndHold) {
        isLongPressRef.current = true
        haptic.medium()
        setIsMenuOpen(true)
      }
    }, 500) // 500ms for long press
  }, [enablePressAndHold])

  const onEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }

    const duration = Date.now() - pressStartTimeRef.current

    // Detect if it was a short press
    if (duration < 500 && !isLongPressRef.current) {
      // It's a tap
      if (onTap) {
        const handled = onTap()
        if (handled) return
      }

      console.log('[VoiceFAB] Tap detected - Opening voice capture')
      haptic.light()
      setIsVoiceOpen(true)
    }

    // Reset refs
    isLongPressRef.current = false
  }, [onTap])

  const onCancel = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    isLongPressRef.current = false
  }, [])

  // --- RENDER ---

  const fabButton = (
    <motion.button
      id="global-voice-fab"
      key="fab-button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: (hidden || isVoiceOpen || isMenuOpen) ? 0 : 1,
        opacity: (hidden || isVoiceOpen || isMenuOpen) ? 0 : 1,
        pointerEvents: (hidden || isVoiceOpen || isMenuOpen) ? 'none' : 'auto'
      }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      onMouseDown={onStart}
      onMouseUp={onEnd}
      onMouseLeave={onCancel}
      onTouchStart={onStart}
      onTouchEnd={onEnd}
      onTouchCancel={onCancel}
      className={cn(
        "fixed z-[20000]", // Ultra high z-index
        "bottom-24 md:bottom-8 right-4 md:right-8",
        "h-14 w-14 md:h-16 md:w-16 rounded-full",
        "flex items-center justify-center",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        "active:scale-90 transition-transform",
        "group"
      )}
      style={{
        background: 'linear-gradient(135deg, var(--premium-blue) 0%, #1d4ed8 100%)',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
      }}
      aria-label="Create - Tap for Voice, Hold for Menu"
    >
      <Plus className="h-6 w-6 text-white transition-transform group-hover:rotate-90" />

      {/* Pulse effect */}
      <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:animate-ping group-hover:opacity-10" />
    </motion.button>
  )

  return (
    <>
      {/* FAB stays in DOM but scales to 0 when hidden/active */}
      {createPortal(fabButton, document.body)}

      {/* Long Press Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[21000] bg-black/60 backdrop-blur-md flex items-end justify-end p-6 md:p-8"
            onClick={() => setIsMenuOpen(false)}
          >
            <div className="flex flex-col items-end gap-4 mb-20 md:mb-0">

              {/* Menu Items */}
              {[
                { label: 'New Project', icon: Layers, color: 'bg-blue-600', delay: 0.1, action: () => setShowProjectDialog(true) },
                { label: 'New Thought', icon: Brain, color: 'bg-purple-600', delay: 0.05, action: () => setShowThoughtDialog(true) },
                { label: 'Save Article', icon: BookmarkPlus, color: 'bg-emerald-600', delay: 0, action: () => setShowArticleDialog(true) }
              ].map((item, idx) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: 20, y: 10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 20, y: 10 }}
                  transition={{ delay: item.delay }}
                  onClick={(e) => {
                    e.stopPropagation()
                    item.action()
                    setIsMenuOpen(false)
                  }}
                  className="flex items-center gap-3 group"
                >
                  <span className="bg-black/90 text-white px-3 py-1.5 rounded-lg text-sm font-semibold border border-white/10 shadow-xl">
                    {item.label}
                  </span>
                  <div className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center shadow-2xl border border-white/20 group-hover:scale-110 active:scale-95 transition-all",
                    item.color
                  )}>
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                </motion.button>
              ))}

              {/* Close Menu Button */}
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
          <div className="fixed inset-0 z-[21000] flex items-end md:items-center md:justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsVoiceOpen(false)}
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
              <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
                {/* Handle */}
                <div className="flex justify-center pt-4 pb-2 md:hidden">
                  <div className="w-12 h-1.5 rounded-full bg-white/20" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Voice Capture</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {isOnline ? 'Transcribing in real-time...' : 'Offline mode - will sync later'}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsVoiceOpen(false)}
                    className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>

                {/* Voice Input Body */}
                <div className="px-6 pb-8">
                  <VoiceInput
                    onTranscript={handleTranscript}
                    maxDuration={maxDuration}
                    autoSubmit={true}
                    autoStart={true}
                  />
                </div>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Dialogs */}
      <CreateProjectDialog isOpen={showProjectDialog} onOpenChange={setShowProjectDialog} hideTrigger />
      <CreateMemoryDialog isOpen={showThoughtDialog} onOpenChange={setShowThoughtDialog} hideTrigger />
      <SaveArticleDialog open={showArticleDialog} onClose={() => setShowArticleDialog(false)} />
    </>
  )
}
