/**
 * SignInNudge — contextual gates for unauthenticated users.
 *
 * Each variant shows a different facet of the app's intelligence,
 * matched to the tab it gates. No more identical lock screens.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Feather, Sprout, Library, ArrowRight, Link2 } from 'lucide-react'

type Variant = 'thoughts' | 'projects' | 'lists'

interface SignInNudgeProps {
  variant: Variant
}

// ── Thoughts variant: connection lines between thought snippets ─────────

function ThoughtsVisual() {
  const thoughts = [
    { text: 'creative cities and where to live', x: 20, y: 0 },
    { text: 'distributed systems remind me of nature', x: 0, y: 44 },
    { text: 'building a personal research tool', x: 40, y: 88 },
  ]

  return (
    <div className="relative w-full h-36 mb-2">
      {/* Connection lines (SVG) */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible' }}
      >
        <motion.line
          x1="50%" y1="16" x2="30%" y2="56"
          stroke="var(--brand-primary)"
          strokeWidth="1"
          strokeDasharray="4 3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        />
        <motion.line
          x1="50%" y1="56" x2="60%" y2="100"
          stroke="var(--brand-primary)"
          strokeWidth="1"
          strokeDasharray="4 3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        />
      </svg>

      {/* Thought chips */}
      {thoughts.map((t, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.2, duration: 0.4 }}
          className="absolute px-3 py-2 rounded-xl text-xs"
          style={{
            left: `${t.x}px`,
            top: `${t.y}px`,
            backgroundColor: 'var(--glass-surface)',
            border: '1px solid var(--glass-surface-hover)',
            color: 'var(--brand-text-primary)',
            maxWidth: '220px',
          }}
        >
          {t.text}
        </motion.div>
      ))}
    </div>
  )
}

// ── Projects variant: a mock sparked project card ───────────────────────

function ProjectsVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="w-full rounded-xl p-4 mb-2"
      style={{
        backgroundColor: 'var(--glass-surface)',
        border: '1px solid var(--glass-surface-hover)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: '#3B82F6' }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            Creative Cities Research
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
          >
            <Link2 className="w-3 h-3" />
            sparked by 4 related thoughts
          </motion.div>
        </div>
      </div>
      {/* Mock progress bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
        className="mt-3 h-1 rounded-full origin-left"
        style={{
          background: 'linear-gradient(90deg, var(--brand-primary), #818cf8)',
          width: '35%',
        }}
      />
    </motion.div>
  )
}

// ── Lists variant: mock list covers ─────────────────────────────────────

function ListsVisual() {
  const lists = [
    { label: 'books', color: '#F59E0B', emoji: '📚' },
    { label: 'films', color: '#EC4899', emoji: '🎬' },
    { label: 'places', color: '#10B981', emoji: '📍' },
  ]

  return (
    <div className="flex gap-3 justify-center mb-2">
      {lists.map((list, i) => (
        <motion.div
          key={list.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 300 }}
          className="w-20 h-24 rounded-xl flex flex-col items-center justify-center gap-1.5"
          style={{
            backgroundColor: 'var(--glass-surface)',
            border: '1px solid var(--glass-surface-hover)',
          }}
        >
          <span className="text-xl">{list.emoji}</span>
          <span className="text-xs" style={{ color: list.color }}>
            {list.label}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

// ── Variant config ──────────────────────────────────────────────────────

const VARIANTS: Record<Variant, {
  icon: typeof Feather
  header: string
  subtext: string
  cta: string
  Visual: () => React.ReactNode
}> = {
  thoughts: {
    icon: Feather,
    header: 'your thoughts, untangled',
    subtext: 'speak freely. aperture finds the threads.',
    cta: 'sign in to start',
    Visual: ThoughtsVisual,
  },
  projects: {
    icon: Sprout,
    header: 'projects that find you',
    subtext: 'aperture notices when your ideas want to become something.',
    cta: 'sign in to discover yours',
    Visual: ProjectsVisual,
  },
  lists: {
    icon: Library,
    header: 'curate what shapes you',
    subtext: 'books, films, places — all woven into your thinking.',
    cta: 'sign in to start curating',
    Visual: ListsVisual,
  },
}

export function SignInNudge({ variant }: SignInNudgeProps) {
  const navigate = useNavigate()
  const { icon: Icon, header, subtext, cta, Visual } = VARIANTS[variant]

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center"
      >
        {/* Icon */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto mb-5 rounded-2xl p-4 inline-flex"
          style={{
            background:
              'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(129, 140, 248, 0.1))',
          }}
        >
          <Icon className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
        </motion.div>

        {/* Header */}
        <h2
          className="aperture-header text-2xl mb-2"
          style={{ color: 'var(--brand-text-primary)' }}
        >
          {header}
        </h2>

        {/* Subtext */}
        <p
          className="text-sm mb-8 leading-relaxed"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          {subtext}
        </p>

        {/* Visual demo */}
        <div className="mb-8">
          <Visual />
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] aperture-header"
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary), #818cf8)',
            color: '#fff',
          }}
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </div>
  )
}
