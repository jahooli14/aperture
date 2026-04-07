/**
 * SignInNudge — contextual gates for unauthenticated users.
 *
 * Each variant shows the outcome of using that feature,
 * not the mechanism behind it. No locks, no data-lake language.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Feather, Sprout, Library, ArrowRight, ChevronRight, BookOpen, Film, MapPin } from 'lucide-react'

type Variant = 'thoughts' | 'projects' | 'lists'

interface SignInNudgeProps {
  variant: Variant
}

// ── Thoughts variant: voice notes that go somewhere ─────────────────────

function ThoughtsVisual() {
  const notes = [
    { text: 'maybe I should write about what I learned from that failure…', time: '2h ago' },
    { text: 'the thing connecting all my side projects is systems thinking', time: 'yesterday' },
    { text: 'that conversation with Mel changed how I see the problem', time: '3d ago' },
  ]

  return (
    <div className="flex flex-col gap-2 mb-2">
      {notes.map((note, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.18, duration: 0.4 }}
          className="flex items-start gap-3 px-3 py-2.5 rounded-xl text-left"
          style={{
            backgroundColor: 'var(--glass-surface)',
            border: '1px solid var(--glass-surface-hover)',
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
            style={{
              backgroundColor: i === 0
                ? 'var(--brand-primary)'
                : i === 1 ? '#8B5CF6' : '#10B981',
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--brand-text-primary)', opacity: 0.85 }}>
              {note.text}
            </p>
            <span className="text-[10px] mt-1 block" style={{ color: 'var(--brand-text-muted)' }}>
              {note.time}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── Projects variant: a project that emerged from thinking ──────────────

function ProjectsVisual() {
  return (
    <div className="flex flex-col gap-2.5 mb-2">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="w-full rounded-xl p-4"
        style={{
          backgroundColor: 'var(--glass-surface)',
          border: '1px solid var(--glass-surface-hover)',
        }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: '#8B5CF6' }}
          />
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            Systems Thinking Essay
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex items-center gap-1 text-xs pl-5 mb-3"
          style={{ color: '#8B5CF6', opacity: 0.8 }}
        >
          <ChevronRight className="w-3 h-3" />
          next: write the opening paragraph
        </motion.div>
        {/* Momentum bar */}
        <div className="pl-5">
          <div className="h-1 rounded-full w-full" style={{ backgroundColor: 'var(--glass-surface-hover)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '45%' }}
              transition={{ delay: 1.2, duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #8B5CF6, var(--brand-primary))' }}
            />
          </div>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="text-[11px] text-center"
        style={{ color: 'var(--brand-text-muted)' }}
      >
        emerged from 5 voice notes over 2 weeks
      </motion.p>
    </div>
  )
}

// ── Lists variant: curated collections ──────────────────────────────────

function ListsVisual() {
  const lists = [
    { label: 'books', color: '#F59E0B', icon: BookOpen },
    { label: 'films', color: '#EC4899', icon: Film },
    { label: 'places', color: '#10B981', icon: MapPin },
  ]

  return (
    <div className="flex gap-3 justify-center mb-2">
      {lists.map((list, i) => {
        const Icon = list.icon
        return (
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
          <Icon className="h-5 w-5" style={{ color: list.color }} />
          <span className="text-xs" style={{ color: list.color }}>
            {list.label}
          </span>
        </motion.div>
        )
      })}
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
    header: 'capture anything. organise nothing.',
    subtext: 'just talk. your thoughts sort themselves out.',
    cta: 'sign in to start',
    Visual: ThoughtsVisual,
  },
  projects: {
    icon: Sprout,
    header: 'your next project is already in your head',
    subtext: 'keep thinking out loud. the shape reveals itself.',
    cta: 'sign in to see yours',
    Visual: ProjectsVisual,
  },
  lists: {
    icon: Library,
    header: 'curate what shapes you',
    subtext: 'books, films, places — the things that made you, you.',
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
            color: 'var(--brand-text-primary)',
          }}
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </div>
  )
}
