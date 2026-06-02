/**
 * Universal Action FAB
 *
 * TAP         Create menu (thought / project / list item)
 * DOUBLE-TAP  Voice capture modal (auto-starts recording) — no need to hold
 * HOLD        Push-to-talk voice capture; release to stop
 * HOLD   Slide-up option strip appears above FAB:
 *            Slide up slightly   Thought
 *            Slide up more       Project
 *            Slide up furthest   Article
 *         Release over an option to open it.
 *         Release back on the FAB (no slide)  dismisses, no action.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Brain, Layers, Mic, CheckSquare } from 'lucide-react'
import { VoiceInput } from './VoiceInput'
import { cn } from '../lib/utils'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { haptic } from '../utils/haptics'
import { CreateMemoryDialog } from './memories/CreateMemoryDialog'
import { CreateProjectDialog } from './projects/CreateProjectDialog'
import { AddItemToListDialog } from './lists/AddItemToListDialog'
import { SaveArticleDialog } from './reading/SaveArticleDialog'
import { CreateMenuModal } from './CreateMenuModal'
import { AnimatePresence, motion } from 'framer-motion'

interface VoiceFABProps {
  onTranscript: (text: string) => void
  maxDuration?: number
  enablePressAndHold?: boolean
  hidden?: boolean
  onTap?: () => boolean | void
}

const LONG_PRESS_DELAY = 400 // ms
// Window to catch a second tap. A single tap opens the create menu, so we wait
// this long before committing to it — if a second tap lands, it's voice instead.
const DOUBLE_TAP_DELAY = 280 // ms

// FAB position in px (matches Tailwind bottom-28 right-6 on mobile)
const FAB_BOTTOM = 112
const FAB_RIGHT = 24
const FAB_SIZE = 56

// Option strip: pills stacked directly above the FAB, right-aligned
// Each pill: 44px tall, 12px gap between them
const PILL_H = 44
const PILL_GAP = 10

const STRIP_OPTIONS = [
  {
    id: 'todo' as const,
    label: 'Task',
    icon: CheckSquare,
    color: "var(--brand-text-secondary)",
    activeColor: 'rgba(var(--brand-primary-rgb), 0.55)',
    border: 'rgba(var(--brand-primary-rgb), 0.5)',
    glow: 'rgba(var(--brand-primary-rgb), 0.5)',
    centerOffsetUp: FAB_SIZE / 2 + PILL_GAP + PILL_H / 2,
  },
  {
    id: 'thought' as const,
    label: 'Thought',
    icon: Brain,
    color: "var(--brand-text-secondary)",
    activeColor: 'rgba(var(--brand-primary-rgb), 0.55)',
    border: 'rgba(var(--brand-primary-rgb), 0.5)',
    glow: 'rgba(var(--brand-primary-rgb), 0.5)',
    centerOffsetUp: FAB_SIZE / 2 + PILL_GAP + (PILL_H + PILL_GAP) * 1 + PILL_H / 2,
  },
  {
    id: 'project' as const,
    label: 'Project',
    icon: Layers,
    color: "var(--brand-text-secondary)",
    activeColor: 'rgba(var(--brand-primary-rgb), 0.55)',
    border: 'rgba(var(--brand-primary-rgb), 0.5)',
    glow: 'rgba(var(--brand-primary-rgb), 0.5)',
    centerOffsetUp: FAB_SIZE / 2 + PILL_GAP + (PILL_H + PILL_GAP) * 2 + PILL_H / 2,
  },
] as const

type StripOptionId = typeof STRIP_OPTIONS[number]['id']

const MIN_SLIDE = 20

function getOptionForDy(dy: number): StripOptionId | null {
  const upward = -dy
  if (upward < MIN_SLIDE) return null
  let result: StripOptionId = STRIP_OPTIONS[0].id
  for (let i = 0; i < STRIP_OPTIONS.length; i++) {
    const threshold = i === 0
      ? MIN_SLIDE
      : (STRIP_OPTIONS[i - 1].centerOffsetUp + STRIP_OPTIONS[i].centerOffsetUp) / 2
    if (upward >= threshold) result = STRIP_OPTIONS[i].id
    else break
  }
  return result
}

export function VoiceFAB({
  onTranscript,
  // 3 minutes — long enough to talk through a whole thought without getting
  // cut off mid-sentence. Recording auto-stops and still saves at the cap, so
  // nothing is lost. Stays well within the 25MB audio + Vercel-timeout margins.
  maxDuration = 180,
  hidden = false,
  onTap,
}: VoiceFABProps) {
  const [isVoiceOpen, setIsVoiceOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showThoughtDialog, setShowThoughtDialog] = useState(false)
  const [showListDialog, setShowListDialog] = useState(false)
  const [showArticleDialog, setShowArticleDialog] = useState(false)

  const [shouldStopRecording, setShouldStopRecording] = useState(false)
  const [isLongPressRecording, setIsLongPressRecording] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const { isOnline } = useOnlineStatus()
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pressStartTimeRef = useRef<number>(0)
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null)
  // Double-tap detection: a single tap defers the menu by DOUBLE_TAP_DELAY so a
  // second tap can claim the gesture for voice instead.
  const lastTapTimeRef = useRef<number>(0)
  const tapMenuTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleOpenVoiceCapture = () => {
      if (!hidden) {
        setIsVoiceOpen(true)
        setIsMenuOpen(false)
      }
    }
    const handleTooShort = () => setIsVoiceOpen(false)
    // When a recording is saved offline (no network), close the modal — the
    // audio is safe and FloatingNav shows the "saved offline" toast. Leaving
    // the modal open on "Tap to talk" reads as if nothing happened.
    const handleQueuedOffline = () => setIsVoiceOpen(false)
    window.addEventListener('openVoiceCapture', handleOpenVoiceCapture)
    window.addEventListener('voice-capture-too-short', handleTooShort)
    window.addEventListener('voice-capture-queued-offline', handleQueuedOffline)
    return () => {
      window.removeEventListener('openVoiceCapture', handleOpenVoiceCapture)
      window.removeEventListener('voice-capture-too-short', handleTooShort)
      window.removeEventListener('voice-capture-queued-offline', handleQueuedOffline)
    }
  }, [hidden])

  const handleTranscript = (text: string) => {
    onTranscript(text)
    setIsVoiceOpen(false)
  }

  // Clear any pending timers when the FAB unmounts.
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
      if (tapMenuTimerRef.current) clearTimeout(tapMenuTimerRef.current)
    }
  }, [])

  const closeVoice = useCallback(() => {
    setIsVoiceOpen(false)
    setShouldStopRecording(false)
    setIsLongPressRecording(false)
  }, [])

  // --- Press handlers ---

  const onStart = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    setIsLongPressRecording(false)
    pressStartTimeRef.current = Date.now()
    pressStartPosRef.current = { x: e.clientX, y: e.clientY }
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    // A new press begins before the deferred menu fired — hold the menu so this
    // press can resolve as the second tap (voice) or a hold (voice).
    if (tapMenuTimerRef.current) {
      clearTimeout(tapMenuTimerRef.current)
      tapMenuTimerRef.current = null
    }

    pressTimerRef.current = setTimeout(() => {
      setIsLongPressRecording(true)
      setShouldStopRecording(false)
      haptic.medium()
      setIsVoiceOpen(true)
    }, LONG_PRESS_DELAY)
  }, [])

  // Cancel the long-press timer if the finger moves far enough to be a scroll.
  // Prevents the FAB from hijacking vertical scrolls that start on top of it.
  const onMove = useCallback((e: React.PointerEvent) => {
    if (!pressTimerRef.current || !pressStartPosRef.current) return
    const dx = e.clientX - pressStartPosRef.current.x
    const dy = e.clientY - pressStartPosRef.current.y
    if (dx * dx + dy * dy > 144) { // >12px movement
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
      pressStartPosRef.current = null
    }
  }, [])

  const onEnd = useCallback((_e: React.PointerEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartPosRef.current = null
    const duration = Date.now() - pressStartTimeRef.current

    if (isLongPressRecording) {
      haptic.light()
      setShouldStopRecording(true)
      // We don't close voice open here, it will close when transcript is ready
      return
    }

    // Short tap. Two paths:
    //  - single tap  → create menu (thought / project / list item)
    //  - double tap  → voice capture, so you don't have to hold the FAB down
    // Hold is still the push-to-talk voice path.
    if (duration < LONG_PRESS_DELAY) {
      const now = Date.now()
      if (now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
        // Second tap landed in time — record without holding.
        lastTapTimeRef.current = 0
        if (tapMenuTimerRef.current) {
          clearTimeout(tapMenuTimerRef.current)
          tapMenuTimerRef.current = null
        }
        haptic.medium()
        setIsVoiceOpen(true)
        return
      }
      // First tap — defer the menu so a second tap can override it.
      lastTapTimeRef.current = now
      if (tapMenuTimerRef.current) clearTimeout(tapMenuTimerRef.current)
      tapMenuTimerRef.current = setTimeout(() => {
        tapMenuTimerRef.current = null
        lastTapTimeRef.current = 0
        haptic.light()
        setIsMenuOpen(true)
      }, DOUBLE_TAP_DELAY)
    }
  }, [isLongPressRecording])

  const onLeave = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartPosRef.current = null
    // If they leave while long-press recording, we stop it
    if (isLongPressRecording) {
      setShouldStopRecording(true)
    }
  }, [isLongPressRecording])

  const onSystemCancel = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (tapMenuTimerRef.current) {
      clearTimeout(tapMenuTimerRef.current)
      tapMenuTimerRef.current = null
    }
    pressStartPosRef.current = null
    setIsLongPressRecording(false)
    setIsVoiceOpen(false)
  }, [])

  // --- Pill positions (measured from actual FAB rect, so they work with any safe-area-inset) ---
  const stripOverlay = null; // Removed strip menu

  // Position wrapper holds the centering transform so framer-motion's inline
  // `transform` (driven by scale/opacity animations on the button) doesn't
  // clobber `-translate-x-1/2` and shove the FAB right of centre.
  const fabButton = createPortal(
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[25001] pointer-events-none"
      style={{
        // Raised middle slot — sits above the nav pill so the + reads as
        // elevated. Uses the same safe-area var as FloatingNav's padding
        // so the FAB stays in lockstep with the bar across devices.
        bottom: 'calc(var(--safe-area-inset-bottom, 20px) + 1.75rem)',
      }}
    >
      {/* Soft halo behind the FAB — tightened so it reads as a glow, not a bloom. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: '72px',
          height: '72px',
          background:
            'radial-gradient(circle, rgba(var(--brand-primary-rgb), 0.16) 0%, rgba(var(--brand-primary-rgb), 0.05) 45%, rgba(var(--brand-primary-rgb), 0) 72%)',
          opacity: hidden || isMenuOpen ? 0 : 1,
          transition: 'opacity 200ms ease-out',
        }}
      />
      <motion.button
        id="global-voice-fab"
        ref={fabRef}
        key="fab-button"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: (hidden || isMenuOpen) ? 0 : 1,
          opacity: (hidden || isMenuOpen) ? 0 : 1,
          pointerEvents: (hidden || isMenuOpen) ? 'none' : 'auto',
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        onPointerDown={onStart}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerLeave={onLeave}
        onPointerCancel={onSystemCancel}
        className={cn(
          'relative',
          'h-[54px] w-[54px] md:h-[58px] md:w-[58px] rounded-full',
          'flex items-center justify-center',
          'group overflow-hidden touch-none',
        )}
        style={{
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%),' +
            'linear-gradient(160deg, rgb(var(--color-accent-light-rgb)) 0%, rgb(var(--brand-primary-rgb)) 60%, rgb(var(--color-accent-dark-rgb)) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow:
            '0 10px 24px -8px rgba(var(--brand-primary-rgb), 0.55),' +
            '0 6px 16px rgba(0, 0, 0, 0.40),' +
            '0 0 18px rgba(var(--brand-primary-rgb), 0.22),' +
            'inset 0 1px 0 rgba(255, 255, 255, 0.32),' +
            'inset 0 -2px 6px rgba(0, 0, 0, 0.22)',
        }}
        aria-label="New thought — tap for menu, double-tap or hold to record"
      >
        <Plus
          className="h-6 w-6 text-white transition-transform duration-300 group-hover:rotate-90 relative z-10"
          strokeWidth={2.25}
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.30))' }}
        />
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0))' }}
        />
      </motion.button>
    </div>,
    document.body
  )

  return (
    <>
      {fabButton}
      {stripOverlay}

      {/* Hold hint in CreateMenuModal footer */}
      <CreateMenuModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onAction={(action) => {
          if (action === 'thought') setShowThoughtDialog(true)
          if (action === 'project') setShowProjectDialog(true)
          if (action === 'article') setShowArticleDialog(true)
          if (action === 'list') setShowListDialog(true)
        }}
      />

      {/* Voice modal  opened by short tap */}
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
                onClick={() => setIsVoiceOpen(false)}
              />
              <motion.div
                key="voice-modal"
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full md:w-[500px] bg-[#0A0A0B] border border-[var(--glass-surface-hover)] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl z-10 overflow-hidden mb-0 md:mb-12"
              >
                <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
                  <div className="flex justify-center pt-4 pb-2 md:hidden">
                    <div className="w-12 h-1.5 rounded-full bg-[rgba(255,255,255,0.1)]" />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-5 sm:py-8">
                    <div className="min-w-0 flex-1">
                      <h3 className="page-hero-sm flex items-center gap-2" style={{ fontSize: 'clamp(1.4rem, 4vw, 1.65rem)' }}>
                        <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-brand-primary flex-shrink-0" />
                        <span className="truncate">Capture a thought.</span>
                      </h3>
                      <p className="meta-serif mt-1">
                        {isOnline ? 'Transcribing in real-time' : 'Offline — will sync later'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsVoiceOpen(false)}
                      className="h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 rounded-full bg-[var(--glass-surface)] hover:bg-[rgba(255,255,255,0.1)] flex items-center justify-center transition-all border border-white/10"
                    >
                      <X className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--brand-text-primary)]" />
                    </button>
                  </div>
                  <div className="px-5 sm:px-8 pb-8 sm:pb-10">
                    <VoiceInput
                      onTranscript={handleTranscript}
                      maxDuration={maxDuration}
                      autoSubmit={true}
                      autoStart={true}
                      shouldStop={shouldStopRecording}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <CreateProjectDialog isOpen={showProjectDialog} onOpenChange={setShowProjectDialog} hideTrigger />
      <CreateMemoryDialog
        isOpen={showThoughtDialog}
        onOpenChange={setShowThoughtDialog}
        hideTrigger
        onSwitchType={() => {
          // Let the user jump from thought sheet into the full-type menu
          // without losing what they typed (draft is auto-persisted).
          setShowThoughtDialog(false)
          requestAnimationFrame(() => setIsMenuOpen(true))
        }}
      />
      <AddItemToListDialog isOpen={showListDialog} onOpenChange={setShowListDialog} />
      <SaveArticleDialog isOpen={showArticleDialog} onOpenChange={setShowArticleDialog} />
    </>
  )
}
