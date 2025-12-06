import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, X, Wind, Zap } from 'lucide-react'
import { haptic } from '../../utils/haptics'

interface DriftModeProps {
  prompts: any[]
  onClose: () => void
  mode?: 'sleep' | 'break'
}

export function DriftMode({ prompts, onClose, mode = 'sleep' }: DriftModeProps) {
  const [stage, setStage] = useState<'settling' | 'drifting' | 'awakened'>('settling')
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [motionPermission, setMotionPermission] = useState<PermissionState>('prompt')
  
  // ...

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
            <h2 className="text-2xl font-serif font-medium mb-4 text-amber-700">
              {mode === 'sleep' ? 'The Steel Ball' : 'The Reset Sphere'}
            </h2>
            <p className="text-lg text-amber-900/60 leading-relaxed">
              {mode === 'sleep' 
                ? "Hold your phone loosely in your hand. Close your eyes.\n\nWhen you drift into the edge of sleep and your hand slips...\nWe will catch the insight."
                : "Hold your phone loosely. Close your eyes.\n\nLet your mind wander away from the problem.\nWhen your focus breaks and your hand slips..."}
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
                {mode === 'sleep' ? 'Hypnagogic Insight' : 'Logic Breaker'}
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
                {mode === 'sleep' ? 'Drift Again' : 'Reset Again'}
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
