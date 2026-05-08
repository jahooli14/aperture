import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wind, Zap } from 'lucide-react'
import { haptic } from '../../utils/haptics'
import { celebrate } from '../../utils/celebrations'
import { useDriftStore } from '../../stores/useDriftStore'

interface DriftModeProps {
  prompts: any[]
  onClose: () => void
  mode?: 'sleep' | 'break'
}

export function DriftMode({ prompts, onClose, mode = 'sleep' }: DriftModeProps) {
  const [stage, setStage] = useState<'settling' | 'drifting' | 'awakened' | 'ending'>('settling')
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [motionPermission, setMotionPermission] = useState<PermissionState>('prompt')
  const [progress, setProgress] = useState(0) // Stability progress (0-100)
  const [showFlash, setShowFlash] = useState(false)


  // Motion tracking refs
  const lastAccel = useRef<{ x: number, y: number, z: number } | null>(null)
  const stillnessStart = useRef<number>(Date.now())
  const hasDrifted = useRef(false)
  const stageRef = useRef<'settling' | 'drifting' | 'awakened' | 'ending'>('settling')
  const motionListenerActive = useRef(false)

  // Sync ref with state immediately
  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  const triggerInsight = useCallback(() => {
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 500)
    celebrate.success()
    setStage('awakened')
    // Pick a random prompt or next
    setCurrentPromptIndex(prev => (prev + 1) % prompts.length)
  }, [prompts.length])

  // Use a ref to always have the latest handleMotion logic
  const handleMotionRef = useRef<(event: DeviceMotionEvent) => void>(() => {})

  // Track if we've received any motion events
  const motionEventsReceived = useRef(false)
  const driftFallbackTimer = useRef<NodeJS.Timeout | null>(null)

  // Update the ref whenever dependencies change
  useEffect(() => {
    handleMotionRef.current = (event: DeviceMotionEvent) => {
      // Try accelerationIncludingGravity first, fall back to acceleration
      const accel = event.accelerationIncludingGravity || event.acceleration
      if (!accel || (accel.x === null && accel.y === null && accel.z === null)) {
        // Motion sensor not providing data - log once
        if (!motionEventsReceived.current) {
          console.warn('[Drift] Motion sensor not providing acceleration data')
        }
        return
      }

      // Mark that we're receiving motion events
      if (!motionEventsReceived.current) {
        motionEventsReceived.current = true
        console.log('[Drift] Motion events are being received')
        // Clear fallback timer since motion is working
        if (driftFallbackTimer.current) {
          clearTimeout(driftFallbackTimer.current)
          driftFallbackTimer.current = null
        }
      }

      const x = accel.x || 0
      const y = accel.y || 0
      const z = accel.z || 0

      if (!lastAccel.current) {
        lastAccel.current = { x, y, z }
        return
      }

      const delta = Math.abs(x - lastAccel.current.x) + Math.abs(y - lastAccel.current.y) + Math.abs(z - lastAccel.current.z)

      // More lenient thresholds for better detection
      const STILL_THRESHOLD = 1.0  // Increased from 0.5 - phones have natural micro-vibrations
      const WAKE_THRESHOLD = 8.0   // Lowered from 12.0 for easier wake detection
      const JOLT_THRESHOLD = 15.0  // Lowered from 18.0
      const REQUIRED_DURATION = 4000 // Reduced from 5000 for faster entry

      // Debug log (more frequent for testing)
      if (Math.random() < 0.1) {
        console.log(`[Drift] Delta: ${delta.toFixed(2)}, State: ${stageRef.current}, Drifted: ${hasDrifted.current}, Progress: ${progress.toFixed(0)}%`)
      }

      if (delta < STILL_THRESHOLD) {
        // User is still
        const duration = Date.now() - stillnessStart.current
        const newProgress = Math.min(100, (duration / REQUIRED_DURATION) * 100)
        setProgress(newProgress)

        if (!hasDrifted.current && duration > REQUIRED_DURATION) {
          setStage('drifting')
          hasDrifted.current = true
          haptic.light()
          console.log('[Drift] Entering drift state (stillness detected)')
        }
      } else if (delta > WAKE_THRESHOLD && hasDrifted.current && stageRef.current === 'drifting') {
        // Sudden movement after drifting -> Trigger Insight
        console.log('[Drift] WAKE EVENT DETECTED! Delta:', delta)

        if (delta > JOLT_THRESHOLD) {
          haptic.heavy()
        } else {
          haptic.medium()
        }

        triggerInsight()
      }

      lastAccel.current = { x, y, z }

      // Reset stillness timer if moving too much before drift
      if (delta > STILL_THRESHOLD && !hasDrifted.current) {
        stillnessStart.current = Date.now()
        setProgress(0)
      }
    }
  }, [triggerInsight, progress])

  // Stable event handler that delegates to ref
  const stableMotionHandler = useCallback((event: DeviceMotionEvent) => {
    handleMotionRef.current(event)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (motionListenerActive.current) {
        window.removeEventListener('devicemotion', stableMotionHandler)
        motionListenerActive.current = false
      }
      if (driftFallbackTimer.current) {
        clearTimeout(driftFallbackTimer.current)
        driftFallbackTimer.current = null
      }
    }
  }, [stableMotionHandler])

  const requestMotionPermission = async () => {
    // Reset state for new session
    stillnessStart.current = Date.now()
    lastAccel.current = null
    motionEventsReceived.current = false
    hasDrifted.current = false

    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission()
        if (response === 'granted') {
          setMotionPermission('granted')
          window.addEventListener('devicemotion', stableMotionHandler)
          motionListenerActive.current = true
          haptic.success()
          startFallbackTimer()
        } else {
          setMotionPermission('denied')
        }
      } catch (e) {
        console.error('[Drift] Motion permission error:', e)
        // If not https or other error, try adding listener anyway (for Android/desktop)
        setMotionPermission('granted')
        window.addEventListener('devicemotion', stableMotionHandler)
        motionListenerActive.current = true
        startFallbackTimer()
      }
    } else {
      // Non-iOS devices don't need permission
      setMotionPermission('granted')
      window.addEventListener('devicemotion', stableMotionHandler)
      motionListenerActive.current = true
      haptic.success()
      startFallbackTimer()
    }
  }

  // Fallback: if no motion events received after 3 seconds, auto-enter drift mode
  const startFallbackTimer = () => {
    console.log('[Drift] Starting fallback timer (3s)')
    driftFallbackTimer.current = setTimeout(() => {
      if (!motionEventsReceived.current && !hasDrifted.current) {
        console.log('[Drift] No motion events detected - using fallback mode')
        // Enter drift mode anyway, and use a simple touch-based wake
        setStage('drifting')
        hasDrifted.current = true
        haptic.light()
      }
    }, 3000)
  }

  const resetDrift = () => {
    setStage('settling')
    hasDrifted.current = false
    stillnessStart.current = Date.now()
  }

  // Voice capture happens through the global FAB. When the awakened
  // stage is showing, we publish the active drift question to a small
  // store that FloatingNav reads on transcript — the captured thought
  // is then wrapped with the drift context before being saved.
  const setActiveDrift = useDriftStore((s) => s.setActive)
  const clearActiveDrift = useDriftStore((s) => s.clear)

  const currentPrompt = prompts[currentPromptIndex]

  useEffect(() => {
    if (stage === 'awakened' && currentPrompt) {
      setActiveDrift({
        prompt: currentPrompt.prompt,
        metaphor: currentPrompt.metaphor ?? null,
        context: currentPrompt.context ?? null,
        mode,
      })
    } else {
      clearActiveDrift()
    }
    return () => { clearActiveDrift() }
  }, [stage, currentPrompt, mode, setActiveDrift, clearActiveDrift])

  // One seed thought to hold during the drift. The prompt itself stays
  // hidden until wake — that's the related question they answer afterwards.
  const driftSeed = currentPrompt?.context?.trim() || currentPrompt?.metaphor?.trim() || null

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1829] text-[var(--brand-text-primary)] flex flex-col items-center justify-center overflow-hidden">
      {/* Wake-up Flash Overlay */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Exit Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 h-12 w-12 flex items-center justify-center rounded-full bg-[var(--glass-surface)] text-[var(--brand-text-primary)] hover:bg-[rgba(255,255,255,0.15)] border border-white/10"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <X className="h-6 w-6" />
      </button>

      <AnimatePresence mode="wait">
        {/* Stage 1: Settling / Instructions */}
        {stage === 'settling' && (
          <motion.div
            key="settling"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center px-8 max-w-md"
          >
            <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              {/* Stability Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="rgb(var(--brand-primary-rgb))" // violet-500
                  strokeWidth="4"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * progress) / 100}
                  transition={{ duration: 0.1 }}
                />
              </svg>
              <Wind className="h-10 w-10 text-[var(--brand-text-secondary)]" />
            </div>

            <h2 className="text-2xl font-serif font-medium mb-4 text-[var(--brand-text-secondary)]">
              {mode === 'sleep' ? 'The Steel Ball' : 'The Reset Sphere'}
            </h2>

            {/* Context prompt — seed the subconscious before drifting */}
            {currentPrompt && (
              <div className="mb-6 p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/10">
                <p className="text-xs uppercase tracking-widest text-brand-primary font-bold mb-2">
                  {mode === 'sleep' ? 'Tonight\'s Seed' : 'Your Reset Context'}
                </p>
                <p className="text-base font-serif italic text-[var(--brand-text-secondary)] leading-relaxed">
                  {currentPrompt.context || currentPrompt.metaphor || currentPrompt.prompt}
                </p>
              </div>
            )}

            <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed mb-8">
              {mode === 'sleep'
                ? "Hold your phone loosely. Close your eyes. Let the thought sit with you as you drift..."
                : "Hold your phone loosely. Close your eyes. Let your mind wander away from the problem..."}
            </p>

            <button
              onClick={requestMotionPermission}
              className="px-8 py-3 rounded-full bg-[rgba(255,255,255,0.1)] text-[var(--brand-text-secondary)] font-medium hover:bg-white/20 transition-all border border-[var(--glass-surface)]"
            >
              Begin Session
            </button>

            {motionPermission === 'denied' && (
              <p className="mt-4 text-brand-text-secondary text-sm">Motion permission required for this feature.</p>
            )}
          </motion.div>
        )}

        {/* Stage 2: Drifting (Darkness) */}
        {stage === 'drifting' && (
          <motion.div
            key="drifting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
            className="absolute inset-0 bg-black flex items-center justify-center"
            // Touch-based wake for fallback mode (when motion isn't working)
            onClick={() => {
              if (!motionEventsReceived.current) {
                console.log('[Drift] Touch-based wake triggered (fallback mode)')
                haptic.medium()
                triggerInsight()
              }
            }}
          >
            {driftSeed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
                className="text-center px-8 max-w-md relative z-10"
              >
                <p className="text-xs uppercase tracking-widest text-brand-primary/70 font-bold mb-3">
                  {mode === 'sleep' ? 'Hold this thought' : 'Sit with this'}
                </p>
                <p className="text-lg font-serif italic text-white/85 leading-relaxed">
                  {driftSeed}
                </p>
              </motion.div>
            )}
            <div className="absolute w-3 h-3 rounded-full bg-brand-primary/50 animate-ping" />
            {/* Show hint if no motion detected after entering drift */}
            {!motionEventsReceived.current && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.75 }}
                exit={{ opacity: 0, transition: { duration: 4 } }}
                transition={{ delay: 5, duration: 2 }}
                className="absolute bottom-20 text-white/75 text-base text-center px-8 leading-relaxed"
              >
                Tap anywhere when you're ready to capture your insight
              </motion.p>
            )}
          </motion.div>
        )}

        {/* Stage 3: Awakened (The Prompt) */}
        {stage === 'awakened' && currentPrompt && (
          <motion.div
            key="awakened"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center px-8 max-w-lg relative"
          >
            <div className="mb-8">
              <p className="text-xs uppercase tracking-widest text-brand-primary/70 font-bold mb-4">
                Now answer this
              </p>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[var(--brand-text-secondary)] leading-tight">
                {currentPrompt.prompt}
              </h1>
            </div>

            {/* Capture happens via the global FAB; the floating-nav handler */}
            {/* reads useDriftStore and wraps the transcript with this drift's */}
            {/* prompt before saving, so the thought lands as a coherent reply. */}
            <div className="flex items-center justify-center gap-4 mt-12">
              <button
                onClick={resetDrift}
                className="px-8 py-4 rounded-full bg-[var(--glass-surface)] text-[var(--brand-text-secondary)] hover:bg-[rgba(255,255,255,0.1)] transition-all flex items-center gap-2 border border-[var(--glass-surface)]"
              >
                <Wind className="h-5 w-5" />
                {mode === 'sleep' ? 'Drift Again' : 'Reset Again'}
              </button>

              <button
                onClick={() => setStage('ending')}
                className="px-6 py-4 rounded-full bg-[var(--glass-surface)] text-[var(--brand-text-secondary)] hover:bg-[rgba(255,255,255,0.1)] transition-all border border-[var(--glass-surface)]"
              >
                End Session
              </button>
            </div>
          </motion.div>
        )}

        {/* Stage 4: Ending (Summary) */}
        {stage === 'ending' && (
          <motion.div
            key="ending"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center px-8 max-w-md"
          >
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-brand-primary/20 blur-3xl rounded-full" />
              <div className="relative p-4 sm:p-6 rounded-2xl bg-[var(--glass-surface)] border border-white/10">
                <Zap className="h-12 w-12 text-brand-text-secondary mx-auto mb-4" />
                <h2 className="text-3xl font-serif text-[var(--brand-text-secondary)] mb-2">Session Complete</h2>
                <p className="text-[var(--brand-text-secondary)]">Your subconscious has been primed.</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {currentPrompt && (currentPrompt.context || currentPrompt.metaphor) && (
                <div className="p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/10 text-left">
                  <p className="text-xs uppercase tracking-widest text-brand-primary font-bold mb-2">
                    {mode === 'sleep' ? 'Tonight\'s Seed' : 'Your Seed'}
                  </p>
                  <p className="text-sm italic text-[var(--brand-text-secondary)] leading-relaxed">
                    "{currentPrompt.context || currentPrompt.metaphor}"
                  </p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/10 text-left">
                <p className="text-xs uppercase tracking-widest text-brand-primary font-bold mb-2">Closing Reflection</p>
                <p className="text-sm italic text-[var(--brand-text-secondary)] leading-relaxed">
                  "The most profound connections often emerge when we stop looking for them. Sleep well, let these seeds grow."
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 rounded-full bg-white text-black font-bold hover:bg-slate-200 transition-all shadow-xl shadow-white/5"
            >
              Return Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
