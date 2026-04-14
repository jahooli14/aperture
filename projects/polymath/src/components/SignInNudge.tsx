/**
 * SignInNudge — contextual pre-signin screens for each pillar tab.
 *
 * The job of each variant is to hint at the MAGIC — the voice → insight
 * → outcome transformation — not to describe features. Every visual
 * animates from "something the user said" toward "something the product
 * surfaced." The CTA funnels everyone to /onboarding (the guarded chat
 * experience) with a secondary link for returning users.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Feather, Sprout, Library, ArrowRight, Mic, BookOpen, Film, MapPin } from 'lucide-react'

type Variant = 'thoughts' | 'projects' | 'lists'

interface SignInNudgeProps {
  variant: Variant
}

// ── Tiny animated waveform — shared accent, shows "voice is the input" ──

function MiniWaveform() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          animate={{
            height: [3, 6 + Math.random() * 8, 3],
            opacity: [0.35, 0.8, 0.35],
          }}
          transition={{
            duration: 0.7 + Math.random() * 0.5,
            repeat: Infinity,
            delay: i * 0.06,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ── Thoughts variant: a voice note gets threaded to an earlier one ─────

function ThoughtsVisual() {
  return (
    <div className="flex flex-col gap-2">
      {/* A voice note (raw input) */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="flex items-start gap-3 px-3 py-2.5 rounded-xl text-left"
        style={{
          backgroundColor: 'var(--glass-surface)',
          border: '1px solid var(--glass-surface-hover)',
        }}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: 'rgba(var(--brand-primary-rgb),0.14)' }}
        >
          <Mic className="w-3 h-3" style={{ color: 'var(--brand-primary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed italic" style={{ color: 'var(--brand-text-secondary)' }}>
            "the welding part caught my ear — I miss making things with my hands"
          </p>
        </div>
      </motion.div>

      {/* The thread — the magic moment */}
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="flex items-center gap-2 pl-9 pr-3"
      >
        <div className="w-px h-4" style={{ backgroundColor: 'var(--brand-primary)', opacity: 0.4 }} />
        <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--brand-primary)', opacity: 0.75 }}>
          threaded with
        </span>
      </motion.div>

      {/* The earlier note it connects to */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.5, duration: 0.4 }}
        className="flex items-start gap-3 px-3 py-2.5 rounded-xl text-left"
        style={{
          backgroundColor: 'var(--glass-surface)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.22)',
          boxShadow: '0 0 18px -6px rgba(var(--brand-primary-rgb),0.25)',
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed italic" style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}>
            "my grandfather had this workshop…"
          </p>
          <span className="text-[10px] mt-1 block" style={{ color: 'var(--brand-text-muted)' }}>
            from 3 days ago
          </span>
        </div>
      </motion.div>
    </div>
  )
}

// ── Projects variant: fragments coalesce into a project card ───────────

function ProjectsVisual() {
  const fragments = [
    'weekend welding',
    'grandfather\'s workshop',
    'working with my hands',
  ]
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Fragments float in, then settle */}
      <div className="flex flex-wrap justify-center gap-2 min-h-[2rem]">
        {fragments.map((f, i) => (
          <motion.span
            key={f}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: [0, 1, 1, 0.45], y: 0 }}
            transition={{ delay: 0.3 + i * 0.18, duration: 1.4, times: [0, 0.25, 0.75, 1] }}
            className="px-2.5 py-1 rounded-full text-[11px] italic"
            style={{
              backgroundColor: 'var(--glass-surface)',
              border: '1px solid var(--glass-surface-hover)',
              color: 'var(--brand-text-secondary)',
            }}
          >
            "{f}"
          </motion.span>
        ))}
      </div>

      {/* The project that emerges */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        className="w-full rounded-xl p-4"
        style={{
          backgroundColor: 'var(--glass-surface)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.22)',
          boxShadow: '0 6px 24px -12px rgba(var(--brand-primary-rgb),0.35)',
        }}
      >
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--brand-text-primary)' }}>
            A small workshop, in spare hours
          </span>
        </div>
        <p className="text-[11px] pl-5 italic" style={{ color: 'var(--brand-text-muted)' }}>
          emerged from what you said
        </p>
      </motion.div>
    </div>
  )
}

// ── Lists variant: a mentioned thing gets auto-filed into a list ───────

