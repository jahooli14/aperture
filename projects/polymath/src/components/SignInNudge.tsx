/**
 * SignInNudge — shown on pages when user is not authenticated.
 * Encourages sign-in without completely blocking the experience.
 */
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, ArrowRight, Sparkles } from 'lucide-react'

interface SignInNudgeProps {
  /** What the user unlocks by signing in */
  feature?: string
  /** Optional extra context */
  description?: string
  /** Show the try-onboarding CTA */
  showOnboarding?: boolean
}

export function SignInNudge({
  feature = 'your knowledge graph',
  description = 'Sign in to save thoughts, track projects, and build your second brain.',
  showOnboarding = false,
}: SignInNudgeProps) {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center px-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center"
      >
        {/* Icon */}
        <div
          className="mx-auto mb-6 rounded-full p-5 inline-flex"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(129, 140, 248, 0.15))',
          }}
        >
          <Lock className="h-8 w-8" style={{ color: 'var(--brand-primary)' }} />
        </div>

        {/* Title */}
        <h2
          className="aperture-header text-2xl mb-2"
          style={{ color: 'var(--brand-text-primary)' }}
        >
          unlock {feature}
        </h2>

        {/* Description */}
        <p
          className="text-sm mb-8 leading-relaxed"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          {description}
        </p>

        {/* Sign in button */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] mb-3"
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary), #818cf8)',
            color: '#fff',
          }}
        >
          sign in <ArrowRight className="h-4 w-4" />
        </button>

        {/* Try onboarding option */}
        {showOnboarding && (
          <button
            onClick={() => navigate('/onboarding')}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm transition-all hover:opacity-80"
            style={{
              backgroundColor: 'var(--glass-surface)',
              color: 'var(--brand-text-secondary)',
              border: '1px solid var(--glass-surface-hover)',
            }}
          >
            <Sparkles className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
            try it first
          </button>
        )}
      </motion.div>
    </div>
  )
}
