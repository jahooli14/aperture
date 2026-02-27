/**
 * Universal Action FAB
 *
 * TAP  → Opens creation menu (Thought / Project / Article / List)
 * HOLD → Radial fan appears with 3 quick options:
 *          • Keep finger on FAB  → Voice Note (default, pulsing mic)
 *          • Slide up            → Quick Thought (text)
 *          • Slide up-left       → New Project
 *          • Slide left          → Save Article
 *        Release to execute the highlighted option.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Brain, Layers, BookmarkPlus, Mic } from 'lucide-react'
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
  onTap?: () => boolean | void
}

const LONG_PRESS_DELAY = 400 // ms

// Options that appear in the fan
const FAN_OPTIONS = [
  {
    id: 'thought' as const,
    label: 'Thought',
    icon: Brain,
    // Position offset from FAB center (negative = up/left on screen)
    // FAB is bottom-right, so options fan up and to the left
    offsetX: -4,   // slight left
    offsetY: -90,  // directly above
    glowColor: 'rgba(139, 92, 246, 0.6)',
    bg: 'rgba(139, 92, 246, 0.25)',
    border: 'rgba(139, 92, 246, 0.5)',
    activeBg: 'rgba(139, 92, 246, 0.5)',
  },
  {
    id: 'project' as const,
    label: 'Project',
    icon: Layers,
    offsetX: -76,  // left
    offsetY: -76,  // and up
    glowColor: 'rgba(59, 130, 246, 0.6)',
    bg: 'rgba(59, 130, 246, 0.25)',
    border: 'rgba(59, 130, 246, 0.5)',
    activeBg: 'rgba(59, 130, 246, 0.5)',
  },
  {
    id: 'article' as const,
    label: 'Article',
    icon: BookmarkPlus,
    offsetX: -96,  // further left
    offsetY: -4,   // same height as FAB
    glowColor: 'rgba(16, 185, 129, 0.6)',
    bg: 'rgba(16, 185, 129, 0.25)',
    border: 'rgba(16, 185, 129, 0.5)',
    activeBg: 'rgba(16, 185, 129, 0.5)',
  },
] as const

type FanOptionId = typeof FAN_OPTIONS[number]['id']

export function VoiceFAB({
  onTranscript,
  maxDuration = 60,
  hidden = false,
  onTap,
}: VoiceFABProps) {
  const [isVoiceOpen, setIsVoiceOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showThoughtDialog, setShowThoughtDialog] = useState(false)
  const [showArticleDialog, setShowArticleDialog] = useState(false)
  const [showListDialog, setShowListDialog] = useState(false)

  // Fan menu state
  const [isFanOpen, setIsFanOpen] = useState(false)
  const [activeOption, setActiveOption] = useState<FanOptionId | null>(null)

  const { isOnline } = useOnlineStatus()

  // Timing refs
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pressStartTimeRef = useRef<number>(0)
  const isLongPressRef = useRef<boolean>(false)

  // Sync refs (so event handlers always see current values without re-memoizing)
  const isFanOpenRef = useRef(false)
  const activeOptionRef = useRef<FanOptionId | null>(null)

  // DOM refs for fan option hit detection
  const fabRef = useRef<HTMLButtonElement>(null)
  const optionRefsMap = useRef<Map<FanOptionId, HTMLElement>>(new Map())

  // Global event to open voice capture from elsewhere
  useEffect(() => {
    const handleOpenVoiceCapture = () => {
      if (!hidden) {
        setIsVoiceOpen(true)
        setIsMenuOpen(false)
      }
    }
    window.addEventListener('openVoiceCapture', handleOpenVoiceCapture)
    return () => window.removeEventListener('openVoiceCapture', handleOpenVoiceCapture)
  }, [hidden])

  const handleTranscript = (text: string) => {
    onTranscript(text)
    setIsVoiceOpen(false)
  }

  // --- Hit Detection ---

  const detectOption = useCallback((clientX: number, clientY: number): FanOptionId | null => {
    const HIT_PAD = 24 // Extra px around each option for easier targeting
    for (const [id, el] of optionRefsMap.current.entries()) {
      const rect = el.getBoundingClientRect()
      if (
        clientX >= rect.left - HIT_PAD &&
        clientX <= rect.right + HIT_PAD &&
        clientY >= rect.top - HIT_PAD &&
        clientY <= rect.bottom + HIT_PAD
      ) {
        return id
      }
    }
    return null
  }, [])

  // --- Fan Execute ---

  const executeFan = useCallback((option: FanOptionId | null) => {
    isFanOpenRef.current = false
    activeOptionRef.current = null
    setIsFanOpen(false)
    setActiveOption(null)
    isLongPressRef.current = false

    if (option === 'thought') {
      setShowThoughtDialog(true)
    } else if (option === 'project') {
      setShowProjectDialog(true)
    } else if (option === 'article') {
      setShowArticleDialog(true)
    } else {
      // Default: open voice capture
      setIsVoiceOpen(true)
    }
  }, [])

  // --- Press Handlers ---

  const onStart = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return

    // Capture pointer so pointermove/pointerup fire even when finger slides off the button
    // This is automatic for touch but needed explicitly for mouse
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }

    isLongPressRef.current = false
    pressStartTimeRef.current = Date.now()

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)

    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      haptic.medium()
      isFanOpenRef.current = true
      activeOptionRef.current = null
      setIsFanOpen(true)
      setActiveOption(null)
    }, LONG_PRESS_DELAY)
  }, [])

  const onMove = useCallback((e: React.PointerEvent) => {
    // Only track if fan is open (use ref to avoid stale closure)
    if (!isFanOpenRef.current) return

    const detected = detectOption(e.clientX, e.clientY)

    if (detected !== activeOptionRef.current) {
      if (detected !== null) haptic.light() // Subtle haptic when sliding onto an option
      activeOptionRef.current = detected
      setActiveOption(detected)
    }
  }, [detectOption])

  const onEnd = useCallback((_e: React.PointerEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }

    const duration = Date.now() - pressStartTimeRef.current

    if (isFanOpenRef.current) {
      // Fan was open — execute whatever option is highlighted (null = voice)
      haptic.light()
      executeFan(activeOptionRef.current)
      return
    }

    // Short press (no fan opened): open creation menu
    if (duration < LONG_PRESS_DELAY && !isLongPressRef.current) {
      if (onTap) {
        const handled = onTap()
        if (handled) return
      }
      haptic.light()
      setIsMenuOpen(true)
    }

    isLongPressRef.current = false
  }, [onTap, executeFan])

  // pointerLeave fires when finger slides off the FAB — cancel pre-fan timer
  // but DON'T close the fan if it's already open (user is sliding to an option)
  const onLeave = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    // Only cancel if the fan hasn't opened yet
    if (!isFanOpenRef.current) {
      isLongPressRef.current = false
    }
  }, [])

  // pointerCancel is a hard system interruption — close everything
  const onSystemCancel = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (isFanOpenRef.current) {
      isFanOpenRef.current = false
      activeOptionRef.current = null
      setIsFanOpen(false)
      setActiveOption(null)
    }
    isLongPressRef.current = false
  }, [])

  // --- FAB Position (for option pill positioning) ---
  // We compute option pill positions dynamically from the FAB's bounding rect
  // so they work on any screen size. Options fan out above and to the left.
  const getFabCenter = useCallback((): { x: number; y: number } | null => {
    if (!fabRef.current) return null
    const rect = fabRef.current.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }, [])

  // We use the FAB rect computed once when the fan opens, stored in a ref
  const fabCenterRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (isFanOpen) {
      fabCenterRef.current = getFabCenter()
    }
  }, [isFanOpen, getFabCenter])

  // --- Fan Overlay ---

  const fanOverlay = createPortal(
    <AnimatePresence>
      {isFanOpen && (
        <>
          {/* Semi-transparent backdrop — tapping it cancels the fan */}
          <motion.div
            key="fan-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[24990]"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            onPointerDown={() => {
              isFanOpenRef.current = false
              activeOptionRef.current = null
              setIsFanOpen(false)
              setActiveOption(null)
              isLongPressRef.current = false
              if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
            }}
          />

          {/* Option pills — pointer-events: none so swipe events stay on the FAB */}
          {FAN_OPTIONS.map((opt, i) => {
            const isActive = activeOption === opt.id
            const center = fabCenterRef.current

            // Position the pill so its center is at FAB center + offset
            // We anchor by right/bottom to match FAB's own positioning
            const pillW = 120
            const pillH = 44

            // Convert center-offset to fixed right/bottom values
            // right = window.innerWidth - (fabCenterX + opt.offsetX) - pillW/2
            // bottom = window.innerHeight - (fabCenterY + opt.offsetY) - pillH/2
            let rightPx = 12
            let bottomPx = 180 + i * 72
            if (center) {
              rightPx = Math.max(8, window.innerWidth - (center.x + opt.offsetX) - pillW / 2)
              bottomPx = Math.max(8, window.innerHeight - (center.y + opt.offsetY) - pillH / 2)
            }

            return (
              <motion.div
                key={opt.id}
                ref={(el) => {
                  if (el) optionRefsMap.current.set(opt.id, el)
                  else optionRefsMap.current.delete(opt.id)
                }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: 'spring', damping: 18, stiffness: 380, delay: i * 0.045 }}
                className="fixed z-[25000] flex items-center gap-2.5 rounded-2xl select-none"
                style={{
                  right: rightPx,
                  bottom: bottomPx,
                  width: pillW,
                  height: pillH,
                  padding: '0 14px',
                  background: isActive ? opt.activeBg : opt.bg,
                  border: `1px solid ${opt.border}`,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: isActive
                    ? `0 0 24px ${opt.glowColor}, 0 4px 20px rgba(0,0,0,0.4)`
                    : '0 4px 16px rgba(0,0,0,0.35)',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease',
                  pointerEvents: 'none', // Touch events stay on FAB
                }}
              >
                <opt.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-white/80')} />
                <span className={cn('text-sm font-bold tracking-tight', isActive ? 'text-white' : 'text-white/80')}>
                  {opt.label}
                </span>
              </motion.div>
            )
          })}

          {/* Voice label below/on the FAB when fan is open */}
          <motion.div
            key="voice-label"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ delay: 0.1 }}
            className="fixed z-[24995] pointer-events-none"
            style={{
              // Position label just below the FAB
              bottom: fabCenterRef.current
                ? window.innerHeight - fabCenterRef.current.y - 44
                : 70,
              right: fabCenterRef.current
                ? window.innerWidth - fabCenterRef.current.x - 44
                : 4,
              width: 88,
              textAlign: 'center',
            }}
          >
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/50">
              {activeOption
                ? FAN_OPTIONS.find(o => o.id === activeOption)?.label ?? 'Voice'
                : 'Voice Note'}
            </span>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )

  // --- FAB Button ---

  const fabButton = createPortal(
    <motion.button
      id="global-voice-fab"
      ref={fabRef}
      key="fab-button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: (hidden || isMenuOpen) ? 0 : 1,
        opacity: (hidden || isMenuOpen) ? 0 : 1,
        pointerEvents: (hidden || isMenuOpen) ? 'none' : 'auto',
        backgroundColor: isFanOpen && !activeOption
          ? 'rgba(56, 189, 248, 0.2)'  // sky = voice mode
          : 'rgba(255, 255, 255, 0.05)',
        borderColor: isFanOpen && !activeOption
          ? 'rgba(56, 189, 248, 0.5)'
          : 'rgba(255, 255, 255, 0.1)',
      }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      onPointerDown={onStart}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerLeave={onLeave}
      onPointerCancel={onSystemCancel}
      className={cn(
        'fixed z-[25001]',
        'bottom-28 md:bottom-12 right-6 md:right-12',
        'h-14 w-14 md:h-16 md:w-16 rounded-full',
        'flex items-center justify-center',
        'transition-all duration-200',
        'group overflow-hidden touch-none',
      )}
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isFanOpen && !activeOption
          ? '0 0 32px rgba(56, 189, 248, 0.45), 0 8px 32px rgba(0,0,0,0.4)'
          : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.02)',
      }}
      aria-label="Create — Tap for menu, hold for quick options"
    >
      {/* Icon: mic when fan is open (voice = default), plus otherwise */}
      {isFanOpen ? (
        <Mic
          className={cn(
            'h-6 w-6 transition-colors duration-200',
            activeOption ? 'text-zinc-500' : 'text-sky-400',
          )}
        />
      ) : (
        <Plus className="h-6 w-6 text-zinc-300 transition-transform group-hover:rotate-90 group-hover:text-white" />
      )}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Pulse rings when fan is open and voice is the active default */}
      <AnimatePresence>
        {isFanOpen && !activeOption && (
          <>
            <motion.div
              initial={{ scale: 1, opacity: 0.45 }}
              animate={{ scale: 1.9, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="absolute inset-0 rounded-full border-2 border-sky-400/40"
            />
            <motion.div
              initial={{ scale: 1, opacity: 0.3 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2.1, delay: 0.6 }}
              className="absolute inset-0 rounded-full border-2 border-sky-400/15"
            />
          </>
        )}
      </AnimatePresence>
    </motion.button>,
    document.body
  )

  return (
    <>
      {fabButton}
      {fanOverlay}

      {/* Short-press creation menu (unchanged) */}
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
                onClick={() => setIsVoiceOpen(false)}
              />
              <motion.div
                key="voice-modal"
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full md:w-[500px] bg-[#0A0A0B] border border-white/10 rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl z-10 overflow-hidden mb-0 md:mb-12"
              >
                <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
                  {/* Handle */}
                  <div className="flex justify-center pt-4 pb-2 md:hidden">
                    <div className="w-12 h-1.5 rounded-full bg-white/10" />
                  </div>

                  <div className="flex items-center justify-between px-8 py-8">
                    <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                        <Mic className="h-6 w-6 text-sky-400" />
                        Voice Capture
                      </h3>
                      <p className="text-sm text-zinc-500 mt-1 font-medium">
                        {isOnline ? 'Transcribing in real-time' : 'Offline mode — will sync later'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsVoiceOpen(false)}
                      className="h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/5"
                    >
                      <X className="h-6 w-6 text-zinc-400" />
                    </button>
                  </div>

                  <div className="px-8 pb-10">
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
      <SaveArticleDialog open={showArticleDialog} onClose={() => setShowArticleDialog(false)} hideTrigger />
      <AddItemToListDialog isOpen={showListDialog} onOpenChange={setShowListDialog} />
    </>
  )
}
