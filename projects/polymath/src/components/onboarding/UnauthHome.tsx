/**
 * UnauthHome — The first screen unauthenticated users see.
 *
 * Instead of a lock icon and "unlock your knowledge graph", this demonstrates
 * the app's core loop: speak → AI extracts meaning → connections appear.
 * A cycling animated demo shows what happens when you use Polymath.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, User, MapPin, Hash, Link2, ArrowRight } from 'lucide-react'

interface DemoThought {
  transcript: string
  entities: { icon: typeof User; label: string; color: string }[]
  connection: string
}

const DEMO_THOUGHTS: DemoThought[] = [
  {
    transcript:
      "I keep thinking about that conversation with Sarah about moving to Portland… it connects to that article about creative cities I read last week",
    entities: [
      { icon: User, label: 'Sarah', color: 'rgba(96, 165, 250, 0.9)' },
      { icon: MapPin, label: 'Portland', color: 'rgba(52, 211, 153, 0.9)' },
      { icon: Hash, label: 'creative cities', color: 'rgba(251, 191, 36, 0.9)' },
    ],
    connection: 'links to 3 thoughts about relocation',
  },
  {
    transcript:
      "That podcast on distributed systems reminded me of how ant colonies work… there's something about emergent behaviour I want to dig into",
    entities: [
      { icon: Hash, label: 'distributed systems', color: 'rgba(167, 139, 250, 0.9)' },
      { icon: Hash, label: 'emergent behaviour', color: 'rgba(251, 146, 60, 0.9)' },
      { icon: Hash, label: 'ant colonies', color: 'rgba(52, 211, 153, 0.9)' },
    ],
    connection: 'links to 2 thoughts about complex systems',
  },
  {
    transcript:
      "I want to build a tool that helps me track what I'm reading and connects it to things I've been thinking about… like a personal research engine",
    entities: [
      { icon: Hash, label: 'reading tracker', color: 'rgba(96, 165, 250, 0.9)' },
      { icon: Hash, label: 'research engine', color: 'rgba(244, 114, 182, 0.9)' },
      { icon: Hash, label: 'personal tools', color: 'rgba(251, 191, 36, 0.9)' },
    ],
    connection: 'sparked a new project idea',
  },
]

const CYCLE_DURATION = 10000

// Simple animated waveform bars
function Waveform() {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {Array.from({ length: 16 }).map((_, i) => (
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
      setActiveIndex(prev => (prev + 1) % DEMO_THOUGHTS.length)
    }, CYCLE_DURATION)
    return () => clearInterval(interval)
  }, [])

  const thought = DEMO_THOUGHTS[activeIndex]

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
        polymath
      </motion.h1>

      {/* Hero line */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-base mb-10"
        style={{ color: 'var(--brand-text-secondary)', letterSpacing: '-0.01em' }}
      >
        speak. watch it connect.
      </motion.p>

      {/* Animated demo card */}
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
              {/* Waveform + mic label */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(56, 189, 248, 0.12)' }}
                >
                  <Mic className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
                </div>
                <Waveform />
              </div>

              {/* Transcript appearing */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-sm leading-relaxed mb-5"
                style={{ color: 'var(--brand-text-primary)' }}
              >
                "{thought.transcript}"
              </motion.p>

              {/* Extracted entities */}
              <div className="flex flex-wrap gap-2 mb-4">
                {thought.entities.map((entity, i) => {
                  const Icon = entity.icon
                  return (
                    <motion.div
                      key={entity.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.0 + i * 0.2, duration: 0.35 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--glass-surface)',
                        border: '1px solid var(--glass-surface-hover)',
                        color: entity.color,
                      }}
                    >
                      <Icon className="w-3 h-3" />
                      {entity.label}
                    </motion.div>
                  )
                })}
              </div>

              {/* Connection line */}
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.8, duration: 0.4 }}
                className="flex items-center gap-2 text-xs"
                style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
              >
                <Link2 className="w-3 h-3" />
                {thought.connection}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Cycle dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {DEMO_THOUGHTS.map((_, i) => (
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
        <button
          onClick={() => navigate('/onboarding')}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] aperture-header"
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary), #818cf8)',
            color: '#fff',
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
