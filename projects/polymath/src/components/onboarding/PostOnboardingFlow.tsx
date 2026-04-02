/**
 * PostOnboardingFlow — The bridge between onboarding reveal and the real app
 *
 * Instead of dumping users onto the full homepage after the reveal sequence,
 * this guides them into their FIRST action: starting a project via chat.
 *
 * The flow:
 *   1. "You're in" — celebratory moment with their top theme
 *   2. Chat-based project kickoff — seeded with their onboarding data
 *   3. Redirect to project detail page with chat open
 *
 * This is the "so what" — the moment where captured data becomes actionable.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, MessageCircle, Sparkles, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CreateProjectDialog } from '../projects/CreateProjectDialog'
import { useJourneyStore } from '../../stores/useJourneyStore'
import type { OnboardingAnalysis } from '../../types'

interface PostOnboardingFlowProps {
  analysis: OnboardingAnalysis
  /** The suggestion the user sparked, if any */
  sparkedSuggestion?: {
    title: string
    description: string
    reasoning: string
  } | null
}

type FlowPhase = 'welcome' | 'chat' | 'complete'

export function PostOnboardingFlow({ analysis, sparkedSuggestion }: PostOnboardingFlowProps) {
  const navigate = useNavigate()
  const { startJourney, completeChallenge, setFirstProjectId } = useJourneyStore()
  const [phase, setPhase] = useState<FlowPhase>('welcome')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Start the journey when this component mounts
  useEffect(() => {
    startJourney()
  }, [])

  const topTheme = analysis.themes[0] || 'your ideas'
  const topCapability = analysis.capabilities[0] || 'creative thinking'

  // Build a rich seed conversation from onboarding data
  const seedConversation = sparkedSuggestion
    ? [
        {
          role: 'model' as const,
          content: `Based on everything you shared — your interest in **${topTheme}**, your knack for **${topCapability}** — here's what stood out:\n\n**${sparkedSuggestion.title}**\n\n${sparkedSuggestion.description}\n\n_${sparkedSuggestion.reasoning}_\n\nLet's shape this into something real. What version of this would only you make?`,
        },
      ]
    : [
        {
          role: 'model' as const,
          content: `I've been thinking about what you shared. Your mind keeps circling back to **${topTheme}**, and you've got a real strength in **${topCapability}**.\n\n${analysis.first_insight || 'There\'s a project hiding in those threads.'}\n\nLet's find it. What\'s the thing you keep wanting to build but haven\'t started?`,
        },
      ]

  const handleProjectCreated = (projectId: string) => {
    setFirstProjectId(projectId)
    // Complete Day 1 challenge (voice note was done in onboarding)
    // and Day 4 (start a project) since they just created one
    completeChallenge(1)
    setPhase('complete')

    // Navigate to the project after a celebration beat
    setTimeout(() => {
      navigate(`/projects/${projectId}`)
    }, 2500)
  }

  const handleSkipToHome = () => {
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12">
      <AnimatePresence mode="wait">
        {/* ── Phase 1: Welcome Moment ──────────────────────────────── */}
        {phase === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex flex-col items-center justify-center text-center max-w-md"
          >
            {/* Animated sparkle */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8"
              style={{
                background: 'linear-gradient(135deg, rgba(99,179,237,0.15), rgba(168,85,247,0.15))',
                border: '1px solid rgba(99,179,237,0.2)',
              }}
            >
              <Sparkles className="h-8 w-8" style={{ color: 'var(--brand-primary)' }} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl font-bold mb-4"
              style={{ color: 'var(--brand-text-primary)' }}
            >
              Polymath knows you now.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-base mb-3 leading-relaxed"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              Your thoughts, your bookshelf, your capabilities — it's all connected.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-sm mb-10"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
            >
              Now let's do something with it.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="flex flex-col items-center gap-3"
            >
              <button
                onClick={() => {
                  setPhase('chat')
                  setShowCreateDialog(true)
                }}
                className="btn-primary px-8 py-4 text-base font-semibold inline-flex items-center gap-3"
              >
                <MessageCircle className="h-5 w-5" />
                Start your first project
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={handleSkipToHome}
                className="text-sm transition-opacity hover:opacity-80 inline-flex items-center gap-1.5 mt-2"
                style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
              >
                I'll explore first
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ── Phase 2: Chat (CreateProjectDialog handles the UI) ─── */}
        {phase === 'chat' && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            {/* Subtle context banner above the dialog */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-4"
            >
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--brand-primary)', opacity: 0.6 }}>
                Your first project
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ── Phase 3: Project Created Celebration ─────────────────── */}
        {phase === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="flex-1 flex flex-col items-center justify-center text-center max-w-md"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(99,179,237,0.15))',
                border: '2px solid rgba(34,197,94,0.3)',
              }}
            >
              <Zap className="h-10 w-10" style={{ color: 'rgb(34,197,94)' }} />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold mb-3"
              style={{ color: 'var(--brand-text-primary)' }}
            >
              Project sparked.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-sm"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.7 }}
            >
              Taking you there now...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CreateProjectDialog — opens as sheet in chat phase */}
      <CreateProjectDialog
        isOpen={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open && phase === 'chat') {
            // User closed dialog without creating — go to home
            navigate('/')
          }
        }}
        hideTrigger
        seedConversation={seedConversation}
        onCreated={handleProjectCreated}
      />
    </div>
  )
}
