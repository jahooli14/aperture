/**
 * KeepGoingCard — one focused project, rendered as the full hero card.
 *
 * Used twice on the home: once for the priority project, once for the
 * most-recently-touched non-priority project. Each instance fetches its own
 * Power Hour plan and renders the same panel — dormancy tint, session
 * preview, Start session button.
 *
 * The carousel/swipe variant lived here previously. We split out because the
 * user wanted "priority" and "still warm" as distinct labelled sections,
 * not two slides hidden behind a chevron.
 */

import { useEffect, useState } from 'react'
import { Play, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFocusStore } from '../../stores/useFocusStore'
import { getTheme } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'
import { useToast } from '../ui/toast'
import type { Project } from '../../types'

const SESSION_DURATION_MINUTES = 60

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'not started yet'
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

interface KeepGoingCardProps {
  project: Project | null
  /** Heading shown above the card. Pass an inline JSX node so the accent
   *  word can use the same `<span>` trick as other section headers. */
  heading: React.ReactNode
  /** Shown when the project slot is empty. Hidden if not provided. */
  emptyState?: React.ReactNode
}

export function KeepGoingCard({ project, heading, emptyState }: KeepGoingCardProps) {
  const navigate = useNavigate()
  const startSession = useFocusStore(s => s.startSession)
  const { addToast } = useToast()
  const [plan, setPlan] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(false)

  useEffect(() => {
    if (!project) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/power-hour?projectId=${project.id}&duration=${SESSION_DURATION_MINUTES}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (data.tasks?.[0] && !cancelled) setPlan(data.tasks[0])
      } catch {}
    })()
    return () => { cancelled = true }
    // Refetch only when the project id changes. Other field updates
    // (title, last_active) shouldn't trigger a new Power Hour plan call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  if (!project) {
    if (!emptyState) return null
    return (
      <div>
        <h2 className="section-header">{heading}</h2>
        {emptyState}
      </div>
    )
  }

  const handleStartSession = async () => {
    haptic.medium()
    setLoadingSession(true)
    try {
      const seed = plan
      if (seed) {
        const tasks = [
          ...(seed.ignition_tasks || []).map((t: any, i: number) => ({ id: `ign-${i}`, text: t.text })),
          ...(seed.checklist_items || []).map((t: any, i: number) => ({ id: `core-${i}`, text: t.text })),
          ...(seed.shutdown_tasks || []).map((t: any, i: number) => ({ id: `shut-${i}`, text: t.text })),
        ]
        if (tasks.length > 0) {
          startSession(project.id, tasks)
          return
        }
      }

      const res = await fetch(`/api/power-hour?projectId=${project.id}&duration=${SESSION_DURATION_MINUTES}`)
      if (!res.ok) {
        if (res.status !== 401) {
          const body = await res.json().catch(() => ({}))
          addToast({
            title: "Couldn't plan session",
            description: body.error || `Power Hour API returned ${res.status}`,
            variant: 'destructive',
            action: { label: 'Open project', onClick: () => navigate(`/projects/${project.id}`) },
          })
        }
        return
      }

      const data = await res.json()
      const task = data.tasks?.[0]
      const tasks = task ? [
        ...(task.ignition_tasks || []).map((t: any, i: number) => ({ id: `ign-${i}`, text: t.text })),
        ...(task.checklist_items || []).map((t: any, i: number) => ({ id: `core-${i}`, text: t.text })),
        ...(task.shutdown_tasks || []).map((t: any, i: number) => ({ id: `shut-${i}`, text: t.text })),
      ] : []

      if (tasks.length > 0) {
        startSession(project.id, tasks)
      } else {
        addToast({
          title: "Couldn't plan session",
          description: 'No tasks were generated for this project.',
          variant: 'destructive',
          action: { label: 'Open project', onClick: () => navigate(`/projects/${project.id}`) },
        })
      }
    } catch (err) {
      console.error('[KeepGoingCard] start session failed:', err)
      addToast({
        title: "Couldn't plan session",
        description: err instanceof Error ? err.message : 'Unexpected error',
        variant: 'destructive',
        action: { label: 'Open project', onClick: () => navigate(`/projects/${project.id}`) },
      })
    } finally {
      setLoadingSession(false)
    }
  }

  const theme = getTheme(project.type || 'other', project.title)
  const headline = plan?.task_title || project.metadata?.session_headline
  const pitch = plan?.task_description || project.metadata?.session_pitch
  // Only surface a preview when we actually know what's next. Generic
  // "continue where you left off" copy is exactly the analyst voice
  // CLAUDE.md forbids — stay quiet when there's nothing real to say.
  const nextStep = headline || project.metadata?.tasks?.find((t: any) => !t.done)?.text

  const dormancyDays = Math.floor(
    (Date.now() - new Date(project.last_active || project.updated_at || 0).getTime()) / 86_400_000
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
    <div>
      <h2 className="section-header">{heading}</h2>
      <div
        className="rounded-2xl p-5 flex flex-col overflow-hidden relative transition-all duration-700 cursor-pointer"
        onClick={() => navigate(`/projects/${project.id}`)}
        style={{
          background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.07) 0%, rgba(15,24,41,0.55) 70%)`,
          backdropFilter: 'blur(18px)',
          border: `1px solid ${dormancyColor ?? `rgba(${theme.rgb}, 0.22)`}`,
          boxShadow: dormancyColor
            ? `0 0 28px ${dormancyColor.replace('0.55', '0.08')}, 0 6px 22px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`
            : `0 0 32px -10px rgba(${theme.rgb}, 0.18), 0 6px 22px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
          minHeight: '260px',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, rgba(${theme.rgb}, 0.5), transparent)` }} />

        <div className="h-1 rounded-full mb-4 opacity-60" style={{ background: theme.text }} />

        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-lg font-bold text-[var(--brand-text-primary)] leading-tight aperture-header line-clamp-2 flex-1">
            {project.title}
          </h3>
          {dormancyLabel && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
              style={{ color: dormancyColor ?? undefined, border: `1px solid ${dormancyColor}`, background: 'rgba(0,0,0,0.3)' }}
            >
              {dormancyLabel}
            </span>
          )}
        </div>
        <p
          className="text-[11px] mb-3"
          style={{ color: dormancyColor ?? 'var(--brand-text-secondary)', opacity: dormancyColor ? 0.8 : 0.4 }}
        >
          {formatRelativeTime(project.last_active || project.updated_at)}
        </p>

        {nextStep ? (
          <div className="flex-1 p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text-secondary)] opacity-40 mb-1">
              {headline ? 'This session' : "What's next"}
            </p>
            <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed line-clamp-2 mb-1">{nextStep}</p>
            {pitch && (
              <p className="text-xs text-[var(--brand-text-secondary)] opacity-50 line-clamp-2">{pitch}</p>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <button
          onClick={(e) => { e.stopPropagation(); handleStartSession() }}
          disabled={loadingSession}
          className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: theme.text, color: 'black', boxShadow: `0 4px 16px rgba(${theme.rgb},0.2)` }}
        >
          {loadingSession ? (
            <span className="animate-pulse">Planning session...</span>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Start session
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/** Empty state used by the priority slot when nothing is starred and by the
 *  recent slot when there are no active projects. Pulled out so the same
 *  visual sits in both holes. */
export function KeepGoingEmpty({ message }: { message?: string }) {
  const navigate = useNavigate()
  return (
    <div
      className="rounded-2xl p-6 flex flex-col items-center justify-center text-center"
      style={{
        background: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(15,24,41,0.5) 60%)',
        border: '1px solid rgba(56,189,248,0.15)',
        boxShadow: '0 0 30px rgba(56,189,248,0.05), 0 4px 16px rgba(0,0,0,0.4)',
        minHeight: '180px',
      }}
    >
      <Zap className="h-8 w-8 text-[var(--brand-primary)] opacity-30 mb-3" />
      <p className="text-sm font-medium text-[var(--brand-text-secondary)] opacity-60">{message ?? 'No active projects yet'}</p>
      <button
        onClick={() => navigate('/projects')}
        className="mt-3 text-xs text-[var(--brand-primary)] opacity-70 hover:opacity-100 transition-opacity underline"
      >
        Open projects
      </button>
    </div>
  )
}
