/**
 * KeepGoingCarousel — Swipeable cards for up to 3 focused projects.
 * Priority projects first, then most recently active.
 * "Start session" drops directly into FocusSession.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { Play, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFocusedProjects } from '../../stores/useProjectStore'
import { useFocusStore } from '../../stores/useFocusStore'
import { getTheme } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'

const SWIPE_THRESHOLD = 50
const DURATION_KEY = 'polymath-power-hour-duration'

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

export function KeepGoingCarousel() {
  const navigate = useNavigate()
  const projects = useFocusedProjects()
  const startSession = useFocusStore(s => s.startSession)

  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [loadingSession, setLoadingSession] = useState<string | null>(null)

  // Prefetch power hour plans for visible projects
  const [sessionPlans, setSessionPlans] = useState<Record<string, any>>({})

  // Stabilise the dependency: only re-run when the set of project IDs changes
  const projectIds = useMemo(() => projects.map(p => p.id).join(','), [projects])
  const sessionPlansRef = useRef(sessionPlans)
  sessionPlansRef.current = sessionPlans

  useEffect(() => {
    if (!projectIds) return
    const ids = projectIds.split(',')
    const duration = Number(localStorage.getItem(DURATION_KEY)) || 60
    ids.forEach(async (id) => {
      if (sessionPlansRef.current[id]) return
      try {
        const res = await fetch(`/api/power-hour?projectId=${id}&duration=${duration}`)
        if (res.ok) {
          const data = await res.json()
          if (data.tasks?.[0]) {
            setSessionPlans(prev => ({ ...prev, [id]: data.tasks[0] }))
          }
        }
      } catch {}
    })
  }, [projectIds])

  const total = projects.length
  const current = projects[idx] || null

  const onDragEnd = useCallback((_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD || total <= 1) return
    if (info.offset.x < 0) {
      setDirection(1)
      haptic.light()
      setIdx(i => (i + 1) % total)
    } else {
      setDirection(-1)
      haptic.light()
      setIdx(i => (i - 1 + total) % total)
    }
  }, [total])

  const handleStartSession = async (projectId: string) => {
    haptic.medium()
    setLoadingSession(projectId)

    try {
      const plan = sessionPlans[projectId]
      if (plan) {
        // Build task list from the cached plan
        const tasks = [
          ...(plan.ignition_tasks || []).map((t: any, i: number) => ({ id: `ign-${i}`, text: t.text })),
          ...(plan.checklist_items || []).map((t: any, i: number) => ({ id: `core-${i}`, text: t.text })),
          ...(plan.shutdown_tasks || []).map((t: any, i: number) => ({ id: `shut-${i}`, text: t.text })),
        ]
        if (tasks.length > 0) {
          startSession(projectId, tasks)
          return
        }
      }

      // Fallback: fetch fresh plan
      const duration = Number(localStorage.getItem(DURATION_KEY)) || 60
      const res = await fetch(`/api/power-hour?projectId=${projectId}&duration=${duration}`)
      if (res.ok) {
        const data = await res.json()
        const task = data.tasks?.[0]
        if (task) {
          const tasks = [
            ...(task.ignition_tasks || []).map((t: any, i: number) => ({ id: `ign-${i}`, text: t.text })),
            ...(task.checklist_items || []).map((t: any, i: number) => ({ id: `core-${i}`, text: t.text })),
            ...(task.shutdown_tasks || []).map((t: any, i: number) => ({ id: `shut-${i}`, text: t.text })),
          ]
          if (tasks.length > 0) {
            startSession(projectId, tasks)
            return
          }
        }
      }

      // Last fallback: navigate to project page
      navigate(`/projects/${projectId}`)
    } catch {
      navigate(`/projects/${projectId}`)
    } finally {
      setLoadingSession(null)
    }
  }

  if (total === 0) {
    return (
      <div>
        <h2 className="section-header">keep <span>going</span></h2>
        <div
          className="rounded-2xl p-6 flex flex-col items-center justify-center text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(15,24,41,0.5) 60%)',
            border: '1px solid rgba(56,189,248,0.15)',
            boxShadow: '0 0 30px rgba(56,189,248,0.05), 3px 3px 0 rgba(0,0,0,0.4)',
            minHeight: '220px',
          }}
        >
          <Zap className="h-8 w-8 text-[var(--brand-primary)] opacity-30 mb-3" />
          <p className="text-sm font-medium text-[var(--brand-text-secondary)] opacity-60">No active projects yet</p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-3 text-xs text-[var(--brand-primary)] opacity-70 hover:opacity-100 transition-opacity underline"
          >
            Start one
          </button>
        </div>
      </div>
    )
  }

  const theme = current ? getTheme(current.type || 'other', current.title) : { text: 'rgb(var(--brand-primary-rgb))', rgb: 'var(--brand-primary-rgb)' }
  const plan = current ? sessionPlans[current.id] : null
  const headline = plan?.task_title || current?.metadata?.session_headline
  const pitch = plan?.task_description || current?.metadata?.session_pitch
  const nextStep = headline || current?.metadata?.tasks?.find((t: any) => !t.done)?.text || 'Continue where you left off'

  return (
    <div>
      <h2 className="section-header">keep <span>going</span></h2>
      <div
        className="rounded-2xl p-5 flex flex-col overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(15,24,41,0.5) 60%)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56,189,248,0.15)',
          boxShadow: '0 0 30px rgba(56,189,248,0.05), 3px 3px 0 rgba(0,0,0,0.4)',
          minHeight: '280px',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }} />

        {/* Nav dots */}
        {total > 1 && (
          <div className="flex items-center justify-end gap-1 mb-3">
            <button
              onClick={() => { haptic.light(); setDirection(-1); setIdx(i => (i - 1 + total) % total) }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
            <span className="text-[10px] text-[var(--brand-text-secondary)] opacity-40">{idx + 1}/{total}</span>
            <button
              onClick={() => { haptic.light(); setDirection(1); setIdx(i => (i + 1) % total) }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-50" />
            </button>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.2 }}
              drag={total > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={onDragEnd}
              className="flex flex-col flex-1 touch-pan-y"
              style={{ cursor: total > 1 ? 'grab' : undefined }}
            >
              <div className="h-1 rounded-full mb-4 opacity-60" style={{ background: theme.text }} />

              <h3 className="text-lg font-bold text-[var(--brand-text-primary)] leading-tight mb-1 aperture-header line-clamp-2">
                {current.title}
              </h3>
              <p className="text-[11px] text-[var(--brand-text-secondary)] opacity-40 mb-3">
                {formatRelativeTime(current.last_active || current.updated_at)}
              </p>

              {/* Session preview */}
              <div className="flex-1 p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text-secondary)] opacity-40 mb-1">
                  {headline ? 'This session' : "What's next"}
                </p>
                <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed line-clamp-2 mb-1">{nextStep}</p>
                {pitch && (
                  <p className="text-xs text-[var(--brand-text-secondary)] opacity-50 line-clamp-2">{pitch}</p>
                )}
              </div>

              <button
                onClick={() => handleStartSession(current.id)}
                disabled={loadingSession === current.id}
                className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: theme.text, color: 'black', boxShadow: `0 4px 16px rgba(${theme.rgb},0.2)` }}
              >
                {loadingSession === current.id ? (
                  <span className="animate-pulse">Planning session...</span>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Start session
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
