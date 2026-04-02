/**
 * PostOnboardingFlow — The bridge between onboarding reveal and the real app
 *
 * Instead of dumping users onto the full homepage after the reveal sequence,
 * this guides them into their FIRST action: starting a project via chat.
 *
 * The flow:
 *   1. "You're in" — celebratory moment with their top theme
 *   2. Chat-based project kickoff — seeded with their onboarding data
 *   3. Cinematic first project reveal — the project becomes REAL
 *
 * This is the "so what" — the moment where captured data becomes actionable.
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CreateProjectDialog } from '../projects/CreateProjectDialog'
import { useJourneyStore } from '../../stores/useJourneyStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { PROJECT_COLORS } from '../projects/ProjectCard'
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

type FlowPhase = 'welcome' | 'chat' | 'reveal'

// Particle positions for the burst effect — pre-computed for consistency
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  angle: (i / 24) * Math.PI * 2,
  distance: 80 + Math.random() * 100,
  size: 3 + Math.random() * 4,
  delay: Math.random() * 0.3,
  duration: 0.8 + Math.random() * 0.6,
}))

// Orbital ring dots
const ORBITALS = Array.from({ length: 8 }, (_, i) => ({
  angle: (i / 8) * Math.PI * 2,
  delay: i * 0.08,
}))

function getProjectColor(type: string): string {
  const t = type?.toLowerCase().trim() || ''
  return PROJECT_COLORS[t] || PROJECT_COLORS['default']
}

export function PostOnboardingFlow({ analysis, sparkedSuggestion }: PostOnboardingFlowProps) {
  const navigate = useNavigate()
  const { startJourney, completeChallenge, setFirstProjectId } = useJourneyStore()
  const { allProjects } = useProjectStore()
  const [phase, setPhase] = useState<FlowPhase>('welcome')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [revealBeat, setRevealBeat] = useState(0)
  const [whyYouStatement, setWhyYouStatement] = useState<string | null>(null)

  // Start the journey and persist onboarding analysis
  useEffect(() => {
    startJourney({
      themes: analysis.themes || [],
      capabilities: analysis.capabilities || [],
      firstInsight: analysis.first_insight || '',
    })
  }, [])

  // Pull actual project data once created
  const createdProject = useMemo(() => {
    if (!createdProjectId) return null
    return allProjects.find(p => p.id === createdProjectId) || null
  }, [createdProjectId, allProjects])

  const projectColor = createdProject ? getProjectColor(createdProject.type || '') : 'var(--project-default-rgb)'
  const firstTask = createdProject?.metadata?.tasks?.[0]

  // Reveal sequence timing
  useEffect(() => {
    if (phase !== 'reveal') return

    const timers = [
      setTimeout(() => setRevealBeat(1), 400),    // Icon burst
      setTimeout(() => setRevealBeat(2), 1200),    // Title appears
      setTimeout(() => setRevealBeat(3), 2200),    // "Why you" statement
      setTimeout(() => setRevealBeat(4), 3800),    // First task
      setTimeout(() => setRevealBeat(5), 5000),    // CTA
    ]
    return () => timers.forEach(clearTimeout)
  }, [phase])

  // Fetch personalized "why you" statement when reveal starts
  useEffect(() => {
    if (phase !== 'reveal' || !createdProject) return

    const fetchWhyYou = async () => {
      try {
        const res = await fetch('/api/brainstorm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 'project-reveal',
            projectTitle: createdProject.title,
            projectDescription: createdProject.description || '',
            projectType: createdProject.type || 'Creative',
            themes: analysis.themes,
            capabilities: analysis.capabilities,
            firstInsight: analysis.first_insight || '',
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.statement) setWhyYouStatement(data.statement)
        }
      } catch {
        // Silent fail — the reveal still works without it
      }
    }

    fetchWhyYou()
  }, [phase, createdProject])

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
    setCreatedProjectId(projectId)
    setFirstProjectId(projectId)
    completeChallenge(1)
    setPhase('reveal')
  }

  const handleSkipToHome = () => {
    navigate('/')
  }

  const handleGoToProject = () => {
    if (createdProjectId) {
      // Build a contextual auto-message that references their onboarding themes
      const themesStr = analysis.themes.slice(0, 3).join(', ')
      const capsStr = analysis.capabilities.slice(0, 2).join(' and ')
      const autoMsg = `During onboarding I talked about ${themesStr || 'a few things on my mind'}${capsStr ? `, and you noticed I'm good at ${capsStr}` : ''}. Now I've started this project — what connections do you see between what I shared earlier and what I'm building here? What's the one thing I should focus on first to make real progress?`

      navigate(`/projects/${createdProjectId}`, {
        state: { openChat: true, chatAutoMessage: autoMsg },
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 relative overflow-hidden">
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

        {/* ── Phase 3: Cinematic First Project Reveal ──────────────── */}
        {phase === 'reveal' && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center max-w-lg w-full relative"
          >
            {/* === Background radial glow === */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5 }}
              style={{
                background: `radial-gradient(circle at 50% 40%, rgba(${projectColor}, 0.12) 0%, transparent 70%)`,
              }}
            />

            {/* === Particle burst === */}
            {revealBeat >= 1 && PARTICLES.map((p, i) => (
              <motion.div
                key={`particle-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: p.size,
                  height: p.size,
                  background: `rgba(${projectColor}, ${0.4 + Math.random() * 0.4})`,
                  top: '40%',
                  left: '50%',
                }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                  x: Math.cos(p.angle) * p.distance,
                  y: Math.sin(p.angle) * p.distance,
                  opacity: [0, 0.9, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: 'easeOut',
                }}
              />
            ))}

            {/* === Orbital ring === */}
            {revealBeat >= 1 && (
              <div className="absolute" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                {ORBITALS.map((orb, i) => (
                  <motion.div
                    key={`orb-${i}`}
                    className="absolute rounded-full"
                    style={{
                      width: 5,
                      height: 5,
                      background: `rgba(${projectColor}, 0.5)`,
                    }}
                    initial={{
                      x: Math.cos(orb.angle) * 50,
                      y: Math.sin(orb.angle) * 50,
                      opacity: 0,
                      scale: 0,
                    }}
                    animate={{
                      x: Math.cos(orb.angle) * 60,
                      y: Math.sin(orb.angle) * 60,
                      opacity: [0, 0.8, 0.8, 0],
                      scale: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 1.8,
                      delay: 0.2 + orb.delay,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>
            )}

            {/* === Central icon with expansion ring === */}
            <div className="relative mb-10">
              {/* Expansion ring */}
              {revealBeat >= 1 && (
                <motion.div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    border: `2px solid rgba(${projectColor}, 0.3)`,
                    top: '50%',
                    left: '50%',
                  }}
                  initial={{ width: 0, height: 0, x: 0, y: 0, opacity: 0.8 }}
                  animate={{
                    width: 200,
                    height: 200,
                    x: -100,
                    y: -100,
                    opacity: 0,
                  }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              )}

              {/* Inner glow */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, rgba(${projectColor}, 0.2), transparent 70%)`,
                  top: '50%',
                  left: '50%',
                  width: 120,
                  height: 120,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: revealBeat >= 1 ? 1 : 0, scale: revealBeat >= 1 ? 1 : 0 }}
                transition={{ duration: 0.8 }}
              />

              {/* Main icon */}
              <motion.div
                className="relative z-10 w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, rgba(${projectColor}, 0.2), rgba(${projectColor}, 0.08))`,
                  border: `2px solid rgba(${projectColor}, 0.4)`,
                  boxShadow: `0 0 40px rgba(${projectColor}, 0.15)`,
                }}
                initial={{ scale: 0, rotate: -90 }}
                animate={{
                  scale: revealBeat >= 1 ? [0, 1.3, 1] : 0,
                  rotate: revealBeat >= 1 ? [- 90, 10, 0] : -90,
                }}
                transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <motion.div
                  animate={revealBeat >= 2 ? { rotate: [0, 360] } : {}}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles
                    className="h-9 w-9"
                    style={{ color: `rgb(${projectColor})` }}
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* === Project title === */}
            <AnimatePresence>
              {revealBeat >= 2 && createdProject && (
                <motion.div
                  initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="mb-6"
                >
                  <motion.p
                    className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
                    style={{ color: `rgb(${projectColor})`, opacity: 0.7 }}
                    initial={{ opacity: 0, letterSpacing: '0.5em' }}
                    animate={{ opacity: 0.7, letterSpacing: '0.2em' }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  >
                    {createdProject.type || 'Project'}
                  </motion.p>

                  <motion.h1
                    className="text-3xl sm:text-4xl font-bold leading-tight"
                    style={{ color: 'var(--brand-text-primary)' }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    {createdProject.title}
                  </motion.h1>
                </motion.div>
              )}
            </AnimatePresence>

            {/* === "Why this is perfect for you" === */}
            <AnimatePresence>
              {revealBeat >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="mb-8 w-full max-w-sm"
                >
                  <motion.div
                    className="relative p-5 rounded-2xl text-left overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, rgba(${projectColor}, 0.06), rgba(${projectColor}, 0.02))`,
                      border: `1px solid rgba(${projectColor}, 0.12)`,
                    }}
                  >
                    {/* Accent line */}
                    <motion.div
                      className="absolute top-0 left-0 w-1 rounded-full"
                      style={{ background: `rgb(${projectColor})` }}
                      initial={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    />

                    <motion.p
                      className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 ml-3"
                      style={{ color: `rgb(${projectColor})`, opacity: 0.6 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      transition={{ delay: 0.3 }}
                    >
                      Why you
                    </motion.p>

                    {whyYouStatement ? (
                      <motion.p
                        className="text-[15px] leading-[1.65] font-medium ml-3"
                        style={{ color: 'var(--brand-text-primary)' }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                      >
                        {whyYouStatement}
                      </motion.p>
                    ) : (
                      /* Loading shimmer while AI generates */
                      <div className="ml-3 space-y-2">
                        <motion.div
                          className="h-4 rounded-lg"
                          style={{ background: `rgba(${projectColor}, 0.08)`, width: '90%' }}
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                        />
                        <motion.div
                          className="h-4 rounded-lg"
                          style={{ background: `rgba(${projectColor}, 0.08)`, width: '70%' }}
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
                        />
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* === First task card === */}
            <AnimatePresence>
              {revealBeat >= 4 && firstTask && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mb-8 w-full max-w-sm"
                >
                  <motion.div
                    className="p-4 rounded-xl text-left"
                    style={{
                      background: `rgba(${projectColor}, 0.06)`,
                      border: `1px solid rgba(${projectColor}, 0.15)`,
                    }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                      style={{ color: `rgb(${projectColor})`, opacity: 0.6 }}
                    >
                      First step
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--brand-text-primary)' }}
                    >
                      {firstTask.text}
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* === CTA === */}
            <AnimatePresence>
              {revealBeat >= 5 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center gap-3"
                >
                  <motion.button
                    onClick={handleGoToProject}
                    className="px-10 py-4 rounded-xl text-base font-bold inline-flex items-center gap-3 transition-all"
                    style={{
                      background: `linear-gradient(135deg, rgba(${projectColor}, 0.9), rgba(${projectColor}, 0.7))`,
                      color: '#fff',
                      boxShadow: `0 4px 24px rgba(${projectColor}, 0.3)`,
                    }}
                    whileHover={{ scale: 1.03, boxShadow: `0 8px 32px rgba(${projectColor}, 0.4)` }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Let's build this
                    <ArrowRight className="h-5 w-5" />
                  </motion.button>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-xs"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
                  >
                    Day 1 of your Polymath journey
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CreateProjectDialog — opens as sheet in chat phase */}
      <CreateProjectDialog
        isOpen={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open && phase === 'chat') {
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
