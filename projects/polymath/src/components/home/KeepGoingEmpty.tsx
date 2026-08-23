/**
 * KeepGoingEmpty — empty state for the "today's answer" slot on home
 * (TodaysAnswerCard) when there's no project to build an answer from yet.
 *
 * The hero-card rendering that used to live here (KeepGoingCard) has moved
 * into TodaysAnswerCard.tsx, merged with the redirect/steer mechanism —
 * see that file. This one export survives because the empty state didn't
 * need to change.
 */

import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'

export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'not started yet'
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/** Empty state used by the priority slot when nothing is starred and by the
 *  recent slot when there are no active projects. Pulled out so the same
 *  visual sits in both holes. */
export function KeepGoingEmpty({
  message,
  actionLabel,
  onAction,
}: {
  message?: string
  actionLabel?: string
  onAction?: () => void
}) {
  const navigate = useNavigate()
  const handleAction = onAction ?? (() => navigate('/projects'))
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
        onClick={handleAction}
        className="mt-3 text-xs text-[var(--brand-primary)] opacity-70 hover:opacity-100 transition-opacity underline"
      >
        {actionLabel ?? 'Open projects'}
      </button>
    </div>
  )
}
