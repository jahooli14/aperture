/**
 * Confirm/dismiss card for a Focus chat "fix the stale next step"
 * correction. Split out for the same reason as FocusChatActionCard — keeps
 * FocusChat.tsx under the repo's 300-line convention.
 *
 * Applying it reuses applyOpToTasks (inlineGuideOps.ts) — the same tested
 * reducer the per-project Guide uses — rather than reimplementing task
 * mutation logic here.
 */

import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { applyOpToTasks } from '../projects/inlineGuideOps'
import type { Task } from '../projects/TaskList'
import { type PortfolioTaskOp, describePortfolioTaskOp } from './focusChatOps'

export function FocusChatTaskOpCard({ taskOp, resolved, dismissed, onResolve, onDismiss }: {
  taskOp: PortfolioTaskOp
  resolved?: boolean
  dismissed?: boolean
  onResolve: () => void
  onDismiss: () => void
}) {
  const targetProject = useProjectStore(s => s.allProjects.find(p => p.id === taskOp.projectId))
  const updateProject = useProjectStore(s => s.updateProject)
  const { addToast } = useToast()
  const [applying, setApplying] = useState(false)
  const { label, verb } = describePortfolioTaskOp(taskOp.op)

  const currentTasks = (targetProject?.metadata?.tasks as Task[] | undefined) || []
  const referencedTask = taskOp.op.taskId ? currentTasks.find(t => t.id === taskOp.op.taskId) : undefined
  const preview = taskOp.op.action === 'edit'
    ? `"${referencedTask?.text ?? '(task no longer here)'}" → "${taskOp.op.newText}"`
    : taskOp.op.action === 'complete'
      ? referencedTask?.text ?? '(task no longer here)'
      : taskOp.op.newText ?? ''

  const apply = async () => {
    setApplying(true)
    try {
      // Read the freshest project at click-time, not the render-time
      // snapshot — a rapid second apply (e.g. two taskOp cards touching
      // the same project) would otherwise read stale metadata and clobber
      // the first fix. Same reasoning as ProjectDetailPage's getFreshProject.
      // Not fully race-proof — two applies fired within the same tick
      // (before either await settles) can still both read pre-update state.
      // InlineGuide closes this gap for real via a serialized write queue
      // (writeQueue.current); not worth that complexity here since it
      // requires clicking two separate buttons with no reaction time
      // between them, which normal use doesn't produce.
      const fresh = useProjectStore.getState().allProjects.find(p => p.id === taskOp.projectId)
      if (!fresh) throw new Error('This project is no longer available.')
      const freshTasks = (fresh.metadata?.tasks as Task[] | undefined) || []
      if (taskOp.op.action !== 'add' && !freshTasks.some(t => t.id === taskOp.op.taskId)) {
        throw new Error("That task isn't there anymore — it may have already changed.")
      }
      const nextTasks = applyOpToTasks(freshTasks, taskOp.op)
      const progress = nextTasks.length > 0
        ? Math.round((nextTasks.filter(t => t.done).length / nextTasks.length) * 100)
        : 0
      const now = new Date().toISOString()
      await updateProject(taskOp.projectId, {
        metadata: { ...fresh.metadata, tasks: nextTasks, progress },
        last_active: now,
        updated_at: now,
      })
      onResolve()
    } catch (err) {
      console.error('[FocusChat] apply task op failed:', err)
      addToast({ title: "Couldn't update that", description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' })
    } finally {
      setApplying(false)
    }
  }

  if (dismissed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', opacity: 0.4 }}>
        <X className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand-text-muted)' }} />
        <p className="text-[12px] leading-snug line-through" style={{ color: 'var(--brand-text-muted)' }}>{taskOp.projectTitle}</p>
      </div>
    )
  }

  return (
    <div
      className="flex items-start gap-3 px-3 py-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <Pencil className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-text-secondary)' }} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)' }}>{label} · {taskOp.projectTitle}</p>
        <p className="text-[13px] leading-snug text-[var(--brand-text-primary)]">{preview}</p>
        {taskOp.op.reasoning && (
          <p className="text-[11px] leading-snug italic pt-0.5" style={{ color: 'var(--brand-text-muted)', opacity: 0.75 }}>{taskOp.op.reasoning}</p>
        )}
      </div>
      {resolved ? (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--brand-text-muted)' }}>
          <Check className="h-3 w-3" /> Done
        </span>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onDismiss} className="h-9 w-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.08] text-[var(--brand-text-muted)]" aria-label="Skip">
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={apply}
            disabled={applying}
            className="flex items-center gap-1 min-h-[36px] px-3 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider disabled:opacity-40"
            style={{ background: 'rgba(var(--brand-primary-rgb),0.18)', color: 'rgb(var(--brand-primary-rgb))', border: '1px solid rgba(var(--brand-primary-rgb),0.4)' }}
          >
            <Check className="h-3.5 w-3.5" /> {verb}
          </button>
        </div>
      )}
    </div>
  )
}
