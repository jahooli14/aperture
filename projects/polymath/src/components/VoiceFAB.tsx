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
      console.log('[VoiceFAB] Global openVoiceCapture event received')
      if (!hidden) {
        setIsVoiceOpen(true)
        setIsMenuOpen(false) // Close menu if it was open
      }
    }
    window.addEventListener('openVoiceCapture', handleOpenVoiceCapture)
    return () => window.removeEventListener('openVoiceCapture', handleOpenVoiceCapture)
  }, [hidden])

  const handleTranscript = (text: string) => {
    onTranscript(text)
    setIsVoiceOpen(false)
  }

  // --- PRESS HANDLING (Unified Pointer Events) ---

  const onStart = useCallback((e: React.PointerEvent) => {
    // Only handle primary button (left click)
    if (e.pointerType === 'mouse' && e.button !== 0) return

    isLongPressRef.current = false
    pressStartTimeRef.current = Date.now()

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)

    pressTimerRef.current = setTimeout(() => {
      if (enablePressAndHold) {
        isLongPressRef.current = true
        haptic.medium()
        setIsMenuOpen(true)
      }
    }, 500)
  }, [enablePressAndHold])

  const onEnd = useCallback((e: React.PointerEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }

    const duration = Date.now() - pressStartTimeRef.current

    // Detect if it was a short press/tap
    if (duration < 500 && !isLongPressRef.current) {
      if (onTap) {
        const handled = onTap()
        if (handled) return
      }

      console.log('[VoiceFAB] Short press detected - Opening voice capture')
      haptic.light()
      setIsVoiceOpen(true)
    }

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
      onPointerDown={onStart}
      onPointerUp={onEnd}
      onPointerLeave={onCancel}
      onPointerCancel={onCancel}
      className={cn(
        "fixed z-[20000]",
        "bottom-28 md:bottom-10 right-5 md:right-10",
        "h-14 w-14 md:h-16 md:w-16 rounded-full",
        "flex items-center justify-center",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        "active:scale-95 transition-all duration-300",
        "group overflow-hidden"
      )}
      style={{
        background: 'rgba(56, 189, 248, 0.15)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.05)'
      }}
      aria-label="Create - Tap for Voice, Hold for Menu"
    >
      <Plus className="h-6 w-6 text-sky-400 transition-transform group-hover:rotate-90 group-hover:text-white" />
      <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.button>
  )

  return (
    <>
      {createPortal(fabButton, document.body)}

      {/* Long Press Menu Overlay */}
      {createPortal(
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              key="menu-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[21000] bg-black/60 backdrop-blur-md flex items-end justify-end p-6 md:p-8"
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="flex flex-col items-end gap-4 mb-20 md:mb-0">
                {[
                  { label: 'New Project', icon: Layers, color: 'bg-blue-600', delay: 0.1, action: () => setShowProjectDialog(true) },
                  { label: 'New Thought', icon: Brain, color: 'bg-purple-600', delay: 0.05, action: () => setShowThoughtDialog(true) },
                  { label: 'Save Article', icon: BookmarkPlus, color: 'bg-emerald-600', delay: 0, action: () => setShowArticleDialog(true) }
                ].map((item) => (
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
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Voice Recording Modal */}
      {createPortal(
        <AnimatePresence>
          {isVoiceOpen && (
            <div className="fixed inset-0 z-[21000] flex items-end md:items-center md:justify-center">
              <motion.div
                key="voice-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setIsVoiceOpen(false)}
              />

              <motion.div
                key="voice-modal"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full md:w-[500px] premium-card rounded-t-3xl md:rounded-2xl shadow-2xl z-10 overflow-hidden"
                style={{ backgroundColor: 'var(--premium-surface-1)' }}
              >
                <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
                  <div className="flex justify-center pt-4 pb-2 md:hidden">
                    <div className="w-12 h-1.5 rounded-full bg-white/20" />
                  </div>

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
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Dialogs */}
      <CreateProjectDialog isOpen={showProjectDialog} onOpenChange={setShowProjectDialog} hideTrigger />
      <CreateMemoryDialog isOpen={showThoughtDialog} onOpenChange={setShowThoughtDialog} hideTrigger />
      <SaveArticleDialog open={showArticleDialog} onClose={() => setShowArticleDialog(false)} />
    </>
  )
}
