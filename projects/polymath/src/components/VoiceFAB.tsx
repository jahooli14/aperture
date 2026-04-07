/**
 * Universal Action FAB
 *
 * TAP    Voice capture modal (auto-starts recording)
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
import { TodoInput } from './todos/TodoInput'
import { useTodoStore } from '../stores/useTodoStore'
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
  maxDuration = 60,
  hidden = false,
  onTap,
}: VoiceFABProps) {
  const [isVoiceOpen, setIsVoiceOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showTodoQuickAdd, setShowTodoQuickAdd] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showThoughtDialog, setShowThoughtDialog] = useState(false)
  const [showListDialog, setShowListDialog] = useState(false)
  const [showArticleDialog, setShowArticleDialog] = useState(false)
  const { addTodo, areas } = useTodoStore()

  const [shouldStopRecording, setShouldStopRecording] = useState(false)
  const [isLongPressRecording, setIsLongPressRecording] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const { isOnline } = useOnlineStatus()
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pressStartTimeRef = useRef<number>(0)

  useEffect(() => {
    const handleOpenVoiceCapture = () => {
      if (!hidden) {
        setIsVoiceOpen(true)
        setIsMenuOpen(false)
      }
    }
    const handleTooShort = () => setIsVoiceOpen(false)
    window.addEventListener('openVoiceCapture', handleOpenVoiceCapture)
    window.addEventListener('voice-capture-too-short', handleTooShort)
    return () => {
      window.removeEventListener('openVoiceCapture', handleOpenVoiceCapture)
      window.removeEventListener('voice-capture-too-short', handleTooShort)
    }
  }, [hidden])

  const handleTranscript = (text: string) => {
    onTranscript(text)
    setIsVoiceOpen(false)
  }

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
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    
    pressTimerRef.current = setTimeout(() => {
      setIsLongPressRecording(true)
      setShouldStopRecording(false)
      haptic.medium()
      setIsVoiceOpen(true)
    }, LONG_PRESS_DELAY)
  }, [])

  const onMove = useCallback((e: React.PointerEvent) => {
    // We can add swipe-to-cancel logic here if needed, but for now just stop the press timer if they move too far
    if (pressTimerRef.current) {
      if (Math.abs(e.movementX) > 10 || Math.abs(e.movementY) > 10) {
        // Optional: cancel long press if they swipe away
      }
    }
  }, [])

  const onEnd = useCallback((_e: React.PointerEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    const duration = Date.now() - pressStartTimeRef.current

    if (isLongPressRecording) {
      haptic.light()
      setShouldStopRecording(true)
      // We don't close voice open here, it will close when transcript is ready
      return
    }

    // Short tap - open menu
    if (duration < LONG_PRESS_DELAY) {
      haptic.light()
      setIsMenuOpen(true)
    }
  }, [isLongPressRecording])

  const onLeave = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
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
    setIsLongPressRecording(false)
    setIsVoiceOpen(false)
  }, [])

  // --- Pill positions (measured from actual FAB rect, so they work with any safe-area-inset) ---
  const stripOverlay = null; // Removed strip menu

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
        backgroundColor: 'var(--brand-primary)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 10px var(--glass-surface)',
      }}
      aria-label="Create  tap to record, hold to choose type"
    >
      <Plus className="h-6 w-6 text-white transition-transform group-hover:rotate-90" />
      <div className="absolute inset-0 bg-[var(--glass-surface)] opacity-0 group-hover:opacity-100 transition-opacity" />
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
                  <div className="flex items-center justify-between px-8 py-8">
                    <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] flex items-center gap-2">
                        <Mic className="h-6 w-6 text-brand-primary" />
                        Voice Capture
                      </h3>
                      <p className="text-sm text-brand-text-muted mt-1 font-medium">
                        {isOnline ? 'Transcribing in real-time' : 'Offline mode  will sync later'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsVoiceOpen(false)}
                      className="h-12 w-12 rounded-full bg-[var(--glass-surface)] hover:bg-[rgba(255,255,255,0.1)] flex items-center justify-center transition-all border border-[var(--glass-surface)]"
                    >
                      <X className="h-6 w-6 text-brand-text-muted" />
                    </button>
                  </div>
                  <div className="px-8 pb-10">
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
      <CreateMemoryDialog isOpen={showThoughtDialog} onOpenChange={setShowThoughtDialog} hideTrigger />
      <AddItemToListDialog isOpen={showListDialog} onOpenChange={setShowListDialog} />
      <SaveArticleDialog isOpen={showArticleDialog} onOpenChange={setShowArticleDialog} />

      {/* Todo quick-add modal */}
      {createPortal(
        <AnimatePresence>
          {showTodoQuickAdd && (
            <div className="fixed inset-0 z-[21000] flex items-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowTodoQuickAdd(false)}
              />
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                className="relative w-full z-10 px-4 pb-8 pt-4"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 2rem)' }}
              >
                <div className="max-w-2xl mx-auto">
                  <p className="text-xs font-medium text-[var(--brand-text-primary)]/30 uppercase tracking-widest mb-2 px-1">Quick task</p>
                  <TodoInput
                    autoFocus
                    onAdd={(parsed) => {
                      const area = parsed.areaName
                        ? areas.find(a => a.name.toLowerCase() === parsed.areaName!.toLowerCase())
                        : undefined
                      addTodo({
                        text: parsed.text,
                        priority: parsed.priority,
                        tags: [...parsed.tags, ...(parsed.isSomeday ? ['someday'] : [])],
                        scheduled_date: parsed.scheduledDate,
                        scheduled_time: parsed.scheduledTime,
                        deadline_date: parsed.deadlineDate,
                        estimated_minutes: parsed.estimatedMinutes,
                        area_id: area?.id,
                      })
                      haptic.light()
                      setShowTodoQuickAdd(false)
                    }}
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
