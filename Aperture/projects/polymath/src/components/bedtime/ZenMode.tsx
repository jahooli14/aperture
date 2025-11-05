/**
 * Zen Mode for Bedtime Prompts
 * Progressive reveal with calming presentation
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Star } from 'lucide-react'

interface BedtimePrompt {
  id: string
  prompt: string
  type: 'connection' | 'divergent' | 'revisit' | 'transform'
  metaphor?: string
  viewed: boolean
}

interface ZenModeProps {
  prompts: BedtimePrompt[]
  onClose: () => void
  onMarkViewed: (id: string) => void
}

export function ZenMode({ prompts, onClose, onMarkViewed }: ZenModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentPrompt = prompts[currentIndex]

  const handleNext = () => {
    if (currentIndex < prompts.length - 1) {
      if (!currentPrompt.viewed) {
        onMarkViewed(currentPrompt.id)
      }
      setCurrentIndex(currentIndex + 1)
    } else {
      onClose()
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'connection': return 'var(--premium-blue)'
      case 'divergent': return 'var(--premium-emerald)'
      case 'revisit': return 'var(--premium-purple)'
      case 'transform': return 'var(--premium-gold)'
      default: return 'var(--premium-platinum)'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'connection': return '🔗'
      case 'divergent': return '🌊'
      case 'revisit': return '🔮'
      case 'transform': return '✨'
      default: return '💭'
    }
  }

  // Ambient background gradient that shifts based on prompt type
  const getBackgroundGradient = (type: string) => {
    switch (type) {
      case 'connection':
        return 'radial-gradient(circle at 30% 50%, rgba(59, 130, 246, 0.15), transparent 70%), radial-gradient(circle at 70% 80%, rgba(139, 92, 246, 0.10), transparent 70%)'
      case 'divergent':
        return 'radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.15), transparent 70%), radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.10), transparent 70%)'
      case 'revisit':
        return 'radial-gradient(circle at 40% 60%, rgba(139, 92, 246, 0.15), transparent 70%), radial-gradient(circle at 90% 40%, rgba(236, 72, 153, 0.10), transparent 70%)'
      case 'transform':
        return 'radial-gradient(circle at 60% 40%, rgba(245, 158, 11, 0.15), transparent 70%), radial-gradient(circle at 30% 80%, rgba(239, 68, 68, 0.10), transparent 70%)'
      default:
        return 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.10), transparent 70%)'
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 10, 0.95)',
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* Animated background */}
      <motion.div
        className="absolute inset-0 transition-all duration-[2000ms] ease-in-out"
        style={{
          background: getBackgroundGradient(currentPrompt.type)
        }}
        key={`bg-${currentPrompt.id}`}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full transition-all hover:bg-white/10"
        style={{ color: 'var(--premium-text-secondary)' }}
      >
        <X className="h-6 w-6" />
      </button>

      {/* Progress dots */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 flex gap-2">
        {prompts.map((_, index) => (
          <div
            key={index}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: index === currentIndex ? '24px' : '8px',
              backgroundColor: index === currentIndex
                ? 'var(--premium-blue)'
                : index < currentIndex
                ? 'rgba(59, 130, 246, 0.4)'
                : 'rgba(255, 255, 255, 0.2)'
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative max-w-2xl w-full mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPrompt.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center space-y-8"
          >
            {/* Type badge */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl">{getTypeIcon(currentPrompt.type)}</span>
              <span
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: getTypeColor(currentPrompt.type) }}
              >
                {currentPrompt.type}
              </span>
            </div>

            {/* Prompt text */}
            <motion.p
              className="text-2xl md:text-3xl leading-relaxed font-light px-4"
              style={{ color: 'var(--premium-text-primary)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              {currentPrompt.prompt}
            </motion.p>

            {/* Metaphor */}
            {currentPrompt.metaphor && (
              <motion.div
                className="flex items-start justify-center gap-2 px-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
              >
                <Star className="h-4 w-4 mt-1 flex-shrink-0" style={{ color: 'var(--premium-gold)' }} />
                <p className="text-base italic" style={{ color: 'var(--premium-text-secondary)' }}>
                  {currentPrompt.metaphor}
                </p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-16">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
            style={{ color: 'var(--premium-text-secondary)' }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--premium-text-tertiary)' }}>
              {currentIndex + 1} of {prompts.length}
            </p>
            {currentIndex === prompts.length - 1 && (
              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                Tap → to close
              </p>
            )}
          </div>

          <button
            onClick={handleNext}
            className="p-4 rounded-full transition-all hover:bg-white/10"
            style={{ color: 'var(--premium-text-secondary)' }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: getTypeColor(currentPrompt.type) }}
          animate={{
            x: ['-50%', '150%'],
            y: ['100%', '-50%'],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'linear'
          }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: getTypeColor(currentPrompt.type) }}
          animate={{
            x: ['150%', '-50%'],
            y: ['-50%', '100%'],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'linear'
          }}
        />
      </div>
    </div>
  )
}
