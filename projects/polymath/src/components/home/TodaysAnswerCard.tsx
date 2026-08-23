/**
 * TodaysAnswerCard — the home page's single output box.
 *
 * Replaces the old three-piece split (KeepGoingCard hero + FocusChat's own
 * collapsed pill + ProjectIdeasHome's quiet suggest-a-project pill) with
 * one thing: a single "today's answer" built from the priority project's
 * real Power Hour plan, a Start session button, and a redirect ("or steer
 * it") that opens to real corpus signals — the same evidence-backed queue
 * ProjectIdeasHome draws from — plus free text. Tapping a signal commits it
 * (creates the project, becomes the new answer); typing hands off to the
 * existing Focus chat thread instead of running a second conversation.
 *
 * "Guide, not menu": one statement, one action, one quiet way to redirect —
 * never a question next to two competing buttons. See the chat-ux-review
 * design work this was built from for the full rationale.
 */

import { useEffect, useMemo, useState } from 'react'
import { Play, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  useProjectStore,
  usePriorityProject,
  useMostRecentNonPriorityProject,
} from '../../stores/useProjectStore'
import { useSessionContextStore } from '../../stores/useSessionContextStore'
import { useFocusChatStore } from '../../stores/useFocusChatStore'
import { useStartProjectSession } from '../../hooks/useStartProjectSession'
import { getTheme, iconForType } from '../../lib/projectTheme'
import { toPortfolioSummaries, buildOpeningLine } from './focusChatOps'
import { formatRelativeTime, KeepGoingEmpty } from './KeepGoingEmpty'
import { api } from '../../lib/apiClient'
import { haptic } from '../../utils/haptics'
import { useToast } from '../ui/toast'
import { handleInputFocus } from '../../utils/keyboard'

const SESSION_DURATION_MINUTES = 60

interface IdeaEvidence { kind: string; source_id: string; label: string; date: string; excerpt: string }
interface ProjectIdea {
  id: string
  title: string
  pitch: string
  why_now: string
  next_step: string
  evidence: IdeaEvidence[]
  status: 'pending' | 'saved' | 'rejected' | 'built'
  mode?: 'crossover' | 'read' | 'hour'
  pattern?: string | null
}

// Mirrors ProjectIdeasHome's deriveFinishLine exactly — every idea prompt
// ends its pitch with "what done looks like," so that sentence IS the
// finish line. Kept in sync deliberately rather than imported: that file
// keeps the type locally too, and this card only needs the one helper.
function deriveFinishLine(idea: ProjectIdea): string {
  const sentences = idea.pitch.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  if (sentences.length >= 2) return sentences[sentences.length - 1]
  return `${idea.title.replace(/\.$/, '')} exists as a finished thing you can show someone.`
}

