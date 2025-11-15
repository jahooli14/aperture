/**
 * Voice Command Button
 * Floating action button for voice-based navigation
 */

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, X, Sparkles } from 'lucide-react'
import { useVoiceCommands } from '../hooks/useVoiceCommands'
import { haptic } from '../utils/haptics'

export function VoiceCommandButton() {
  const [showModal, setShowModal] = useState(false)
  const location = useLocation()
  const {
    isListening,
    transcript,
    error,
    lastCommand,
    startListening,
    stopListening,
    clearError,
    commands
  } = useVoiceCommands()

  // Hide on ProjectDetailPage since it has its own FAB
  if (location.pathname.startsWith('/projects/') && location.pathname !== '/projects') {
    return null
  }

  const handleOpen = () => {
    haptic.light()
    setShowModal(true)
  }

  const handleClose = () => {
    haptic.light()
    if (isListening) {
      stopListening()
    }
    setShowModal(false)
    clearError()
  }

  const handleToggleListening = () => {
    haptic.medium()
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleOpen}
        className="fixed bottom-24 right-6 z-40 h-14 w-14 rounded-full flex items-center justify-center shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
          color: 'white'
        }}
        title="Voice commands"
      >
        <Mic className="h-6 w-6" />
      </motion.button>

      {/* Voice Command Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="premium-card p-6 w-full max-w-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                      color: 'white'
                    }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl font-bold premium-text-platinum">
                    Voice Commands
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--premium-text-tertiary)' }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Listening Interface */}
              <div className="mb-6">
                <div
                  className="relative rounded-2xl p-8 flex flex-col items-center justify-center min-h-[200px]"
                  style={{
                    background: isListening
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1))'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: `2px solid ${isListening ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.1)'}`
                  }}
                >
                  {/* Microphone Button */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleToggleListening}
                    className="relative h-20 w-20 rounded-full flex items-center justify-center mb-4 shadow-xl"
                    style={{
                      background: isListening
                        ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                        : 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                      color: 'white'
                    }}
                  >
                    {isListening ? (
                      <MicOff className="h-8 w-8" />
                    ) : (
                      <Mic className="h-8 w-8" />
                    )}

                    {/* Pulse animation when listening */}
                    {isListening && (
                      <>
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: 'rgba(239, 68, 68, 0.4)',
                            zIndex: -1
                          }}
                          animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.5, 0, 0.5]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut'
                          }}
                        />
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: 'rgba(239, 68, 68, 0.3)',
                            zIndex: -2
                          }}
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.3, 0, 0.3]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: 0.5
                          }}
                        />
                      </>
                    )}
                  </motion.button>

                  {/* Status Text */}
                  <div className="text-center">
                    {isListening ? (
                      <>
                        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--premium-blue)' }}>
                          Listening...
                        </p>
                        <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                          Say a command or tap to stop
                        </p>
                      </>
                    ) : transcript ? (
                      <>
                        <p className="text-lg font-semibold mb-2 premium-text-platinum">
                          "{transcript}"
                        </p>
                        <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                          Command recognized
                        </p>
                      </>
                    ) : lastCommand ? (
                      <>
                        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--premium-emerald)' }}>
                          ✓ Executed: "{lastCommand}"
                        </p>
                        <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                          Tap the mic to say another command
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold mb-2 premium-text-platinum">
                          Tap to speak
                        </p>
                        <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                          Try saying "go to projects" or "create memory"
                        </p>
                      </>
                    )}
                  </div>

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 px-4 py-3 rounded-lg"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <p className="text-sm" style={{ color: '#ef4444' }}>
                        {error}
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Command Examples */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--premium-text-tertiary)' }}>
                  Example Commands
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                  {commands.slice(0, 12).map((command, index) => (
                    <div
                      key={index}
                      className="premium-glass-subtle p-3 rounded-lg"
                    >
                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                        {command.description}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                        "{command.examples[0]}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
