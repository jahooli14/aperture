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
import { Plus, X, Brain, Layers, BookmarkPlus, Mic, ListPlus } from 'lucide-react'
import { VoiceInput } from './VoiceInput'
import { cn } from '../lib/utils'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { haptic } from '../utils/haptics'
import { CreateMemoryDialog } from './memories/CreateMemoryDialog'
import { CreateProjectDialog } from './projects/CreateProjectDialog'
import { SaveArticleDialog } from './reading/SaveArticleDialog'
import { AddItemToListDialog } from './lists/AddItemToListDialog'
import { CreateMenuModal } from './CreateMenuModal'
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
  const [showListDialog, setShowListDialog] = useState(false)

  const { isOnline } = useOnlineStatus()

  // Timing refs for press handling
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pressStartTimeRef = useRef<number>(0)
  const isLongPressRef = useRef<boolean>(false)
  const [isHoldRecording, setIsHoldRecording] = useState(false)

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
    // Only handle primary button (left click / touch)
    if (e.pointerType === 'mouse' && e.button !== 0) return

    isLongPressRef.current = false
    pressStartTimeRef.current = Date.now()

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)

    pressTimerRef.current = setTimeout(() => {
      // Long press detected
      isLongPressRef.current = true
      haptic.medium()

      // Start dictation immediately
      setIsHoldRecording(true)
      setIsVoiceOpen(true)
    }, 400)
  }, [])

  const onEnd = useCallback((e: React.PointerEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }

    const duration = Date.now() - pressStartTimeRef.current

    // Short press: Open Menu
    if (duration < 400 && !isLongPressRef.current) {
      if (onTap) {
        const handled = onTap()
        if (handled) return
      }

      console.log('[VoiceFAB] Short press - Opening Creation Menu')
      haptic.light()
      setIsMenuOpen(true)
    }

    // Long press ended: Stop recording if we were hold-recording
    if (isHoldRecording) {
      console.log('[VoiceFAB] Long press ended - Releasing hold-recording state')
      // Note: We don't necessarily close the voice modal here, 
      // but we indicate the hold is done. 
      // The user might want to see the transcript before closing.
      // However, the requirement is "for as long as the button is held".
      // We'll let the VoiceInput stop and then keep the modal open to show result?
      // Or auto-close if auto-submit is true.
      setIsHoldRecording(false)
    }

    isLongPressRef.current = false
  }, [onTap, isHoldRecording])

  const onCancel = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (isHoldRecording) {
      setIsHoldRecording(false)
    }
    isLongPressRef.current = false
  }, [isHoldRecording])

  // --- RENDER ---

  const fabButton = (
    <motion.button
      id="global-voice-fab"
      key="fab-button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: (hidden || isMenuOpen) ? 0 : 1,
        opacity: (hidden || isMenuOpen) ? 0 : 1,
        pointerEvents: (hidden || isMenuOpen) ? 'none' : 'auto',
        backgroundColor: isHoldRecording ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        borderColor: isHoldRecording ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.1)'
      }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      onPointerDown={onStart}
      onPointerUp={onEnd}
      onPointerLeave={onCancel}
      onPointerCancel={onCancel}
      className={cn(
        "fixed z-[25001]", // Higher than menu modal
        "bottom-28 md:bottom-12 right-6 md:right-12",
        "h-14 w-14 md:h-16 md:w-16 rounded-full",
        "flex items-center justify-center",
        "shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
        "active:scale-95 transition-all duration-300",
        "group overflow-hidden touch-none"
      )}
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isHoldRecording
          ? '0 0 30px rgba(239, 68, 68, 0.4), inset 0 0 10px rgba(239, 68, 68, 0.2)'
          : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.02)'
      }}
      aria-label="Create - Tap for Menu, Hold to Record"
    >
      {isHoldRecording ? (
        <Mic className="h-6 w-6 text-red-400 animate-pulse" />
      ) : (
        <Plus className="h-6 w-6 text-zinc-300 transition-transform group-hover:rotate-90 group-hover:text-white" />
      )}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Pulse Rings during hold */}
      <AnimatePresence>
        {isHoldRecording && (
          <>
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.8, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 rounded-full border-2 border-red-500/30"
            />
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
              className="absolute inset-0 rounded-full border-2 border-red-500/10"
            />
          </>
        )}
      </AnimatePresence>
    </motion.button>
  )

  return (
    <>
      {createPortal(fabButton, document.body)}

      <CreateMenuModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onAction={(action) => {
          // Small delay to ensure menu modal has closed before opening the next dialog
          setTimeout(() => {
            if (action === 'thought') setShowThoughtDialog(true)
            if (action === 'project') setShowProjectDialog(true)
            if (action === 'article') setShowArticleDialog(true)
            if (action === 'list') setShowListDialog(true)
          }, 100)
        }}
      />

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
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={() => {
                  if (!isHoldRecording) setIsVoiceOpen(false)
                }}
              />

              <motion.div
                key="voice-modal"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full md:w-[500px] bg-[#0A0A0B] border border-white/10 rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl z-10 overflow-hidden mb-0 md:mb-12"
              >
                <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
                  {/* Handle for mobile */}
                  <div className="flex justify-center pt-4 pb-2 md:hidden">
                    <div className="w-12 h-1.5 rounded-full bg-white/10" />
                  </div>

                  <div className="flex items-center justify-between px-8 py-8">
                    <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                        <Mic className={cn("h-6 w-6", isHoldRecording ? "text-red-500 animate-pulse" : "text-sky-400")} />
                        {isHoldRecording ? 'Recording...' : 'Voice Capture'}
                      </h3>
                      <p className="text-sm text-zinc-500 mt-1 font-medium">
                        {isOnline ? 'Transcribing in real-time' : 'Offline mode - will sync later'}
                      </p>
                    </div>
                    {!isHoldRecording && (
                      <button
                        onClick={() => setIsVoiceOpen(false)}
                        className="h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/5"
                      >
                        <X className="h-6 w-6 text-zinc-400" />
                      </button>
                    )}
                  </div>

                  <div className="px-8 pb-10">
                    <VoiceInput
                      onTranscript={handleTranscript}
                      maxDuration={maxDuration}
                      autoSubmit={true}
                      autoStart={true}
                      shouldStop={!isHoldRecording} // Custom prop to signal stop
                    />

                    {isHoldRecording && (
                      <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center">
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full">
                          <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Release to Finish</span>
                        </div>
                      </div>
                    )}
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
      <AddItemToListDialog isOpen={showListDialog} onOpenChange={setShowListDialog} />
    </>
  )
}
