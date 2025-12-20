import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, X, Wind, Zap, Square, Loader2 } from 'lucide-react'
import { haptic } from '../../utils/haptics'
import { celebrate } from '../../utils/celebrations'
import { useMediaRecorderVoice } from '../../hooks/useMediaRecorderVoice'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'

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
  const [capturedInsightsCount, setCapturedInsightsCount] = useState(0)
  const [showFlash, setShowFlash] = useState(false)

  const { createMemory } = useMemoryStore()
  const { addToast } = useToast()

  // Motion tracking refs
  const lastAccel = useRef<{ x: number, y: number, z: number } | null>(null)
  const stillnessStart = useRef<number>(Date.now())
  const hasDrifted = useRef(false)
  const stageRef = useRef<'settling' | 'drifting' | 'awakened' | 'ending'>('settling')
  const [isJolt, setIsJolt] = useState(false)

  // Sync ref with state
  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  // Permission Request Logic
  // REMOVED: Auto-request on mount (fails on iOS)
  // MOVED: To "Begin Session" button click
  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [])

  const requestMotionPermission = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission()
        if (response === 'granted') {
          setMotionPermission('granted')
          window.addEventListener('devicemotion', handleMotion)
          haptic.success()
        } else {
          setMotionPermission('denied')
        }
      } catch (e) {
        console.error(e)
        // If not https, it might fail
      }
    } else {
      setMotionPermission('granted')
      window.addEventListener('devicemotion', handleMotion)
      haptic.success()
    }
  }

  const handleMotion = (event: DeviceMotionEvent) => {
    const accel = event.accelerationIncludingGravity
    if (!accel) return

    const x = accel.x || 0
    const y = accel.y || 0
    const z = accel.z || 0

    if (!lastAccel.current) {
      lastAccel.current = { x, y, z }
      return
    }

    const delta = Math.abs(x - lastAccel.current.x) + Math.abs(y - lastAccel.current.y) + Math.abs(z - lastAccel.current.z)

    const STILL_THRESHOLD = 0.5
    const WAKE_THRESHOLD = 15.0 // High bar: similar to dropping or catching a falling phone
    const JOLT_THRESHOLD = 20.0 // Extremely sharp jolt
    const REQUIRED_DURATION = 5000

    // Debug log (throttled)
    if (Math.random() < 0.05) {
      console.log(`[Drift] Delta: ${delta.toFixed(2)}, State: ${stageRef.current}, Drifted: ${hasDrifted.current}`)
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
        setIsJolt(true)
        haptic.heavy()
      } else {
        setIsJolt(false)
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

  const triggerInsight = () => {
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 500)
    celebrate.success()
    setStage('awakened')
    // Pick a random prompt or next
    setCurrentPromptIndex(prev => (prev + 1) % prompts.length)
  }

  const resetDrift = () => {
    setStage('settling')
    hasDrifted.current = false
    stillnessStart.current = Date.now()
    setIsJolt(false)
  }

  const handleTranscript = async (text: string) => {
    if (!text.trim()) return

    try {
      await createMemory({
        body: text,
        title: 'Drift Insight',
        memory_type: 'insight'
      })

      setCapturedInsightsCount(prev => prev + 1)
      addToast({
        title: 'Insight Captured',
        description: 'Saved to your thoughts',
        variant: 'success'
      })

      haptic.success()

      // After success, we could either drift again or show small celebration
      // Let's stay in awakened so they can choose to drift again or end
    } catch (error) {
      console.error('Failed to save drift insight:', error)
      addToast({
        title: 'Failed to save',
        variant: 'destructive'
      })
    }
  }

  const {
    isRecording,
    isProcessing,
    toggleRecording
  } = useMediaRecorderVoice({
    onTranscript: handleTranscript,
    maxDuration: 60, // Allow 1 minute for insights
    autoSubmit: true
  })

  const currentPrompt = prompts[currentPromptIndex]

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1829] text-white flex flex-col items-center justify-center overflow-hidden">
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
        className="absolute top-6 right-6 p-4 rounded-full bg-white/5 text-slate-400 hover:bg-white/10"
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
                  stroke="#8b5cf6" // violet-500
                  strokeWidth="4"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * progress) / 100}
                  transition={{ duration: 0.1 }}
                />
              </svg>
              <Wind className="h-10 w-10 text-slate-400" />
            </div>

            <h2 className="text-2xl font-serif font-medium mb-4 text-[#E2E8F0]">
              {mode === 'sleep' ? 'The Steel Ball' : 'The Reset Sphere'}
            </h2>            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              {mode === 'sleep'
                ? "Hold your phone loosely in your hand. Close your eyes.\n\nWhen you drift into the edge of sleep and your hand slips...\nWe will catch the insight."
                : "Hold your phone loosely. Close your eyes.\n\nLet your mind wander away from the problem.\nWhen your focus breaks and your hand slips..."}
            </p>

            <button
              onClick={requestMotionPermission}
              className="px-8 py-3 rounded-full bg-white/10 text-[#E2E8F0] font-medium hover:bg-white/20 transition-all border border-white/5"
            >
              Begin Session
            </button>

            {motionPermission === 'denied' && (
              <p className="mt-4 text-red-400 text-sm">Motion permission required for this feature.</p>
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
          >
            <div className="w-3 h-3 rounded-full bg-violet-500/50 animate-ping" />
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
              {isJolt && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 text-sm font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                >
                  <Zap className="h-4 w-4 fill-current" />
                  Jolt Detected
                </motion.div>
              )}
              <span className="inline-block px-3 py-1 rounded-full border border-white/10 text-xs font-medium tracking-widest uppercase text-slate-400 mb-4">
                {mode === 'sleep' ? 'Hypnagogic Insight' : 'Logic Breaker'}
              </span>
              <h1 className="text-3xl md:text-4xl font-serif text-[#E2E8F0] leading-tight">
                {currentPrompt.prompt}
              </h1>
              {currentPrompt.metaphor && (
                <p className="mt-6 text-xl italic text-slate-500 font-serif">
                  "{currentPrompt.metaphor}"
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 mt-12">
              <button
                onClick={resetDrift}
                className="px-8 py-4 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 transition-all flex items-center gap-2 border border-white/5"
              >
                <Wind className="h-5 w-5" />
                {mode === 'sleep' ? 'Drift Again' : 'Reset Again'}
              </button>

              <button
                onClick={() => setStage('ending')}
                className="px-6 py-4 rounded-full bg-white/5 text-slate-400 hover:bg-white/10 transition-all border border-white/5"
              >
                End Session
              </button>

              {/* Voice Capture */}
              <button
                onClick={toggleRecording}
                disabled={isProcessing}
                className={`p-4 rounded-full transition-all ${isRecording
                  ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
                  }`}
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-5 w-5 fill-current" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
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
              <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full" />
              <div className="relative p-6 rounded-2xl bg-white/5 border border-white/10">
                <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-3xl font-serif text-[#E2E8F0] mb-2">Session Complete</h2>
                <p className="text-slate-400">Your subconscious has been primed.</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-slate-400">Insights Captured</span>
                <span className="text-2xl font-bold text-violet-400">{capturedInsightsCount}</span>
              </div>

              <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 text-left">
                <p className="text-xs uppercase tracking-widest text-violet-400 font-bold mb-2">Closing Reflection</p>
                <p className="text-sm italic text-slate-300 leading-relaxed">
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