function ListsVisual() {
  const tiles = [
    { label: 'books', color: '#F59E0B', icon: BookOpen },
    { label: 'films', color: '#EC4899', icon: Film },
    { label: 'places', color: '#10B981', icon: MapPin },
  ]
  return (
    <div className="flex flex-col items-center gap-3">
      {/* A voice fragment mentioning a specific thing */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
        style={{
          backgroundColor: 'var(--glass-surface)',
          border: '1px solid var(--glass-surface-hover)',
        }}
      >
        <MiniWaveform />
        <p className="text-xs italic" style={{ color: 'var(--brand-text-secondary)' }}>
          "…finally reading <span style={{ color: '#F59E0B', fontStyle: 'normal', fontWeight: 600 }}>Dune</span>…"
        </p>
      </motion.div>

      {/* A downward thread indicating auto-filing */}
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay: 1.1, duration: 0.4 }}
        className="w-px h-4"
        style={{ backgroundColor: 'var(--brand-primary)', opacity: 0.5, transformOrigin: 'top' }}
      />

      {/* The tiles — the books tile glows as if just received an item */}
      <div className="flex gap-3 justify-center">
        {tiles.map((list, i) => {
          const Icon = list.icon
          const isTarget = list.label === 'books'
          return (
            <motion.div
              key={list.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: 1,
                scale: isTarget ? [1, 1.06, 1] : 1,
                boxShadow: isTarget
                  ? ['0 0 0px 0px rgba(245,158,11,0)', '0 0 18px 0px rgba(245,158,11,0.45)', '0 0 0px 0px rgba(245,158,11,0)']
                  : 'none',
              }}
              transition={{
                opacity: { delay: 0.3 + i * 0.1 },
                scale: isTarget ? { delay: 1.55, duration: 0.8, ease: 'easeOut' } : { delay: 0.3 + i * 0.1 },
                boxShadow: isTarget ? { delay: 1.55, duration: 0.8, ease: 'easeOut' } : {},
              }}
              className="w-20 h-24 rounded-xl flex flex-col items-center justify-center gap-1.5"
              style={{
                backgroundColor: 'var(--glass-surface)',
                border: `1px solid ${isTarget ? 'rgba(245,158,11,0.35)' : 'var(--glass-surface-hover)'}`,
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
    </div>
  )
}

// ── Variant config ──────────────────────────────────────────────────────

const VARIANTS: Record<Variant, {
  icon: typeof Feather
  header: string
  subtext: string
  Visual: () => React.ReactNode
}> = {
  thoughts: {
    icon: Feather,
    header: 'capture anything. organise nothing.',
    subtext: 'just talk. the things you say link themselves up.',
    Visual: ThoughtsVisual,
  },
  projects: {
    icon: Sprout,
    header: 'your next project is already in your head',
    subtext: 'keep thinking out loud. the shape reveals itself.',
    Visual: ProjectsVisual,
  },
  lists: {
    icon: Library,
    header: 'curate what shapes you',
    subtext: 'mention a book, a film, a place — it lands in the right list.',
    Visual: ListsVisual,
  },
}

export function SignInNudge({ variant }: SignInNudgeProps) {
  const navigate = useNavigate()
  const { icon: Icon, header, subtext, Visual } = VARIANTS[variant]

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 pt-10 pb-16">
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
              'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.12), rgba(var(--brand-primary-rgb), 0.06))',
          }}
        >
          <Icon className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
        </motion.div>

        {/* Header */}
        <h2
          className="aperture-header text-2xl mb-2 leading-tight"
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

        {/* Visual demo — the magic moment in miniature */}
        <div className="mb-8">
          <Visual />
        </div>

        {/* Primary CTA — everyone funnels through /onboarding, which gates
            on sign-in but leads with the promise rather than the ask. */}
        <button
          onClick={() => navigate('/onboarding')}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] aperture-header"
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary), rgb(var(--color-accent-light-rgb)))',
            color: 'var(--brand-text-primary)',
          }}
        >
          start talking <ArrowRight className="h-4 w-4" />
        </button>

        {/* Secondary — returning users go straight to login. */}
        <button
          onClick={() => navigate('/login')}
          className="mt-4 text-xs transition-opacity hover:opacity-80"
          style={{ color: 'var(--brand-text-muted)' }}
        >
          already have an account? <span style={{ color: 'var(--brand-primary)' }}>sign in</span>
        </button>
      </motion.div>
    </div>
  )
}