export function TodaysAnswerCard() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const allProjects = useProjectStore(s => s.allProjects)
  const projects = useProjectStore(s => s.projects)
  const createProject = useProjectStore(s => s.createProject)
  const priorityProject = usePriorityProject()
  const recentProject = useMostRecentNonPriorityProject()
  const feeling = useSessionContextStore(s => s.feeling)

  // A chip tap creates a project and becomes the new answer in place —
  // same box, new content — rather than starting a session invisibly out
  // from under the card.
  const [overrideProjectId, setOverrideProjectId] = useState<string | null>(null)
  const focusProject = useMemo(
    () => (overrideProjectId && allProjects.find(p => p.id === overrideProjectId)) || priorityProject || recentProject || null,
    [overrideProjectId, allProjects, priorityProject, recentProject],
  )

  const [plan, setPlan] = useState<any>(null)
  const { start, loading: startingSession } = useStartProjectSession(focusProject?.id)

  const [engaged, setEngaged] = useState(false)
  const [chips, setChips] = useState<ProjectIdea[] | null>(null)
  const [chipsLoading, setChipsLoading] = useState(false)
  const [resolvingChipId, setResolvingChipId] = useState<string | null>(null)
  const [steerText, setSteerText] = useState('')

  useEffect(() => {
    if (!focusProject) { setPlan(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/power-hour?projectId=${focusProject.id}&duration=${SESSION_DURATION_MINUTES}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (data.tasks?.[0] && !cancelled) setPlan(data.tasks[0])
      } catch {}
    })()
    return () => { cancelled = true }
    // Refetch only when the project id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProject?.id])

  const summaries = useMemo(() => toPortfolioSummaries(
    allProjects.filter(p => p.status !== 'completed' && p.status !== 'graveyard' && p.metadata?.is_shaped !== false)
  ), [allProjects])

  // Real corpus signals for "already noticed" — the same evidence-backed
  // queue ProjectIdeasHome draws from, fetched lazily on first engage (not
  // on mount) so the resting home page never pays for a request nobody
  // asked for.
  const openSteer = async () => {
    haptic.light()
    setEngaged(true)
    if (chips !== null) return
    setChipsLoading(true)
    try {
      const res = await api.get('utilities?resource=project-ideas') as { ideas: ProjectIdea[] }
      const pending = (res.ideas ?? []).filter(i => i.status === 'pending').slice(0, 3)
      setChips(pending)
    } catch {
      setChips([])
    } finally {
      setChipsLoading(false)
    }
  }

  // Free-text steer hands straight to the existing Focus chat thread
  // rather than a second resolution mechanism — real conversation, the
  // same one that already knows how to propose, start, or reshape.
  const submitSteer = () => {
    const text = steerText.trim()
    if (!text) return
    setSteerText('')
    setEngaged(false)
    useFocusChatStore.getState().sendMessage(text, summaries, feeling)
  }

  // Tapping a chip commits it — same create-project flow ProjectIdeasHome's
  // save button uses, then becomes this card's new answer in place. No
  // separate confirmation: tapping a named, evidence-backed signal already
  // IS the "let's do this" gesture.
  const resolveChip = async (idea: ProjectIdea) => {
    if (resolvingChipId) return
    setResolvingChipId(idea.id)
    haptic.medium()
    try {
      const description = [
        idea.mode === 'read' && idea.pattern ? idea.pattern : null,
        idea.pitch,
        idea.next_step ? `First move: ${idea.next_step}` : null,
      ].filter(Boolean).join('\n\n')

      const created = await createProject({
        title: idea.title,
        description,
        status: 'active',
        type: 'Creative',
        metadata: {
          tasks: [],
          progress: 0,
          is_shaped: false,
          from_idea: idea.id,
          end_goal: deriveFinishLine(idea),
          project_mode: 'completion',
        },
      })

      try {
        await api.post('utilities?resource=project-ideas-feedback', { id: idea.id, status: 'built' })
      } catch {
        // Non-fatal: the project exists; the queue reconciles on next load.
      }

      setChips(prev => prev?.filter(i => i.id !== idea.id) ?? null)
      setEngaged(false)
      setOverrideProjectId(created.id)
      addToast({
        title: 'Saved to projects',
        description: `"${idea.title}" is now today's answer.`,
        variant: 'success',
      })
    } catch (err) {
      addToast({
        title: "Couldn't start that",
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      })
    } finally {
      setResolvingChipId(null)
    }
  }

  // Nothing starred, nothing recently touched. Genuinely brand new (no
  // projects at all) points at capture instead of an empty projects list;
  // otherwise the generic "nothing active" empty state.
  if (!focusProject) {
    if (projects.length === 0) {
      return (
        <KeepGoingEmpty
          message="Nothing here yet. Start by capturing a thought."
          actionLabel="Capture a thought"
          onAction={() => window.dispatchEvent(new Event('openVoiceCapture'))}
        />
      )
    }
    // Projects exist but nothing's starred or recently active enough to
    // anchor an answer to a single project — still give a real, portfolio-
    // aware line (not a placeholder) and a way to steer, just no Start
    // session button (there's no specific project to attach it to).
    const openingLine = buildOpeningLine(summaries)
    return (
      <div
        className="rounded-2xl p-5 relative"
        style={{
          background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.65) 60%)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.35)',
          boxShadow: '0 0 42px rgba(var(--brand-primary-rgb),0.22), 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.7 }}>today's answer</span>
        <p className="mt-3 text-[16px] leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>{openingLine}</p>
        {!engaged ? (
          <SteerRow onOpen={openSteer} />
        ) : (
          <SteerPanel
            chips={chips}
            chipsLoading={chipsLoading}
            resolvingChipId={resolvingChipId}
            onResolveChip={resolveChip}
            steerText={steerText}
            onSteerTextChange={setSteerText}
            onSubmitSteer={submitSteer}
            onClose={() => setEngaged(false)}
          />
        )}
      </div>
    )
  }

  const handleStartSession = () => start({ prefetched: plan })
  const TypeIcon = iconForType(focusProject.type)
  const theme = getTheme(focusProject.type || 'other', focusProject.title)

  const headline = plan?.task_title || focusProject.metadata?.session_headline
  const pitch = plan?.task_description || focusProject.metadata?.session_pitch
  // Only surface a preview when we actually know what's next. Generic
  // "continue where you left off" copy is exactly the analyst voice
  // CLAUDE.md forbids — stay quiet when there's nothing real to say.
  const answer = headline || focusProject.metadata?.tasks?.find((t: any) => !t.done)?.text

  const dormancyDays = Math.floor(
    (Date.now() - new Date(focusProject.last_active || focusProject.updated_at || 0).getTime()) / 86_400_000
  )
  const dormancyColor = dormancyDays >= 28
    ? 'rgba(239,68,68,0.55)'
    : dormancyDays >= 7
    ? 'rgba(245,158,11,0.55)'
    : null
  const dormancyLabel = dormancyDays >= 28
    ? 'long quiet'
    : dormancyDays >= 7
    ? 'going quiet'
    : null

  return (
    <div
      className="rounded-2xl p-5 flex flex-col overflow-hidden relative transition-all duration-700"
      style={{
        background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.65) 60%)',
        backdropFilter: 'blur(18px)',
        border: `1px solid ${dormancyColor ?? 'rgba(var(--brand-primary-rgb),0.35)'}`,
        boxShadow: dormancyColor
          ? `0 0 36px ${dormancyColor.replace('0.55', '0.22')}, 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 0 42px rgba(var(--brand-primary-rgb),0.22), 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Top hairline glow — same brand-primary cue used on ThoughtOfTheDay. */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.45), transparent)' }}
      />

      <div className="cursor-pointer" onClick={() => navigate(`/projects/${focusProject!.id}`)}>
        <div className="flex items-start justify-between gap-2 mb-1 mt-1">
          <h3 className="card-title-lg line-clamp-2 flex-1">{focusProject.title}</h3>
          {dormancyLabel && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
              style={{ color: dormancyColor ?? undefined, border: `1px solid ${dormancyColor}`, background: 'rgba(0,0,0,0.3)' }}
            >
              {dormancyLabel}
            </span>
          )}
          <div className="relative flex-shrink-0 mt-0.5">
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
              style={{
                width: '48px',
                height: '48px',
                background: `radial-gradient(circle, rgba(${theme.rgb}, 0.42) 0%, rgba(${theme.rgb}, 0.16) 45%, transparent 75%)`,
                filter: 'blur(5px)',
              }}
            />
            <TypeIcon className="relative h-[18px] w-[18px]" style={{ color: 'rgba(255, 255, 255, 0.88)' }} strokeWidth={1.75} />
          </div>
        </div>
        <span
          className="text-[10px] uppercase tracking-[0.32em] font-semibold mb-3 inline-block"
          style={{ color: dormancyColor ?? 'rgba(var(--brand-primary-rgb),0.7)' }}
        >
          {formatRelativeTime(focusProject.last_active || focusProject.updated_at)}
        </span>

        {answer ? (
          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text-secondary)] opacity-40 mb-1">
              {headline ? "today's answer" : "what's next"}
            </p>
            <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed line-clamp-2 mb-1">{answer}</p>
            {pitch && <p className="text-xs text-[var(--brand-text-secondary)] opacity-50 line-clamp-2">{pitch}</p>}
          </div>
        ) : (
          <div className="mb-4" />
        )}

        <button
          onClick={(e) => { e.stopPropagation(); handleStartSession() }}
          disabled={startingSession}
          className="w-full py-2.5 rounded-xl font-semibold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
          style={{
            background: 'rgba(var(--brand-primary-rgb), 0.12)',
            border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
            color: 'rgb(var(--brand-primary-rgb))',
            boxShadow: '0 4px 16px -4px rgba(var(--brand-primary-rgb), 0.18)',
          }}
        >
          {startingSession ? (
            <span className="animate-pulse">Planning session...</span>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Start session
            </>
          )}
        </button>
      </div>

      {/* Redirect — stopPropagation so tapping anything in here doesn't
          also fire the card's navigate-to-project click above. */}
      <div onClick={(e) => e.stopPropagation()}>
        {!engaged ? (
          <SteerRow onOpen={openSteer} />
        ) : (
          <SteerPanel
            chips={chips}
            chipsLoading={chipsLoading}
            resolvingChipId={resolvingChipId}
            onResolveChip={resolveChip}
            steerText={steerText}
            onSteerTextChange={setSteerText}
            onSubmitSteer={submitSteer}
            onClose={() => setEngaged(false)}
          />
        )}
      </div>
    </div>
  )
}

/** Resting-state redirect entry: one 2-word label, no icon, matches the
 *  established "or steer it" language from the design pass this was built
 *  from — no sentence explaining what it does. */
function SteerRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full mt-4 pt-4 flex items-center justify-between text-left"
      style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>or steer it</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-30" style={{ color: 'var(--brand-text-secondary)' }} />
    </button>
  )
}

/** Engaged state: real corpus signals to tap (recognition), plus a text
 *  field for anything they cover (recall) — same weight, no icons beyond
 *  the one chevron reused from elsewhere in the app, no caption spelling
 *  out what either does. */
function SteerPanel({
  chips,
  chipsLoading,
  resolvingChipId,
  onResolveChip,
  steerText,
  onSteerTextChange,
  onSubmitSteer,
  onClose,
}: {
  chips: ProjectIdea[] | null
  chipsLoading: boolean
  resolvingChipId: string | null
  onResolveChip: (idea: ProjectIdea) => void
  steerText: string
  onSteerTextChange: (v: string) => void
  onSubmitSteer: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-4 pt-4"
      style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.7 }}>already noticed</span>
        <button onClick={onClose} className="text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Close</button>
      </div>

      {chipsLoading && (
        <p className="text-xs mb-3" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Reading your captures…</p>
      )}

      {!chipsLoading && chips !== null && chips.length === 0 && (
        <p className="text-xs mb-3" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Nothing waiting yet — say what you're after below.</p>
      )}

      <AnimatePresence initial={false}>
        {chips?.map(idea => (
          <motion.button
            key={idea.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            onClick={() => onResolveChip(idea)}
            disabled={!!resolvingChipId}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl mb-2 text-left transition-opacity disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}
          >
            <div className="flex-1 min-w-0">
              <span className="block text-[15px] font-medium line-clamp-1" style={{ color: 'var(--brand-text-primary)' }}>{idea.title}</span>
              <span className="text-[11px] opacity-60 line-clamp-1" style={{ color: 'var(--brand-text-secondary)' }}>
                {resolvingChipId === idea.id ? 'Starting…' : (idea.evidence?.[0]?.label || idea.why_now)}
              </span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-30 flex-shrink-0" style={{ color: 'var(--brand-text-secondary)' }} />
          </motion.button>
        ))}
      </AnimatePresence>

      <div className="mt-3">
        <span className="block mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>or steer it</span>
        <div className="flex items-center gap-2">
          <input
            placeholder="What's actually got you right now?"
            value={steerText}
            onChange={e => onSteerTextChange(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmitSteer() } }}
            autoComplete="off"
            className="flex-1 px-4 py-3 rounded-xl text-[15px] focus:outline-none focus:ring-0"
            style={{ color: 'var(--brand-text-primary)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          />
          <button
            type="button"
            onClick={onSubmitSteer}
            disabled={!steerText.trim()}
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-10"
            style={{
              background: steerText.trim() ? 'rgba(var(--brand-primary-rgb),0.1)' : 'transparent',
              border: `1px solid ${steerText.trim() ? 'rgba(var(--brand-primary-rgb),0.15)' : 'rgba(255,255,255,0.04)'}`,
              color: 'var(--brand-text-primary)',
            }}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
