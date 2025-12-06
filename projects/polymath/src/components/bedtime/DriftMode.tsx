import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, X, Wind, Zap } from 'lucide-react'
import { haptic } from '../../utils/haptics'

interface DriftModeProps {
  prompts: any[]
  onClose: () => void
}

export function DriftMode({ prompts, onClose }: DriftModeProps) {
  const [stage, setStage] = useState<'settling' | 'drifting' | 'awakened'>('settling')
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [motionPermission, setMotionPermission] = useState<PermissionState>('prompt')
  
  // Motion tracking
  const lastAccel = useRef<{ x: number, y: number, z: number } | null>(null)
  const stillnessStart = useRef<number>(Date.now())
  const hasDrifted = useRef(false)

  useEffect(() => {
    // Request permission on mount if needed (iOS 13+)
    requestMotionPermission()
    
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
        } else {
          setMotionPermission('denied')
        }
      } catch (e) {
        console.error(e)
      }
    } else {
      setMotionPermission('granted')
      window.addEventListener('devicemotion', handleMotion)
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
    
    // Thresholds
    const STILL_THRESHOLD = 0.5
    const WAKE_THRESHOLD = 2.0 // "The Hypnic Jerk" or "Steel Ball Drop"

    if (delta < STILL_THRESHOLD) {
      // User is still
      if (!hasDrifted.current && Date.now() - stillnessStart.current > 5000) { // 5 seconds of stillness
        setStage('drifting')
        hasDrifted.current = true
        haptic.light() // Gentle confirmation
      }
    } else if (delta > WAKE_THRESHOLD && hasDrifted.current && stage === 'drifting') {
      // Sudden movement after drifting -> Trigger Insight
      triggerInsight()
    }

    lastAccel.current = { x, y, z }
    
    // Reset stillness timer if moving too much before drift
    if (delta > STILL_THRESHOLD && !hasDrifted.current) {
      stillnessStart.current = Date.now()
    }
  }

  const triggerInsight = () => {
    haptic.medium()
    setStage('awakened')
    // Pick a random prompt or next
    setCurrentPromptIndex(prev => (prev + 1) % prompts.length)
  }

  const resetDrift = () => {
    setStage('settling')
    hasDrifted.current = false
    stillnessStart.current = Date.now()
  }

  const currentPrompt = prompts[currentPromptIndex]

  return (
    <div className="fixed inset-0 z-50 bg-black text-amber-900 flex flex-col items-center justify-center overflow-hidden">
      {/* Exit Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-4 rounded-full bg-white/5 text-amber-900/50 hover:bg-white/10"
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
            <Wind className="h-12 w-12 mx-auto mb-6 text-amber-900/40 animate-pulse" />
            <h2 className="text-2xl font-serif font-medium mb-4 text-amber-700">The Steel Ball</h2>
            <p className="text-lg text-amber-900/60 leading-relaxed">
              Hold your phone loosely in your hand. Close your eyes.
              <br/><br/>
              When you drift into the edge of sleep and your hand slips...
              <br/>
              <span className="text-amber-600">We will catch the insight.</span>
            </p>
            {motionPermission === 'denied' && (
              <p className="mt-4 text-red-900/50 text-sm">Motion permission required for this feature.</p>
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
            <div className="w-2 h-2 rounded-full bg-amber-900/20 animate-ping" />
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
              <span className="inline-block px-3 py-1 rounded-full border border-amber-900/20 text-xs font-medium tracking-widest uppercase text-amber-900/40 mb-4">
                Hypnagogic Insight
              </span>
              <h1 className="text-3xl md:text-4xl font-serif text-amber-600 leading-tight">
                {currentPrompt.prompt}
              </h1>
              {currentPrompt.metaphor && (
                <p className="mt-6 text-xl italic text-amber-800/60 font-serif">
                  "{currentPrompt.metaphor}"
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 mt-12">
              <button 
                onClick={resetDrift}
                className="px-8 py-4 rounded-full bg-amber-900/10 text-amber-800 hover:bg-amber-900/20 transition-all flex items-center gap-2"
              >
                <Wind className="h-5 w-5" />
                Drift Again
              </button>
              {/* Future: Voice Capture */}
              <button className="p-4 rounded-full bg-amber-900/10 text-amber-800 opacity-50 cursor-not-allowed">
                <Mic className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
