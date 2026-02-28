/**
 * Universal Action FAB
 *
 * TAP   → Voice capture modal (auto-starts recording)
 * HOLD  → Slide-up option strip appears above FAB:
 *            Slide up slightly  → Thought
 *            Slide up more      → Project
 *            Slide up furthest  → Article
 *         Release over an option to open it.
 *         Release back on the FAB (no slide) → dismisses, no action.
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
    id: 'thought' as const,
    label: 'Thought',
    icon: Brain,
    color: 'rgba(139, 92, 246, 0.3)',
    activeColor: 'rgba(139, 92, 246, 0.55)',
    border: 'rgba(139, 92, 246, 0.5)',
    glow: 'rgba(139, 92, 246, 0.5)',
    // Distance of this pill's CENTER from FAB center (upward)
    centerOffsetUp: FAB_SIZE / 2 + PILL_GAP + PILL_H / 2,          // ~62px
  },
  {
    id: 'project' as const,
    label: 'Project',
    icon: Layers,
    color: 'rgba(59, 130, 246, 0.3)',
    activeColor: 'rgba(59, 130, 246, 0.55)',
    border: 'rgba(59, 130, 246, 0.5)',
    glow: 'rgba(59, 130, 246, 0.5)',
    centerOffsetUp: FAB_SIZE / 2 + PILL_GAP + PILL_H + PILL_GAP + PILL_H / 2, // ~118px
  },
  {
    id: 'article' as const,
    label: 'Article',
    icon: BookmarkPlus,
    color: 'rgba(16, 185, 129, 0.3)',
    activeColor: 'rgba(16, 185, 129, 0.55)',
    border: 'rgba(16, 185, 129, 0.5)',
    glow: 'rgba(16, 185, 129, 0.5)',
    centerOffsetUp: FAB_SIZE / 2 + PILL_GAP + (PILL_H + PILL_GAP) * 2 + PILL_H / 2, // ~174px
  },
] as const

type StripOptionId = typeof STRIP_OPTIONS[number]['id']

// Y-offset thresholds: how far above the FAB center the finger must be
// to activate each option. Half-way between adjacent pill centers.
const THOUGHT_THRESHOLD = (STRIP_OPTIONS[0].centerOffsetUp + STRIP_OPTIONS[1].centerOffsetUp) / 2  // ~90px
const PROJECT_THRESHOLD = (STRIP_OPTIONS[1].centerOffsetUp + STRIP_OPTIONS[2].centerOffsetUp) / 2  // ~146px
const MIN_SLIDE = 20 // px above FAB center before any option activates

function getOptionForDy(dy: number): StripOptionId | null {
  // dy is negative when finger is above FAB center
  const upward = -dy
  if (upward < MIN_SLIDE) return null
  if (upward < THOUGHT_THRESHOLD) return 'thought'
  if (upward < PROJECT_THRESHOLD) return 'project'
  return 'article'
}

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

  const [isStripOpen, setIsStripOpen] = useState(false)
  const [activeOption, setActiveOption] = useState<StripOptionId | null>(null)

  const { isOnline } = useOnlineStatus()

  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pressStartTimeRef = useRef<number>(0)
  const isLongPressRef = useRef<boolean>(false)

  // Refs so event handlers always read fresh values without closure staleness
  const isStripOpenRef = useRef(false)
  const activeOptionRef = useRef<StripOptionId | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

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

  const closeStrip = useCallback(() => {
    isStripOpenRef.current = false
    activeOptionRef.current = null
    setIsStripOpen(false)
    setActiveOption(null)
    isLongPressRef.current = false
  }, [])

  const executeOption = useCallback((option: StripOptionId | null) => {
    closeStrip()
    if (option === 'thought') setShowThoughtDialog(true)
    else if (option === 'project') setShowProjectDialog(true)
    else if (option === 'article') setShowArticleDialog(true)
    // null = released on FAB with no slide — do nothing (prevents accidental recording)
  }, [closeStrip])

  // --- Press handlers ---

  const onStart = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    isLongPressRef.current = false
    pressStartTimeRef.current = Date.now()
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      haptic.medium()
      isStripOpenRef.current = true
      setIsStripOpen(true)
    }, LONG_PRESS_DELAY)
  }, [])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!isStripOpenRef.current || !fabRef.current) return
    const rect = fabRef.current.getBoundingClientRect()
    const fabCenterY = rect.top + rect.height / 2
    const dy = e.clientY - fabCenterY
    const detected = getOptionForDy(dy)
    if (detected !== activeOptionRef.current) {
      if (detected !== null) haptic.light()
      activeOptionRef.current = detected
      setActiveOption(detected)
    }
  }, [])

  const onEnd = useCallback((_e: React.PointerEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    const duration = Date.now() - pressStartTimeRef.current

    if (isStripOpenRef.current) {
      haptic.light()
      executeOption(activeOptionRef.current)
      return
    }

    // Short tap → voice capture
    if (duration < LONG_PRESS_DELAY && !isLongPressRef.current) {
      if (onTap) {
        const handled = onTap()
        if (handled) return
      }
      haptic.light()
      setIsVoiceOpen(true)
    }

    isLongPressRef.current = false
  }, [onTap, executeOption])

  const onLeave = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (!isStripOpenRef.current) {
      isLongPressRef.current = false
    }
  }, [])

  const onSystemCancel = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    closeStrip()
  }, [closeStrip])

  // --- Pill positions (hardcoded, anchored to FAB's known location) ---
  // All pills share the same right edge as the FAB.
  // bottom values are distances from the screen bottom edge.
  const pillRight = FAB_RIGHT  // 24px — same right edge as FAB
  const pillBottoms = STRIP_OPTIONS.map((opt) =>
    FAB_BOTTOM + FAB_SIZE / 2 + opt.centerOffsetUp - PILL_H / 2
  )
  // pillBottoms[0] = 112 + 28 + 62 - 22 = 180  (Thought)
  // pillBottoms[1] = 112 + 28 + 118 - 22 = 236  (Project)
  // pillBottoms[2] = 112 + 28 + 174 - 22 = 292  (Article)

  // --- Render ---

  const stripOverlay = createPortal(
    <AnimatePresence>
      {isStripOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="strip-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[24990]"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            onPointerDown={closeStrip}
          />

          {/* Option pills — pointer-events:none; touch stays on FAB */}
          {STRIP_OPTIONS.map((opt, i) => {
            const isActive = activeOption === opt.id
            return (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, x: 16, scale: 0.88 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 16, scale: 0.88 }}
                transition={{ type: 'spring', damping: 22, stiffness: 420, delay: i * 0.04 }}
                className="fixed z-[25000] flex items-center gap-2.5 rounded-2xl select-none"
                style={{
                  right: pillRight,
                  bottom: pillBottoms[i],
                  height: PILL_H,
                  minWidth: 130,
                  padding: '0 16px',
                  background: isActive ? opt.activeColor : opt.color,
                  border: `1px solid ${opt.border}`,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: isActive
                    ? `0 0 20px ${opt.glow}, 0 4px 16px rgba(0,0,0,0.4)`
                    : '0 2px 12px rgba(0,0,0,0.3)',
                  transform: isActive ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease',
                  pointerEvents: 'none',
                }}
              >
                <opt.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-white/75')} />
                <span className={cn('text-sm font-bold tracking-tight', isActive ? 'text-white' : 'text-white/75')}>
                  {opt.label}
                </span>
              </motion.div>
            )
          })}

          {/* Hint label beneath the FAB */}
          <motion.p
            key="strip-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.15 }}
            className="fixed z-[24995] pointer-events-none text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/40"
            style={{ bottom: FAB_BOTTOM - 20, right: FAB_RIGHT - 8, width: FAB_SIZE + 16 }}
          >
            {activeOption
              ? STRIP_OPTIONS.find(o => o.id === activeOption)?.label
              : 'Slide up'}
          </motion.p>
        </>
      )}
    </AnimatePresence>,
    document.body
  )

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
        backgroundColor: isStripOpen
          ? (activeOption ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)')
          : 'rgba(255, 255, 255, 0.05)',
        borderColor: isStripOpen && !activeOption
          ? 'rgba(255, 255, 255, 0.2)'
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
        boxShadow: isStripOpen
          ? '0 8px 32px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)'
          : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.02)',
      }}
      aria-label="Create — tap to record, hold to choose type"
    >
      {isStripOpen ? (
        <motion.div
          animate={{ rotate: activeOption ? 45 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <Plus className={cn('h-6 w-6', activeOption ? 'text-white' : 'text-zinc-400')} />
        </motion.div>
      ) : (
        <Plus className="h-6 w-6 text-zinc-300 transition-transform group-hover:rotate-90 group-hover:text-white" />
      )}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.button>,
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

      {/* Voice modal — opened by short tap */}
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

      <CreateProjectDialog isOpen={showProjectDialog} onOpenChange={setShowProjectDialog} hideTrigger />
      <CreateMemoryDialog isOpen={showThoughtDialog} onOpenChange={setShowThoughtDialog} hideTrigger />
      <SaveArticleDialog open={showArticleDialog} onClose={() => setShowArticleDialog(false)} hideTrigger />
      <AddItemToListDialog isOpen={showListDialog} onOpenChange={setShowListDialog} />
    </>
  )
}
