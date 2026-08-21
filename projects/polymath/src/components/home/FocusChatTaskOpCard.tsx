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
import { Check, Pencil } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { applyOpToTasks } from '../projects/inlineGuideOps'
import type { Task } from '../projects/TaskList'
import { ConfirmButton, DismissButton, ResolvedBadge, DismissedRow, ProposalCard } from '../chat/ChatPrimitives'
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
    return <DismissedRow label={taskOp.projectTitle} />
  }

  return (
    <ProposalCard>
      <Pencil className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-text-secondary)' }} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)' }}>{label} · {taskOp.projectTitle}</p>
        <p className="text-[13px] leading-snug text-[var(--brand-text-primary)]">{preview}</p>
        {taskOp.op.reasoning && (
          <p className="text-[11px] leading-snug italic pt-0.5" style={{ color: 'var(--brand-text-muted)', opacity: 0.75 }}>{taskOp.op.reasoning}</p>
        )}
      </div>
      {resolved ? (
        <ResolvedBadge />
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <DismissButton onClick={onDismiss} />
          <ConfirmButton onClick={apply} disabled={applying} busy={applying}>
            <Check className="h-3.5 w-3.5" /> {verb}
          </ConfirmButton>
        </div>
      )}
    </ProposalCard>
  )
}
