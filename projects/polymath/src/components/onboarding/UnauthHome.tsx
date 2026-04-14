/**
 * UnauthHome — The first screen unauthenticated users see.
 *
 * Shows the outcome, not the mechanism: scattered voice notes become
 * shaped projects with momentum. The data lake is invisible —
 * what matters is that your thinking goes somewhere.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, ArrowRight, ChevronRight } from 'lucide-react'

interface DemoStory {
  /** The messy voice note — relatable, raw */
  voiceNote: string
  /** What it became — the outcome */
  project: { title: string; status: string; color: string }
  /** How many scattered thoughts fed into this */
  fromCount: number
}

const DEMO_STORIES: DemoStory[] = [
  {
    voiceNote:
      "I keep coming back to this idea about moving somewhere more creative… Portland, maybe Berlin…",
    project: {
      title: 'Relocation Plan',
      status: 'next step: research cost of living',
      color: 'rgb(var(--brand-primary-rgb))',
    },
    fromCount: 6,
  },
  {
    voiceNote:
      "That podcast about ant colonies got me thinking about how teams self-organise…",
    project: {
      title: 'Emergent Systems Essay',
      status: 'draft outline ready',
      color: 'rgb(var(--brand-primary-rgb))',
    },
    fromCount: 4,
  },
  {
    voiceNote:
      "I want to make something that helps people track what they read and why it mattered…",
    project: {
      title: 'Reading Companion App',
      status: 'next step: sketch the core flow',
      color: 'rgb(var(--brand-primary-rgb))',
    },
    fromCount: 8,
  },
]

const CYCLE_DURATION = 8000

// Simple animated waveform bars
function Waveform() {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          animate={{
            height: [4, 8 + Math.random() * 12, 4],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 0.8 + Math.random() * 0.6,
            repeat: Infinity,
            delay: i * 0.06,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

export function UnauthHome() {
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % DEMO_STORIES.length)
    }, CYCLE_DURATION)
    return () => clearInterval(interval)
  }, [])

  const story = DEMO_STORIES[activeIndex]

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 pt-14 pb-32"
      style={{ backgroundColor: 'var(--brand-bg)' }}
    >
      {/* Brand */}
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aperture-header mb-3"
        style={{
          fontSize: '2.5rem',
          color: 'var(--brand-primary)',
          letterSpacing: '-0.04em',
        }}
      >
        aperture
      </motion.h1>

      {/* Hero hook — the outcome they're here for, in one breath. */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-lg sm:text-xl mb-2 text-center font-medium leading-snug px-4"
        style={{ color: 'var(--brand-text-primary)', letterSpacing: '-0.01em' }}
      >
        Three minutes of talking.<br />
        <span style={{ color: 'var(--brand-primary)' }}>
          A project you'd never have thought of.
        </span>
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-sm mb-10 text-center px-4"
        style={{ color: 'var(--brand-text-secondary)', letterSpacing: '-0.01em' }}
      >
        Aperture listens. The thread between what you said reveals itself.
      </motion.p>

      {/* Animated story card — shows the transformation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="w-full max-w-sm mb-10"
      >
        <div
          className="rounded-2xl p-5 overflow-hidden"
          style={{
            backgroundColor: 'var(--brand-glass-bg)',
            backdropFilter: 'var(--brand-glass-blur)',
            WebkitBackdropFilter: 'var(--brand-glass-blur)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Voice note — the messy input */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(var(--brand-primary-rgb), 0.12)' }}
                >
                  <Mic className="w-3.5 h-3.5" style={{ color: 'var(--brand-primary)' }} />
                </div>
                <Waveform />
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-sm leading-relaxed mb-5 italic"
                style={{ color: 'var(--brand-text-secondary)' }}
              >
                "{story.voiceNote}"
              </motion.p>

              {/* The transformation arrow */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 1.2, duration: 0.3 }}
                className="flex items-center gap-2 mb-4 text-xs"
                style={{ color: 'var(--brand-text-muted)' }}
              >
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--glass-surface-hover)' }} />
                <span>
                  from {story.fromCount} voice notes
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--glass-surface-hover)' }} />
              </motion.div>

              {/* The outcome — a shaped project */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6, duration: 0.4 }}
                className="rounded-xl p-3.5"
                style={{
                  backgroundColor: 'var(--glass-surface)',
                  border: '1px solid var(--glass-surface-hover)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: story.project.color }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--brand-text-primary)' }}
                  >
                    {story.project.title}
                  </span>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.2, duration: 0.4 }}
                  className="flex items-center gap-1 text-xs pl-5"
                  style={{ color: story.project.color, opacity: 0.8 }}
                >
                  <ChevronRight className="w-3 h-3" />
                  {story.project.status}
                </motion.div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Cycle dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {DEMO_STORIES.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              animate={{
                width: i === activeIndex ? 16 : 5,
                height: 5,
                backgroundColor:
                  i === activeIndex ? 'var(--brand-primary)' : 'var(--brand-text-muted)',
                opacity: i === activeIndex ? 1 : 0.3,
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="w-full max-w-sm flex flex-col items-center gap-3"
      >
        {/* Primary CTA — skip the /onboarding gate for happy-path users
            and go straight to sign-in. After sign-in they land on
            /onboarding ready to begin, one fewer tap on the way in. */}
        <button
          onClick={() => navigate('/login?next=/onboarding')}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] aperture-header"
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary), rgb(var(--color-accent-light-rgb)))',
            color: 'var(--brand-text-primary)',
          }}
        >
          start talking <ArrowRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => navigate('/login')}
          className="text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--brand-text-muted)' }}
        >
          already have an account? <span style={{ color: 'var(--brand-primary)' }}>sign in</span>
        </button>
      </motion.div>
    </div>
  )
}
