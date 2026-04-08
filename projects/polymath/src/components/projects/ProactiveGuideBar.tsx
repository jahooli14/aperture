/**
 * Proactive Guide Bar
 *
 * Floating bar at the bottom of the project page that shows a live
 * preview of what the AI guide wants to tell you. Replaces the static
 * "Chat, plan, get unstuck..." with context-aware prompts.
 *
 * The bar adapts based on project phase and recent activity:
 * - Shaping: "Let's figure out what you're really building"
 * - Building: Surfaces the focus suggestion from the session brief
 * - Closing: "3 tasks left — want to plan the finish?"
 * - Stale: "It's been a while. Want to pick this back up?"
 * - Knowledge nudge: Shows when a recent thought connects
 */

import { Zap, Compass, Hammer, Flag, Sunrise, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

type Phase = 'shaping' | 'building' | 'closing' | 'stale' | 'fresh'

interface ProactiveGuideBarProps {
  onOpen: () => void
  phase?: Phase | null
  focusSuggestion?: string | null
  knowledgeNudge?: string | null
  incompleteTasks: number
  projectTitle: string
}

const PHASE_PROMPTS: Record<Phase, string> = {
  shaping: "Let's figure out what you're really building",
  building: "What are you working on?",
  closing: "Almost there — plan the finish?",
  stale: "Been a while. One small step to restart?",
  fresh: "Shape this into something real",
}

const PHASE_ICONS: Record<Phase, typeof Zap> = {
  shaping: Compass,
  building: Hammer,
  closing: Flag,
  stale: Sunrise,
  fresh: Compass,
}

const PHASE_ACCENTS: Record<Phase, string> = {
  shaping: 'rgba(var(--brand-primary-rgb),',
  building: 'rgba(var(--brand-primary-rgb),',
  closing: 'rgba(16,185,129,',
  stale: 'rgba(245,158,11,',
  fresh: 'rgba(var(--brand-primary-rgb),',
}

export function ProactiveGuideBar({
  onOpen,
  phase,
  focusSuggestion,
  knowledgeNudge,
  incompleteTasks,
  projectTitle,
}: ProactiveGuideBarProps) {
  const currentPhase = phase || 'building'
  const Icon = PHASE_ICONS[currentPhase]
  const accentBase = PHASE_ACCENTS[currentPhase]

  // Determine what to show — priority: knowledge nudge > focus suggestion > phase prompt
  let previewText: string
  let labelText: string

  if (knowledgeNudge) {
    previewText = knowledgeNudge
    labelText = 'New connection'
  } else if (focusSuggestion) {
    previewText = focusSuggestion
    labelText = 'Session focus'
  } else {
    previewText = PHASE_PROMPTS[currentPhase]
    labelText = 'Your guide'
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-30 max-w-2xl mx-auto">
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all active:scale-[0.98] group text-left"
        style={{
          background: `linear-gradient(135deg, ${accentBase}0.15) 0%, ${accentBase}0.08) 100%)`,
          border: `1.5px solid ${accentBase}0.35)`,
          boxShadow: `0 0 24px ${accentBase}0.1), 0 4px 16px rgba(0,0,0,0.4)`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
          style={{
            background: `${accentBase}0.2)`,
            border: `1px solid ${accentBase}0.3)`,
          }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: `${accentBase}1)` }} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-black uppercase tracking-[0.25em] mb-0.5"
            style={{ color: `${accentBase}0.7)` }}
          >
            {labelText}
          </p>
          <p
            className="text-[13px] font-medium leading-snug truncate"
            style={{ color: 'var(--brand-text-primary)', opacity: 0.75 }}
          >
            {previewText}
          </p>
        </div>
        <ArrowRight
          className="h-4 w-4 flex-shrink-0 opacity-25 group-hover:opacity-50 group-hover:translate-x-0.5 transition-all"
          style={{ color: 'var(--brand-text-secondary)' }}
        />
      </motion.button>
    </div>
  )
}
